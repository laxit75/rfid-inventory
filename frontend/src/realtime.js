import { io } from 'socket.io-client'

let socket = null

export function connectRealtime() {
  if (socket) return socket
  const token = localStorage.getItem('token')
  socket = io(window.location.origin, {
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnectionAttempts: 5
  })
  socket.on('connect_error', (err) => {
    console.warn('Realtime connect_error', err.message)
  })
  return socket
}

export function disconnectRealtime() {
  if (!socket) return
  try { socket.disconnect() } catch (e) {}
  socket = null
}

export default {
  connectRealtime,
  disconnectRealtime
}
