import { io } from 'socket.io-client'
import { getToken } from './api'

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || undefined;

export function connectSocket() {
  const token = getToken();
  if (!token) return null;
  const socket = io(SOCKET_URL, {
    auth: { token }
  });
  return socket;
}
