import { NavLink } from 'react-router-dom'

const navItems = [
  { to: '/', label: 'Dashboard', icon: '📊' },
  { to: '/simulator', label: 'Simulator', icon: '🧪' },
  { to: '/tags', label: 'Tags', icon: '🏷️' },
  { to: '/audit', label: 'Audit Log', icon: '🧾' }
]

export default function Layout({ user, onLogout, children }) {
  return (
    <div className="app-container">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="brand-mark">RF</div>
          <div>
            <h1>RFID Inventory</h1>
            <p>{user?.role || 'Operator'}</p>
          </div>
        </div>

        <nav className="nav-links">
          {navItems.map(item => (
            <NavLink key={item.to} to={item.to} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
          {user?.role === 'ADMIN' && (
            <>
              <NavLink to="/settings" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                <span>⚙️</span><span>Settings</span>
              </NavLink>
              <NavLink to="/recipients" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                <span>📧</span><span>Recipients</span>
              </NavLink>
              <NavLink to="/users" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                <span>👥</span><span>Users</span>
              </NavLink>
            </>
          )}
        </nav>

        <div className="sidebar-footer">
          <div className="user-chip">
            <strong>{user?.username}</strong>
            <span>{user?.role}</span>
          </div>
          <button className="button button-ghost" onClick={onLogout}>Logout</button>
        </div>
      </aside>

      <main className="main-content">
        {children}
      </main>
    </div>
  )
}