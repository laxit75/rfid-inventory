import { useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'
import api from '../api'

const primaryItems = [
  { to: '/', label: 'Dashboard', icon: '▦' },
  { to: '/tags', label: 'Daily inventory', icon: '◷' },
  { to: '/summary-report', label: 'Summary report', icon: '▤' },
  { to: '/full-report', label: 'Full report', icon: '▧' },
  { to: '/audit', label: 'Audit trail', icon: '◫' }
]

function NavItem({ item }) {
  return <NavLink to={item.to} end={item.to === '/'} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}><span className="nav-icon">{item.icon}</span><span>{item.label}</span></NavLink>
}

export default function Layout({ user, onLogout, testingMode, onTestingModeChange, siteId, onSiteChange, children }) {
  const [clock, setClock] = useState(new Date())
  const [menuOpen, setMenuOpen] = useState(false)
  const [sites, setSites] = useState([])
  useEffect(() => { const timer = setInterval(() => setClock(new Date()), 1000); return () => clearInterval(timer) }, [])
  useEffect(() => { api.get('/api/zones').then(response => setSites(response.data)).catch(() => setSites([])) }, [])
  const formattedClock = clock.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  const changeSite = (event) => { localStorage.setItem('rfid-active-site', event.target.value); onSiteChange(event.target.value) }
  const isAdmin = user?.role === 'ADMIN'

  return <div className="app-container admin-shell">
    <aside className={`sidebar ${menuOpen ? 'open' : ''}`}>
      <div className="sidebar-brand"><div className="brand-mark">RF</div><div><h1>RFID Inventory</h1><p>Lab operations</p></div></div>
      <nav className="nav-links" aria-label="Application navigation">
        {primaryItems.map(item => <NavItem key={item.to} item={item} />)}
        {isAdmin ? <>
          <div className="nav-section">Administration</div>
          <NavItem item={{ to: '/users', label: 'Admin', icon: '◇' }} />
          <NavItem item={{ to: '/devices', label: 'Device', icon: '▱' }} />
          <NavItem item={{ to: '/recipients', label: 'Recipients', icon: '✉' }} />
          <NavItem item={{ to: '/settings', label: 'Settings', icon: '⚙' }} />
          <NavItem item={{ to: '/manage-roles', label: 'Manage roles', icon: '◇' }} />
          <NavItem item={{ to: '/report-builder', label: 'Report builder', icon: '▧' }} />
          <NavItem item={{ to: '/manage-sites', label: 'Manage sites', icon: '＋' }} />
          <button className={`testing-mode-toggle ${testingMode ? 'enabled' : ''}`} onClick={() => onTestingModeChange(!testingMode)}><span className="nav-icon">⌁</span><span>Testing mode: {testingMode ? 'On' : 'Off'}</span></button>
          {testingMode && <NavItem item={{ to: '/simulator', label: 'Simulator', icon: '◉' }} />}
        </> : <>
          <div className="nav-section">Administration</div>
          <button className="nav-link nav-link-locked" disabled title="Administrator access required"><span className="nav-icon">◇</span><span>Admin</span></button>
          <button className="nav-link nav-link-locked" disabled title="Administrator access required"><span className="nav-icon">▱</span><span>Device</span></button>
          <button className="nav-link nav-link-locked" disabled title="Administrator access required"><span className="nav-icon">◇</span><span>Manage roles</span></button>
          <button className="nav-link nav-link-locked" disabled title="Administrator access required"><span className="nav-icon">▧</span><span>Report builder</span></button>
        </>}
      </nav>
      <button className="sidebar-logout" onClick={onLogout}><span className="nav-icon">↪</span><span>Logout</span></button>
    </aside>
    <div className="shell-main">
      <header className="topbar">
        <button className="menu-button" onClick={() => setMenuOpen(!menuOpen)} aria-label="Toggle navigation">☰</button>
        <div className="topbar-spacer" />
        <span className="socket-status"><i /> Socket: Live</span>
        <label className="site-label" htmlFor="active-site">Site</label><select id="active-site" className="site-select" value={siteId} onChange={changeSite}><option value="all-sites">All Sites</option>{sites.map(site => <option key={site._id} value={site._id}>{site.name}</option>)}</select>
        <span className="welcome">Welcome, {user?.username || 'Operator'}</span><time>{formattedClock}</time>
        <button className="topbar-logout" onClick={onLogout} aria-label="Logout">↪</button>
      </header>
      <main className="main-content">{children}</main>
    </div>
  </div>
}
