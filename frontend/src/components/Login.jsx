import { useState } from 'react'
import axios from 'axios'

export default function Login({ onLogin }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await axios.post('/api/auth/login', { username, password })
      onLogin(res.data.token, res.data.user)
    } catch (err) {
      setError('Login failed. Check credentials.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-container login-screen">
      <form onSubmit={handleSubmit} className="login-form">
        <div className="login-avatar">RF</div>
        <p className="eyebrow">Secure operations</p>
        <h2>Welcome back</h2>
        <p className="page-subtitle">Sign in to view live inventory activity, devices, and reports.</p>
        {error && <div className="inline-banner error">{error}</div>}
        <label className="field-group">
          <span>Username</span>
          <input type="text" placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} required />
        </label>
        <label className="field-group">
          <span>Password</span>
          <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </label>
        <button className="button login-submit" type="submit" disabled={loading}>{loading ? 'Signing in…' : 'Log in to dashboard'}</button>
        <div className="login-note"><span>RFID Inventory</span><span>Secure lab access</span></div>
        <p className="hint">Default admin: admin / admin123</p>
      </form>
    </div>
  )
}
