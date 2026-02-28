import React, { useEffect, useMemo, useRef, useState } from 'react'
import { api, getToken, importExcel } from './api'
import EditModal from './EditModal.jsx'
import UsersPanel from './UsersPanel.jsx'

function normalizeText(x) {
  return (x ?? '').toString().trim().toLowerCase()
}

function daysDiff(fromDDMMYYYY) {
  if (!fromDDMMYYYY) return null
  const m = String(fromDDMMYYYY).trim().match(/^(\d{2})-(\d{2})-(\d{4})$/)
  if (!m) return null
  const dt = new Date(parseInt(m[3], 10), parseInt(m[2], 10) - 1, parseInt(m[1], 10))
  const now = new Date()
  return Math.floor((now - dt) / (1000 * 60 * 60 * 24))
}

export default function Dashboard({ user, socket }) {
  const [records, setRecords] = useState([])
  const [meta, setMeta] = useState(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')

  const [q, setQ] = useState('')
  const [status, setStatus] = useState('')
  const [jk, setJk] = useState('')
  const [masalah, setMasalah] = useState('')

  const [editId, setEditId] = useState(null)
  const [showUsers, setShowUsers] = useState(false)

  const importRef = useRef(null)

  const isAdmin = user.role === 'admin'
  const canEdit = user.role === 'admin' || user.role === 'editor'

  async function load() {
    setLoading(true)
    setErr('')
    try {
      const r = await api.listRecords({ q, status, jk, masalah })
      setRecords(r.records || [])
      setMeta(r.meta || null)
    } catch (e) {
      setErr(e.message || 'Gagal memuat data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Re-load on filter changes (simple)
  useEffect(() => {
    const t = setTimeout(() => {
      load()
    }, 250)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, status, jk, masalah])

  // Realtime updates
  useEffect(() => {
    if (!socket) return
    function onReloaded() {
      load()
    }
    function onRecordUpdated(msg) {
      const rec = msg?.record
      if (!rec?.id) return
      setRecords((prev) => {
        const idx = prev.findIndex((r) => r.id === rec.id)
        if (idx < 0) return prev
        const copy = [...prev]
        copy[idx] = rec
        return copy
      })
    }
    socket.on('dataset_reloaded', onReloaded)
    socket.on('record_updated', onRecordUpdated)
    return () => {
      socket.off('dataset_reloaded', onReloaded)
      socket.off('record_updated', onRecordUpdated)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket])

  const masalahOptions = useMemo(() => {
    const uniq = new Set()
    for (const r of records) {
      const m = (r.masalah ?? '').toString().trim()
      if (m) uniq.add(m)
    }
    return Array.from(uniq).sort((a, b) => a.localeCompare(b))
  }, [records])

  const metrics = useMemo(() => {
    const kkSet = new Set()
    let visited = 0
    for (const r of records) {
      kkSet.add(`${normalizeText(r.nama_kk)}|${normalizeText(r.alamat)}`)
      if (r.status_k && r.status_k !== 'K0') visited++
    }
    return {
      rows: records.length,
      kk: kkSet.size,
      visited,
      unvisited: records.length - visited
    }
  }, [records])

  const topMasalah = useMemo(() => {
    const map = new Map()
    for (const r of records) {
      const m = (r.masalah ?? '').toString().trim() || '(kosong)'
      map.set(m, (map.get(m) || 0) + 1)
    }
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
  }, [records])

  const priorities = useMemo(() => {
    const prio = []
    for (const r of records) {
      if (r.status_k === 'K0') {
        prio.push({ ...r, _prio: 9999 })
        continue
      }
      const d = daysDiff(r.kunjungan_terakhir)
      if (d === null) {
        prio.push({ ...r, _prio: 9998 })
        continue
      }
      if (d >= 30) prio.push({ ...r, _prio: d })
    }
    return prio
      .sort((a, b) => (b._prio || 0) - (a._prio || 0))
      .slice(0, 8)
  }, [records])

  function pill(statusK) {
    if (statusK === 'K0') return <span className="pill bad">{statusK}</span>
    if (statusK === 'K1') return <span className="pill warn">{statusK}</span>
    return <span className="pill ok">{statusK || '-'}</span>
  }

  async function handleImport(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!confirm('Import akan mengganti dataset di server (mode replace). Lanjut?')) return
    try {
      await importExcel(file)
      alert('Import berhasil.')
      load()
    } catch (e2) {
      alert(e2.message || 'Gagal import')
    }
  }

  function exportCsv() {
    const qs = new URLSearchParams()
    if (q) qs.set('q', q)
    if (status) qs.set('status', status)
    if (jk) qs.set('jk', jk)
    if (masalah) qs.set('masalah', masalah)

    const tok = getToken()
    // Use a fetch download so token can be attached
    fetch('/api/export/csv?' + qs.toString(), {
      headers: { Authorization: `Bearer ${tok}` }
    })
      .then((r) => {
        if (!r.ok) throw new Error('Gagal export')
        return r.blob()
      })
      .then((blob) => {
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = 'export_siproper_pusaka.csv'
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
      })
      .catch((e2) => alert(e2.message || 'Gagal export'))
  }

  return (
    <>
      <div className="card">
        <div className="row">
          <div>
            <label>Pencarian (Nama KK / Alamat / Masalah)</label>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ketik kata kunci…" />
          </div>
          <div>
            <label>Status Kunjungan</label>
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">Semua</option>
              <option value="K0">K0 — Belum ada kunjungan</option>
              <option value="K1">K1</option>
              <option value="K2">K2</option>
              <option value="K3">K3</option>
              <option value="K4">K4</option>
              <option value="K5">K5</option>
              <option value="K6">K6</option>
            </select>
          </div>
          <div>
            <label>JK</label>
            <select value={jk} onChange={(e) => setJk(e.target.value)}>
              <option value="">Semua</option>
              <option value="L">L</option>
              <option value="P">P</option>
            </select>
          </div>
          <div>
            <label>Jenis Masalah</label>
            <select value={masalah} onChange={(e) => setMasalah(e.target.value)}>
              <option value="">Semua</option>
              {masalahOptions.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="toolbar" style={{ marginTop: 10 }}>
          <div className="toolbarLeft">
            <div className="hint" style={{ marginTop: 0 }}>
              Dataset terakhir import: <b>{meta?.last_import_at || '-'}</b>
            </div>
            {isAdmin ? (
              <div className="hint" style={{ marginTop: 6 }}>
                Admin: Import Excel akan <b>mengganti</b> dataset di server (mode replace).
              </div>
            ) : null}
          </div>

          <div className="toolbarRight">
            <button className="secondary" onClick={load} disabled={loading}>
              {loading ? 'Memuat…' : 'Refresh'}
            </button>
            <button onClick={exportCsv}>Export CSV</button>

            {isAdmin ? (
              <>
                <input
                  ref={importRef}
                  type="file"
                  accept=".xlsx"
                  onChange={handleImport}
                  style={{ display: 'none' }}
                />
                <button className="secondary" onClick={() => importRef.current?.click()}>
                  Import Excel
                </button>
                <button className="secondary" onClick={() => setShowUsers(true)}>
                  Kelola User
                </button>
              </>
            ) : null}
          </div>
        </div>


        {err ? <div className="hint" style={{ color: '#b91c1c' }}>{err}</div> : null}
      </div>

      <div className="card">
        <div className="metrics">
          <div className="metric"><div className="k">Jumlah Baris Data</div><div className="v">{metrics.rows}</div></div>
          <div className="metric"><div className="k">Perkiraan Jumlah KK (unik Nama KK+Alamat)</div><div className="v">{metrics.kk}</div></div>
          <div className="metric"><div className="k">Sudah Kunjungan (≥K1)</div><div className="v">{metrics.visited}</div></div>
          <div className="metric"><div className="k">Belum Ada Kunjungan</div><div className="v">{metrics.unvisited}</div></div>
        </div>
        <div className="hint">MVP: fokus mempercepat rekap & koordinasi lintas program dari 1 sumber data.</div>
      </div>

      <div className="row">
        <div className="card">
          <h3 style={{ margin: '0 0 8px', fontSize: 14 }}>Rekap Masalah (Top 10)</h3>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {topMasalah.map(([m, n]) => (
              <li key={m}>{m} — {n}</li>
            ))}
          </ul>
          <div className="hint">Membantu lintas program melihat fokus kasus dominan.</div>
        </div>

        <div className="card">
          <h3 style={{ margin: '0 0 8px', fontSize: 14 }}>Daftar Prioritas (aturan demo)</h3>
          {priorities.length === 0 ? (
            <div className="hint">Tidak ada prioritas terdeteksi (K0 / ≥30 hari).</div>
          ) : (
            <div className="hint">
              <b>8 baris prioritas:</b><br />
              {priorities.map((r) => (
                <div key={r.id}>
                  • {r.nama_kk || '(tanpa nama)'} — {r.alamat || '-'} — {r.status_k} — Last: {r.kunjungan_terakhir || '-'}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <h3 style={{ margin: 0, fontSize: 14 }}>Data Register</h3>
          <div className="hint">Klik Edit untuk memperbaiki data. Update akan terkirim ke user lain jika realtime aktif.</div>
        </div>

        <div className="tableWrap" style={{ marginTop: 10 }}>
          <table>
            <thead>
              <tr>
                <th>Status</th>
                <th>Nama KK</th>
                <th>Alamat</th>
                <th>JK</th>
                <th>Masalah</th>
                <th>Kunjungan Terakhir</th>
                <th>Jml Kunjungan</th>
                <th>Update</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r) => (
                <tr key={r.id}>
                  <td>{pill(r.status_k)}</td>
                  <td>{r.nama_kk}</td>
                  <td>{r.alamat}</td>
                  <td>{r.jk}</td>
                  <td>{r.masalah}</td>
                  <td>{r.kunjungan_terakhir || '-'}</td>
                  <td>{r.jumlah_kunjungan ?? 0}</td>
                  <td><span className="hint" style={{ margin: 0 }}>{r.updated_at || '-'}</span></td>
                  <td>
                    <button
                      className="secondary"
                      disabled={!canEdit}
                      onClick={() => setEditId(r.id)}
                      title={!canEdit ? 'Role viewer tidak bisa edit' : ''}
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
              {records.length === 0 ? (
                <tr><td colSpan={9}><div className="hint">Belum ada data. Admin bisa import Excel.</div></td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      {editId ? (
        <EditModal
          user={user}
          record={records.find((r) => r.id === editId)}
          onClose={() => setEditId(null)}
          onSaved={(updated) => {
            setRecords((prev) => prev.map((r) => (r.id === updated.id ? updated : r)))
          }}
        />
      ) : null}

      {showUsers ? (
        <UsersPanel onClose={() => setShowUsers(false)} />
      ) : null}
    </>
  )
}
