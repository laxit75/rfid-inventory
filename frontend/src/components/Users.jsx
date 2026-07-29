import { useState, useEffect } from 'react'
import axios from 'axios'
import ConfirmDialog from './ConfirmDialog'

export default function Users() {
  const [users, setUsers] = useState([])
  const [newUser, setNewUser] = useState({ username: '', password: '', role: 'USER' })
  const [zones, setZones] = useState([])
  const [loading, setLoading] = useState(true)
  const [formError, setFormError] = useState('')
  const [feedback, setFeedback] = useState('')
  const [saving, setSaving] = useState(false)
  const [confirmToggle, setConfirmToggle] = useState(null)

  const token = localStorage.getItem('token')

  const fetchUsers = async () => {
    setLoading(true)
    const res = await axios.get('/api/users', { headers: { Authorization: `Bearer ${token}` } })
    setUsers(res.data)
    setLoading(false)
  }

  const fetchZones = async () => {
    try {
      const res = await axios.get('/api/zones', { headers: { Authorization: `Bearer ${token}` } })
      setZones(res.data)
    } catch (err) {
      // ignore
    }
  }

  useEffect(() => { fetchUsers() }, [])
  useEffect(() => { fetchZones() }, [])

  const handleCreate = async (e) => {
    e.preventDefault()
    if (!newUser.username || !newUser.password) {
      setFormError('Username and password are required.')
      return
    }
    setSaving(true)
    setFormError('')
    try {
      const payload = { ...newUser }
      if (!payload.zones) payload.zones = []
      await axios.post('/api/users', payload, { headers: { Authorization: `Bearer ${token}` } })
      setFeedback('User created successfully.')
      setNewUser({ username: '', password: '', role: 'USER' })
      fetchUsers()
    } catch (err) {
      setFormError(err.response?.data?.error || 'Unable to create user.')
    } finally {
      setSaving(false)
    }
  }

  const handleToggleActive = async () => {
    if (!confirmToggle) return
    const { id, toActive } = confirmToggle
    setSaving(true)
    try {
      await axios.patch(`/api/users/${id}`, { active: toActive }, { headers: { Authorization: `Bearer ${token}` } })
      setConfirmToggle(null)
      setFeedback(`User ${toActive ? 'activated' : 'deactivated'} successfully.`)
      fetchUsers()
    } catch (err) {
      setFormError(err.response?.data?.error || 'Unable to change user status.')
    } finally {
      setSaving(false)
    }
  }

  const requestToggle = (id, currentActive) => {
    const targetActive = !currentActive
    if (targetActive) {
      // Activating is not destructive, do it immediately
      handleToggleActiveImmediate(id, targetActive)
    } else {
      // Deactivation is destructive, show confirmation
      setConfirmToggle({ id, toActive: false })
    }
  }

  const handleToggleActiveImmediate = async (id, toActive) => {
    setSaving(true)
    try {
      await axios.patch(`/api/users/${id}`, { active: toActive }, { headers: { Authorization: `Bearer ${token}` } })
      setFeedback('User activated successfully.')
      fetchUsers()
    } catch (err) {
      setFormError(err.response?.data?.error || 'Unable to change user status.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="page-shell">
      <ConfirmDialog
        open={!!confirmToggle}
        title="Deactivate user"
        message="This will revoke this user's access to the RFID system. They will not be able to log in until an administrator reactivates them."
        confirmLabel="Deactivate"
        destructive
        onConfirm={handleToggleActive}
        onCancel={() => setConfirmToggle(null)}
        loading={saving}
      />

      <div className="page-head">
        <div>
          <p className="eyebrow">Admin</p>
          <h2>User management</h2>
          <p className="page-subtitle">Create and manage operator access to the lab system.</p>
        </div>
        <span className="protected-badge">Password-protected</span>
      </div>

      <div className="content-card">
        {formError && <div className="inline-banner error">{formError}</div>}
        {feedback && <div className="inline-banner success">{feedback}</div>}
        <form onSubmit={handleCreate} className="form-grid">
          <label className="field-group">
            <span>Username</span>
            <input placeholder="Username" value={newUser.username} onChange={e => setNewUser({ ...newUser, username: e.target.value })} required />
          </label>
          <label className="field-group">
            <span>Password</span>
            <input type="password" placeholder="Password" value={newUser.password} onChange={e => setNewUser({ ...newUser, password: e.target.value })} required />
          </label>
          <label className="field-group">
            <span>Role</span>
            <select value={newUser.role} onChange={e => setNewUser({ ...newUser, role: e.target.value })}>
              <option value="USER">USER</option>
              <option value="OPERATOR">OPERATOR</option>
              <option value="ZONE_MANAGER">ZONE_MANAGER</option>
              <option value="AUDITOR">AUDITOR</option>
              <option value="ADMIN">ADMIN</option>
            </select>
          </label>
          {newUser.role === 'ZONE_MANAGER' && (
            <label className="field-group">
              <span>Assigned Zones</span>
              <select multiple value={newUser.zones || []} onChange={e => {
                const opts = Array.from(e.target.selectedOptions).map(o => o.value)
                setNewUser({ ...newUser, zones: opts })
              }}>
                {zones.map(z => (
                  <option key={z._id} value={z._id}>{z.name}</option>
                ))}
              </select>
            </label>
          )}
          <div className="form-actions">
            <button className="button" type="submit" disabled={saving}>{saving ? 'Creating…' : 'Create user'}</button>
          </div>
        </form>
      </div>

      <div className="content-card">
        {loading ? (
          <div className="loading-state">Loading users…</div>
        ) : users.length === 0 ? (
          <div className="empty-state">No users have been added yet.</div>
        ) : (
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Username</th>
                  <th>Role</th>
                  <th>Active</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u._id}>
                    <td>{u.username}</td>
                    <td>{u.role}{u.zones && u.zones.length > 0 ? ` (${u.zones.map(z=>z.name).join(', ')})` : ''}</td>
                    <td>{u.active ? 'Yes' : 'No'}</td>
                    <td>
                      <button className={`button ${u.active ? 'button-ghost' : 'button-secondary'}`} onClick={() => requestToggle(u._id, u.active)} disabled={saving}>
                        {u.active ? 'Deactivate' : 'Activate'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}