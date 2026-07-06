import axios from 'axios'

const api = axios.create()

// Attach token from localStorage for every request (reads fresh value at request time)
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers = { ...(config.headers || {}), Authorization: `Bearer ${token}` }
  return config
})

// Global response handler: on 401 clear token and reload to prompt login
api.interceptors.response.use(
  r => r,
  (error) => {
    if (error?.response?.status === 401) {
      try {
        localStorage.removeItem('token')
      } catch (e) {}
      // Force full reload so App.js re-checks token and shows login
      if (typeof window !== 'undefined') window.location.reload()
    }
    return Promise.reject(error)
  }
)

export default api
