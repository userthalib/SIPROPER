import { io } from 'socket.io-client'
import { getToken } from './api'

export function connectSocket() {
  const token = getToken()
  if (!token) return null
  const socket = io({
    auth: { token }
  })
  return socket
}
