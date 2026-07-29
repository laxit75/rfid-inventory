import { io } from 'socket.io-client'
import api from './api'

let socket = null
let refreshPromise = null

function getRealtimeUrl() {
  if (typeof window === 'undefined') return '/'
  if (import.meta.env.DEV) {
    return 'http://localhost:5000'
  }
  return window.location.origin
}

export function connectRealtime() {
  const token = localStorage.getItem('token')

  if (socket) {
    if (socket.connected) return socket
    socket.auth = socket.auth || {}
    socket.auth.token = token
    try { socket.connect() } catch (e) {}
    return socket
  }

  socket = io(getRealtimeUrl(), {
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000
  })

  socket.on('connect_error', async (err) => {
    console.warn('Realtime connect_error', err?.message)
    const msg = (err && err.message) || ''

    // If the server rejects the handshake due to expired/invalid JWT,
    // attempt a token refresh once and re-connect using the new token.
    if (msg.toLowerCase().includes('jwt expired') || msg.toLowerCase().includes('unauthorized') || msg.toLowerCase().includes('authentication required')) {
      if (!refreshPromise) {
        refreshPromise = (async () => {
          try {
            const current = localStorage.getItem('token')
            const res = await api.post('/api/auth/refresh', { token: current })
            const newToken = res?.data?.token
            if (!newToken) throw new Error('No token returned from refresh')

            // Persist and update axios defaults
            localStorage.setItem('token', newToken)
            api.defaults.headers = api.defaults.headers || {}
            api.defaults.headers.common = api.defaults.headers.common || {}
            api.defaults.headers.common.Authorization = `Bearer ${newToken}`

            // Re-auth the socket and reconnect
            socket.auth = socket.auth || {}
            socket.auth.token = newToken
            try { socket.connect() } catch (e) {}
          } catch (e) {
            console.error('Realtime token refresh failed', e)
            // If refresh fails, clear token and force a reload/login
            try { localStorage.removeItem('token') } catch (e) {}
            try { delete api.defaults.headers.common.Authorization } catch (e) {}
            window.location.reload()
          } finally {
            refreshPromise = null
          }
        })()
      } else {
        try { await refreshPromise } catch (e) {}
      }
    }
  })

  socket.on('connect', () => {})
  socket.on('disconnect', () => {})

  return socket
}

export function disconnectRealtime() {
  if (!socket) return
  try { socket.disconnect() } catch (e) {}
  socket = null
  refreshPromise = null
}

export default {
  connectRealtime,
  disconnectRealtime
}
