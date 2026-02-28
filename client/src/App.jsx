import React, { useEffect, useMemo, useState } from 'react'
import { api, getToken, setToken } from './api'
import { connectSocket } from './socket'
import Login from './Login.jsx'
import Dashboard from './Dashboard.jsx'

export default function App() {
  const [user, setUser] = useState(null)
  const [bootError, setBootError] = useState('')

  useEffect(() => {
    const token = getToken()
    if (!token) return
    api.me()
      .then((r) => setUser(r.user))
      .catch(() => {
        setToken('')
        setUser(null)
      })
  }, [])

  const socket = useMemo(() => {
    if (!user) return null
    const s = connectSocket()
    return s
  }, [user])

  useEffect(() => {
    if (!socket) return
    socket.on('connect_error', (err) => {
      setBootError(err?.message || 'Socket error')
    })
    return () => {
      socket.disconnect()
    }
  }, [socket])

  function handleLogout() {
    setToken('')
    setUser(null)
  }

  if (!user) {
    return <Login onLogin={(u) => setUser(u)} />
  }

  return (
    <>
      <div className="header">
        <div className="container">
          <div>
            <div className="title">SIPROPER PUSAKA — Realtime</div>
            <div className="subtitle">Sistem Informasi Lintas Program Perkesmas (MVP lokal)</div>
          </div>
          <div className="topbar">
            <div className="who">Masuk sebagai <b>{user.username}</b> ({user.role})</div>
            <button className="secondary" onClick={handleLogout}>Keluar</button>
          </div>
        </div>
      </div>

      <div className="container">
        {bootError ? (
          <div className="card">
            <b>Info koneksi realtime:</b> {bootError}
            <div className="hint">Aplikasi tetap bisa jalan tanpa realtime, tapi update antar user tidak otomatis.</div>
          </div>
        ) : null}

        <Dashboard user={user} socket={socket} />
      </div>
    </>
  )
}
