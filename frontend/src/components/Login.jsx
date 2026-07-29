import { useState } from 'react'
import axios from 'axios'

export default function Login({ onLogin }) {
  const [username, setUsername] = useState('admin')
  const [password, setPassword] = useState('admin123')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await axios.post('/api/auth/login', { username, password })
      onLogin(res.data.token, res.data.user)
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed. Check credentials.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="app-login">
      {/* Animated glow effects inspired by sw attendance system */}
      <div className="login-glow login-glow--one" />
      <div className="login-glow login-glow--two" />
      <form className="login-card" onSubmit={handleSubmit}>
        <div className="login-chip">RFID Inventory</div>
        <h2 style={{ margin: 0 }}>Welcome back</h2>
        <p style={{ margin: '0.2rem 0 0', color: '#4E4B66' }}>Sign in to view live inventory activity, devices, and reports.</p>
        {error && <div className="inline-error">{error}</div>}
        <label className="field-block">
          <span>Username</span>
          <input type="text" placeholder="Enter your username" value={username} onChange={(e) => setUsername(e.target.value)} required autoFocus />
        </label>
        <label className="field-block">
          <span>Password</span>
          <input type={showPassword ? 'text' : 'password'} placeholder="Enter your password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </label>
        <label className="field-inline-toggle">
          <input type="checkbox" checked={showPassword} onChange={(e) => setShowPassword(e.target.checked)} />
          <span>Show password</span>
        </label>
        <button className="btn btn-primary" type="submit" disabled={loading}>
          {loading ? 'Signing in…' : 'Log in to dashboard'}
        </button>
        <div className="login-footer">
          <span>RFID Inventory</span>
          <span>Secure lab access</span>
        </div>
        <p className="login-hint">Default admin: admin / admin123</p>
      </form>
    </div>
  )
}
