import { useEffect, useState } from 'react'
import api from '../api'

const roles = ['ADMIN', 'OPERATOR', 'USER', 'ZONE_MANAGER', 'AUDITOR', 'INTEGRATION']

export default function ManageRoles() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const load = () => api.get('/api/users').then(response => setUsers(response.data)).catch(() => setMessage('Unable to load role assignments.')).finally(() => setLoading(false))
  useEffect(() => { load() }, [])
  const changeRole = async (id, role) => { try { await api.patch(`/api/users/${id}`, { role }); setMessage('Role assignment updated.'); load() } catch { setMessage('Unable to update role.') } }
  return <div className="page-shell"><div className="page-head"><div><p className="eyebrow">Administration</p><h2>Manage roles</h2><p className="page-subtitle">Assign the right level of access to RFID lab staff and integrations.</p></div></div>
    {message && <div className="inline-banner info">{message}</div>}
    <section className="content-card"><div className="role-guide">{roles.map(role => <div key={role}><strong>{role}</strong><span>{users.filter(user => user.role === role).length} assigned</span></div>)}</div></section>
    <section className="content-card"><div className="card-header"><div><h3>Role assignments</h3><p className="card-copy">Changes apply immediately to the selected user.</p></div></div>{loading ? <div className="loading-state">Loading roles…</div> : <div className="table-wrapper"><table className="data-table"><thead><tr><th>User</th><th>Current role</th><th>Status</th></tr></thead><tbody>{users.map(user => <tr key={user._id}><td>{user.username}</td><td><select value={user.role} onChange={event => changeRole(user._id, event.target.value)}>{roles.map(role => <option key={role}>{role}</option>)}</select></td><td><span className={`status-pill ${user.active ? 'success' : 'neutral'}`}>{user.active ? 'ACTIVE' : 'INACTIVE'}</span></td></tr>)}</tbody></table></div>}</section>
  </div>
}
