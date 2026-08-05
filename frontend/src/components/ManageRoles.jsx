import { useEffect, useState } from 'react'
import api from '../api'

const roles = ['ADMIN', 'OPERATOR', 'USER', 'ZONE_MANAGER', 'AUDITOR', 'INTEGRATION']

const roleColors = {
  ADMIN: { bg: '#dbeafe', text: '#1e40af', border: '#93c5fd' },
  OPERATOR: { bg: '#dcfce7', text: '#166534', border: '#86efac' },
  USER: { bg: '#f3e8ff', text: '#6b21a8', border: '#c4b5fd' },
  ZONE_MANAGER: { bg: '#fef3c7', text: '#92400e', border: '#fcd34d' },
  AUDITOR: { bg: '#ffe4e6', text: '#9f1239', border: '#fda4af' },
  INTEGRATION: { bg: '#e0f2fe', text: '#075985', border: '#7dd3fc' }
}

export default function ManageRoles() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const load = () => api.get('/api/users').then(response => setUsers(response.data)).catch(() => setMessage('Unable to load role assignments.')).finally(() => setLoading(false))
  useEffect(() => { load() }, [])
  const changeRole = async (id, role) => { try { await api.patch(`/api/users/${id}`, { role }); setMessage('Role assignment updated.'); load() } catch { setMessage('Unable to update role.') } }

  return (
    <div className="page-shell">
      <div className="page-head">
        <div>
          <p className="eyebrow">Administration</p>
          <h2>Manage roles</h2>
          <p className="page-subtitle">Assign the right level of access to RFID lab staff and integrations.</p>
        </div>
      </div>
      {message && <div className="inline-banner info">{message}</div>}

      <section className="content-card">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '0.75rem' }}>
          {roles.map(role => {
            const count = users.filter(u => u.role === role).length
            const colors = roleColors[role] || { bg: '#f1f5f9', text: '#334155', border: '#cbd5e1' }
            return (
              <div key={role} style={{
                background: colors.bg,
                border: `1px solid ${colors.border}`,
                borderRadius: 10,
                padding: '0.75rem 1rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.25rem'
              }}>
                <span style={{ fontSize: '0.7rem', fontWeight: 700, color: colors.text, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {role.replace('_', ' ')}
                </span>
                <span style={{ fontSize: '1.5rem', fontWeight: 700, color: colors.text, lineHeight: 1 }}>
                  {count}
                </span>
                <span style={{ fontSize: '0.75rem', color: colors.text, opacity: 0.7 }}>
                  {count === 1 ? 'user' : 'users'} assigned
                </span>
              </div>
            )
          })}
        </div>
      </section>

      <section className="content-card">
        <div className="card-header">
          <div>
            <h3>Role assignments</h3>
            <p className="card-copy">Changes apply immediately to the selected user.</p>
          </div>
        </div>
        {loading ? (
          <div className="loading-state">Loading roles…</div>
        ) : (
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Current role</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {users.map(user => (
                  <tr key={user._id}>
                    <td>{user.username}</td>
                    <td>
                      <select value={user.role} onChange={event => changeRole(user._id, event.target.value)}>
                        {roles.map(role => <option key={role}>{role}</option>)}
                      </select>
                    </td>
                    <td>
                      <span className={`status-pill ${user.active ? 'success' : 'neutral'}`}>
                        {user.active ? 'ACTIVE' : 'INACTIVE'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
