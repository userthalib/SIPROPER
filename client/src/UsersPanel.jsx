import React, { useEffect, useState } from 'react'
import { api } from './api'

export default function UsersPanel({ onClose }) {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState('viewer')

  async function load() {
    setLoading(true)
    setErr('')
    try {
      const r = await api.listUsers()
      setUsers(r.users || [])
    } catch (e) {
      setErr(e.message || 'Gagal memuat user')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function create() {
    setErr('')
    if (!username.trim() || !password) {
      setErr('Username & password wajib diisi')
      return
    }
    try {
      await api.createUser(username.trim(), password, role)
      setUsername('')
      setPassword('')
      setRole('viewer')
      load()
      alert('User dibuat.')
    } catch (e) {
      setErr(e.message || 'Gagal membuat user')
    }
  }

  return (
    <div className="modalOverlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modalHeader">
          <h3>Kelola User</h3>
          <button className="secondary" onClick={onClose}>Tutup</button>
        </div>
        <div className="modalBody">
          <div className="card" style={{ background: '#f9fafb' }}>
            <div className="hint" style={{ marginTop: 0 }}><b>Tambah user baru</b></div>
            <div className="grid2" style={{ marginTop: 8 }}>
              <div>
                <label>Username</label>
                <input value={username} onChange={(e) => setUsername(e.target.value)} />
              </div>
              <div>
                <label>Password</label>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              <div>
                <label>Role</label>
                <select value={role} onChange={(e) => setRole(e.target.value)}>
                  <option value="viewer">viewer (lihat)</option>
                  <option value="editor">editor (edit)</option>
                  <option value="admin">admin</option>
                </select>
              </div>
              <div style={{ display: 'flex', alignItems: 'end', justifyContent: 'flex-end' }}>
                <button onClick={create}>Buat User</button>
              </div>
            </div>
            <div className="hint">Catatan: MVP ini belum ada fitur ganti password / hapus user dari UI.</div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div className="hint" style={{ marginTop: 0 }}><b>Daftar user</b></div>
            <button className="secondary" onClick={load} disabled={loading}>{loading ? 'Memuat…' : 'Refresh'}</button>
          </div>

          {err ? <div className="hint" style={{ color: '#b91c1c' }}>{err}</div> : null}

          <div className="tableWrap" style={{ marginTop: 10 }}>
            <table>
              <thead>
                <tr>
                  <th>Username</th>
                  <th>Role</th>
                  <th>Dibuat</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td>{u.username}</td>
                    <td>{u.role}</td>
                    <td><span className="hint" style={{ margin: 0 }}>{u.created_at}</span></td>
                  </tr>
                ))}
                {users.length === 0 ? (
                  <tr><td colSpan={3}><div className="hint">Tidak ada data user.</div></td></tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
        <div className="modalFooter">
          <button className="secondary" onClick={onClose}>Tutup</button>
        </div>
      </div>
    </div>
  )
}
