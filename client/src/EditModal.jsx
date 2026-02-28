import React, { useMemo, useState } from 'react'
import { api } from './api'

function flagToBool(v) {
  const t = (v ?? '').toString().trim().toLowerCase()
  return ['√', '✓', 'v', 'y', 'ya', '1', 'true', 'x'].includes(t)
}
function boolToFlag(b) {
  return b ? '√' : ''
}

const FIELDS = [
  'no',
  'index_keluarga',
  'nama_kk',
  'umur_kk',
  'alamat',
  'no_anggota',
  'nama_anggota',
  'umur_anggota',
  'jk',
  'masalah',
  'A',
  'B',
  'C',
  'D',
  'E',
  'F',
  'G',
  'k1_tgl',
  'k1_km',
  'k2_tgl',
  'k2_km',
  'k3_tgl',
  'k3_km',
  'k4_tgl',
  'k4_km',
  'k5_tgl',
  'k5_km',
  'k6_tgl',
  'k6_km',
  'ket'
]

function pick(record) {
  const o = {}
  for (const k of FIELDS) o[k] = record?.[k] ?? ''
  return o
}

export default function EditModal({ record, onClose, onSaved }) {
  const [form, setForm] = useState(() => pick(record))
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  const title = useMemo(() => {
    const kk = record?.nama_kk || '(tanpa nama)'
    const alamat = record?.alamat || ''
    return `Edit — ${kk}${alamat ? ' — ' + alamat : ''}`
  }, [record])

  if (!record) {
    return (
      <div className="modalOverlay" onClick={onClose}>
        <div className="modal" onClick={(e) => e.stopPropagation()}>
          <div className="modalHeader">
            <h3>Data tidak ditemukan</h3>
            <button className="secondary" onClick={onClose}>Tutup</button>
          </div>
          <div className="modalBody">
            <div className="hint">Record sudah berubah/hilang. Silakan refresh.</div>
          </div>
        </div>
      </div>
    )
  }

  function set(k, v) {
    setForm((prev) => ({ ...prev, [k]: v }))
  }

  async function save() {
    setSaving(true)
    setErr('')
    try {
      const r = await api.patchRecord(record.id, form, record.version)
      onSaved(r.record)
      onClose()
    } catch (e2) {
      if (e2.status === 409) {
        setErr('Konflik versi: data sudah diubah user lain. Tutup modal lalu refresh, kemudian edit ulang.')
      } else {
        setErr(e2.message || 'Gagal simpan')
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modalOverlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modalHeader">
          <h3>{title}</h3>
          <button className="secondary" onClick={onClose}>Tutup</button>
        </div>
        <div className="modalBody">
          <div className="grid">
            <div>
              <label>No</label>
              <input value={form.no} onChange={(e) => set('no', e.target.value)} />
            </div>
            <div>
              <label>No Index Keluarga</label>
              <input value={form.index_keluarga} onChange={(e) => set('index_keluarga', e.target.value)} />
            </div>
            <div>
              <label>Nama KK</label>
              <input value={form.nama_kk} onChange={(e) => set('nama_kk', e.target.value)} />
            </div>
            <div>
              <label>Umur KK</label>
              <input value={form.umur_kk} onChange={(e) => set('umur_kk', e.target.value)} />
            </div>
            <div>
              <label>Alamat</label>
              <input value={form.alamat} onChange={(e) => set('alamat', e.target.value)} />
            </div>
            <div>
              <label>JK</label>
              <select value={form.jk} onChange={(e) => set('jk', e.target.value)}>
                <option value=""></option>
                <option value="L">L</option>
                <option value="P">P</option>
              </select>
            </div>
          </div>

          <div className="grid2" style={{ marginTop: 10 }}>
            <div>
              <label>Nama Anggota</label>
              <input value={form.nama_anggota} onChange={(e) => set('nama_anggota', e.target.value)} />
            </div>
            <div>
              <label>No Anggota</label>
              <input value={form.no_anggota} onChange={(e) => set('no_anggota', e.target.value)} />
            </div>
          </div>

          <div className="grid2" style={{ marginTop: 10 }}>
            <div>
              <label>Umur Anggota</label>
              <input value={form.umur_anggota} onChange={(e) => set('umur_anggota', e.target.value)} />
            </div>
            <div>
              <label>Jenis Masalah</label>
              <input value={form.masalah} onChange={(e) => set('masalah', e.target.value)} />
            </div>
          </div>

          <div className="card" style={{ marginTop: 12, background: '#f9fafb' }}>
            <div className="hint" style={{ marginTop: 0 }}><b>Kode Sasaran Lintas Program (A–G)</b> (opsional)</div>
            <div className="grid4" style={{ marginTop: 8 }}>
              {['A', 'B', 'C', 'D', 'E', 'F', 'G'].map((k) => (
                <label key={k} className="checkPill">
                  <input type="checkbox" checked={flagToBool(form[k])} onChange={(e) => set(k, boolToFlag(e.target.checked))} />
                  <span>{k}</span>
                </label>
              ))}
            </div>
            <div className="hint" style={{ marginTop: 8 }}>Centang jika anggota/keluarga termasuk sasaran program tersebut.</div>
          </div>

          <div className="card" style={{ marginTop: 12, background: '#f9fafb' }}>
            <div className="hint" style={{ marginTop: 0 }}><b>Riwayat Kunjungan</b> (tanggal: dd/mm/yyyy atau d/m/yy)</div>
            <div className="grid4" style={{ marginTop: 8 }}>
              {['1', '2', '3', '4', '5', '6'].map((n) => (
                <React.Fragment key={n}>
                  <div>
                    <label>K-{n} Tgl</label>
                    <input value={form[`k${n}_tgl`]} onChange={(e) => set(`k${n}_tgl`, e.target.value)} />
                  </div>
                  <div>
                    <label>K-{n} KM</label>
                    <input value={form[`k${n}_km`]} onChange={(e) => set(`k${n}_km`, e.target.value)} placeholder="I / II / III / IV" />
                  </div>
                </React.Fragment>
              ))}
            </div>
            <div className="hint">Status otomatis dihitung server saat simpan.</div>
          </div>

          <div style={{ marginTop: 10 }}>
            <label>Keterangan</label>
            <input value={form.ket} onChange={(e) => set('ket', e.target.value)} />
          </div>

          {err ? <div className="hint" style={{ color: '#b91c1c' }}>{err}</div> : null}
          <div className="hint">
            Versi data: <b>{record.version}</b> • terakhir diupdate: <b>{record.updated_at || '-'}</b>
          </div>
        </div>
        <div className="modalFooter">
          <button className="secondary" onClick={onClose} disabled={saving}>Batal</button>
          <button onClick={save} disabled={saving}>{saving ? 'Menyimpan…' : 'Simpan'}</button>
        </div>
      </div>
    </div>
  )
}
