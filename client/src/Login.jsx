import React, { useState } from 'react'
import { api, setToken } from './api'

export default function Login({ onLogin }) {
  const [username, setUsername] = useState('admin')
  const [password, setPassword] = useState('admin123')
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')

  async function submit(e) {
    e.preventDefault()
    setErr('')
    setLoading(true)
    try {
      const r = await api.login(username.trim(), password)
      setToken(r.token)
      onLogin(r.user)
    } catch (e2) {
      setErr(e2.message || 'Gagal login')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <div className="header">
        <div className="container">
          <div>
            <div className="title">SIPROPER PUSAKA — Realtime</div>
            <div className="subtitle">Login untuk akses data Perkesmas (MVP lokal)</div>
          </div>
        </div>
      </div>

      <div className="container">
        <div className="card" style={{ maxWidth: 520, margin: '18px auto' }}>
          <form onSubmit={submit}>
            <div className="row">
              <div>
                <label>Username</label>
                <input value={username} onChange={(e) => setUsername(e.target.value)} autoFocus />
              </div>
            </div>
            <div className="row" style={{ marginTop: 10 }}>
              <div>
                <label>Password</label>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
            </div>
            {err ? (
              <div className="hint" style={{ color: '#b91c1c' }}>
                {err}
              </div>
            ) : (
              <div className="hint">
                Akun default demo: <b>admin / admin123</b>
              </div>
            )}
            <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end' }}>
              <button disabled={loading}>{loading ? 'Masuk…' : 'Masuk'}</button>
            </div>
          </form>
        </div>
      </div>
    </>
  )
}
