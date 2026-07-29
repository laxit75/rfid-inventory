import { useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { connectRealtime } from '../realtime'
import api from '../api'
import { FiGrid, FiTag, FiBarChart2, FiFileText, FiClipboard, FiUsers, FiServer, FiMail, FiSettings, FiShield, FiFilePlus, FiGlobe, FiZap, FiLayers, FiBell, FiLogOut, FiMoon, FiSun } from 'react-icons/fi'

const primaryItems = [
  { to: '/', label: 'Dashboard', icon: FiGrid },
  { to: '/tags', label: 'Daily inventory', icon: FiTag },
  { to: '/summary-report', label: 'Summary report', icon: FiBarChart2 },
  { to: '/full-report', label: 'Full report', icon: FiFileText },
  { to: '/audit', label: 'Audit trail', icon: FiClipboard }
]

function NavItem({ item }) {
  const Icon = item.icon
  return <NavLink to={item.to} end={item.to === '/'} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}><span className="nav-icon"><Icon size={18} /></span><span>{item.label}</span></NavLink>
}

export default function Layout({ user, onLogout, testingMode, onTestingModeChange, siteId, onSiteChange, children }) {
  const [clock, setClock] = useState(new Date())
  const [menuOpen, setMenuOpen] = useState(false)
  const [sites, setSites] = useState([])
  const [connectionStatus, setConnectionStatus] = useState('connecting')
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem('rfid-theme')
    if (saved) return saved === 'dark'
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  })

  useEffect(() => { const timer = setInterval(() => setClock(new Date()), 1000); return () => clearInterval(timer) }, [])
  useEffect(() => { api.get('/api/zones').then(response => setSites(response.data)).catch(() => setSites([])) }, [])

  // Track realtime connection status for the status badge
  useEffect(() => {
    const sock = connectRealtime()
    const handleConnect = () => setConnectionStatus('connected')
    const handleDisconnect = () => setConnectionStatus('disconnected')
    const handleError = () => setConnectionStatus('disconnected')

    if (sock.connected) {
      setConnectionStatus('connected')
    } else {
      setConnectionStatus('connecting')
    }

    sock.on('connect', handleConnect)
    sock.on('disconnect', handleDisconnect)
    sock.on('connect_error', handleError)

    return () => {
      try { sock.off('connect', handleConnect) } catch (e) {}
      try { sock.off('disconnect', handleDisconnect) } catch (e) {}
      try { sock.off('connect_error', handleError) } catch (e) {}
    }
  }, [])

  const formattedClock = clock.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  const changeSite = (event) => { localStorage.setItem('rfid-active-site', event.target.value); onSiteChange(event.target.value) }
  const isAdmin = user?.role === 'ADMIN'

  const toggleTheme = () => {
    const next = !isDark
    setIsDark(next)
    localStorage.setItem('rfid-theme', next ? 'dark' : 'light')
    document.documentElement.setAttribute('data-theme', next ? 'dark' : 'light')
  }

  // Apply theme on mount
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light')
  }, [isDark])

  const statusLabel = connectionStatus === 'connected' ? 'Live'
    : connectionStatus === 'connecting' ? 'Connecting…'
    : 'Offline'

  return <div className="app-container admin-shell">
    <aside className={`sidebar ${menuOpen ? 'open' : ''}`}>
      <div className="sidebar-brand"><div className="brand-mark">RF</div><div><h1>RFID Inventory</h1><p>Lab operations</p></div></div>
      <nav className="nav-links" aria-label="Application navigation">
        {primaryItems.map(item => <NavItem key={item.to} item={item} />)}
        {isAdmin ? <>
          <div className="nav-section">Administration</div>
          <NavItem item={{ to: '/users', label: 'Admin', icon: FiShield }} />
          <NavItem item={{ to: '/devices', label: 'Device', icon: FiServer }} />
          <NavItem item={{ to: '/recipients', label: 'Recipients', icon: FiMail }} />
          <NavItem item={{ to: '/settings', label: 'Settings', icon: FiSettings }} />
          <NavItem item={{ to: '/manage-roles', label: 'Manage roles', icon: FiUsers }} />
          <NavItem item={{ to: '/report-builder', label: 'Report builder', icon: FiFilePlus }} />
          <NavItem item={{ to: '/manage-sites', label: 'Manage sites', icon: FiGlobe }} />
          <button className={`testing-mode-toggle ${testingMode ? 'enabled' : ''}`} onClick={() => onTestingModeChange(!testingMode)}><span className="nav-icon"><FiZap size={18} /></span><span>Testing mode: {testingMode ? 'On' : 'Off'}</span></button>
          <div className="nav-section">Alert groups</div>
          <NavItem item={{ to: '/alert-flows', label: 'Alert flows', icon: FiZap }} />
          <NavItem item={{ to: '/device-groups', label: 'Device groups', icon: FiLayers }} />
          <NavItem item={{ to: '/alert-target-groups', label: 'Target groups', icon: FiBell }} />
          {testingMode && <NavItem item={{ to: '/simulator', label: 'Simulator', icon: FiTag }} />}
        </> : <>
          <div className="nav-section">Administration</div>
          <button className="nav-link nav-link-locked" disabled title="Administrator access required"><span className="nav-icon"><FiShield size={18} /></span><span>Admin</span></button>
          <button className="nav-link nav-link-locked" disabled title="Administrator access required"><span className="nav-icon"><FiServer size={18} /></span><span>Device</span></button>
          <button className="nav-link nav-link-locked" disabled title="Administrator access required"><span className="nav-icon"><FiUsers size={18} /></span><span>Manage roles</span></button>
          <button className="nav-link nav-link-locked" disabled title="Administrator access required"><span className="nav-icon"><FiFilePlus size={18} /></span><span>Report builder</span></button>
          <div className="nav-section">Alert groups</div>
          <button className="nav-link nav-link-locked" disabled title="Administrator access required"><span className="nav-icon"><FiZap size={18} /></span><span>Alert flows</span></button>
          <button className="nav-link nav-link-locked" disabled title="Administrator access required"><span className="nav-icon"><FiLayers size={18} /></span><span>Device groups</span></button>
          <button className="nav-link nav-link-locked" disabled title="Administrator access required"><span className="nav-icon"><FiBell size={18} /></span><span>Target groups</span></button>
        </>}
      </nav>
      <button className="sidebar-logout" onClick={onLogout}><span className="nav-icon"><FiLogOut size={18} /></span><span>Logout</span></button>
    </aside>
    <div className="shell-main">
      <header className="topbar">
        <button className="menu-button" onClick={() => setMenuOpen(!menuOpen)} aria-label="Toggle navigation">☰</button>
        <div className="topbar-spacer" />
        <span className={`socket-status ${connectionStatus}`}><i /> {statusLabel}</span>
        <label className="site-label" htmlFor="active-site">Site</label><select id="active-site" className="site-select" value={siteId} onChange={changeSite}><option value="all-sites">All Sites</option>{sites.map(site => <option key={site._id} value={site._id}>{site.name}</option>)}</select>
        <span className="welcome">{user?.username || 'Operator'}</span><time>{formattedClock}</time>
        <button className="theme-toggle" onClick={toggleTheme} aria-label="Toggle dark mode" title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}>{isDark ? <FiSun size={16} /> : <FiMoon size={16} />}</button>
        <button className="topbar-logout" onClick={onLogout} aria-label="Logout">↪</button>
      </header>
      <main className="main-content">{children}</main>
    </div>
  </div>
}
