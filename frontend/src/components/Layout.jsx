import { useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { connectRealtime } from '../realtime'
import api from '../api'
import { FiGrid, FiTag, FiBarChart2, FiFileText, FiClipboard, FiUsers, FiServer, FiMail, FiSettings, FiShield, FiFilePlus, FiGlobe, FiZap, FiLayers, FiBell, FiLogOut } from 'react-icons/fi'

const primaryItems = [
  { to: '/', label: 'Dashboard', icon: FiGrid },
  { to: '/alerts', label: 'Live alerts', icon: FiBell },
  { to: '/tags', label: 'Daily inventory', icon: FiTag },
  { to: '/summary-report', label: 'Summary report', icon: FiBarChart2 },
  { to: '/full-report', label: 'Full report', icon: FiFileText },
  { to: '/audit', label: 'Audit trail', icon: FiClipboard }
]

function NavItem({ item }) {
  const Icon = item.icon
  return (
    <NavLink
      to={item.to}
      end={item.to === '/'}
      className={({ isActive }) => `cc-nav-link ${isActive ? 'cc-nav-link--active' : ''}`}
    >
      <span className="cc-nav-icon"><Icon size={18} /></span>
      <span className="cc-nav-label">{item.label}</span>
    </NavLink>
  )
}

export default function Layout({ user, onLogout, siteId, onSiteChange, children }) {
  const [clock, setClock] = useState(new Date())
  const [menuOpen, setMenuOpen] = useState(false)
  const [sites, setSites] = useState([])
  const [connectionStatus, setConnectionStatus] = useState('connecting')

  useEffect(() => { const timer = setInterval(() => setClock(new Date()), 1000); return () => clearInterval(timer) }, [])
  useEffect(() => { api.get('/api/zones').then(response => setSites(response.data)).catch(() => setSites([])) }, [])

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

  const statusLabel = connectionStatus === 'connected' ? 'Live'
    : connectionStatus === 'connecting' ? 'Connecting…'
    : 'Offline'

  return (
    <div className="cc-layout">
      {/* Sidebar */}
      <aside className={`cc-sidebar ${menuOpen ? 'cc-sidebar--open' : ''}`}>
        {/* Brand */}
        <div className="cc-sidebar-brand">
          <div className="cc-sidebar-logo">
            <img src="/logo.png?v=1" alt="RFID Inventory logo" />
          </div>
          <div className="cc-sidebar-brand-text">
            <h1>RFID Inventory</h1>
            <p>Lab operations</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="cc-sidebar-nav" aria-label="Application navigation">
          {primaryItems.map(item => <NavItem key={item.to} item={item} />)}
          {isAdmin ? (
            <>
              <div className="cc-nav-section">Administration</div>
              <NavItem item={{ to: '/users', label: 'Admin', icon: FiShield }} />
              <NavItem item={{ to: '/devices', label: 'Device', icon: FiServer }} />
              <NavItem item={{ to: '/recipients', label: 'Recipients', icon: FiMail }} />
              <NavItem item={{ to: '/settings', label: 'Settings', icon: FiSettings }} />
              <NavItem item={{ to: '/manage-roles', label: 'Manage roles', icon: FiUsers }} />
              <NavItem item={{ to: '/report-builder', label: 'Report builder', icon: FiFilePlus }} />
              <NavItem item={{ to: '/manage-sites', label: 'Manage sites', icon: FiGlobe }} />
              <NavItem item={{ to: '/simulator', label: 'Simulator', icon: FiTag }} />
              <div className="cc-nav-section">Alert groups</div>
              <NavItem item={{ to: '/alert-flows', label: 'Alert flows', icon: FiZap }} />
              <NavItem item={{ to: '/device-groups', label: 'Device groups', icon: FiLayers }} />
              <NavItem item={{ to: '/alert-target-groups', label: 'Target groups', icon: FiBell }} />
            </>
          ) : (
            <>
              <div className="cc-nav-section">Administration</div>
              <button className="cc-nav-link cc-nav-link--locked" disabled title="Administrator access required">
                <span className="cc-nav-icon"><FiShield size={18} /></span>
                <span className="cc-nav-label">Admin</span>
              </button>
              <button className="cc-nav-link cc-nav-link--locked" disabled title="Administrator access required">
                <span className="cc-nav-icon"><FiServer size={18} /></span>
                <span className="cc-nav-label">Device</span>
              </button>
              <button className="cc-nav-link cc-nav-link--locked" disabled title="Administrator access required">
                <span className="cc-nav-icon"><FiUsers size={18} /></span>
                <span className="cc-nav-label">Manage roles</span>
              </button>
              <button className="cc-nav-link cc-nav-link--locked" disabled title="Administrator access required">
                <span className="cc-nav-icon"><FiFilePlus size={18} /></span>
                <span className="cc-nav-label">Report builder</span>
              </button>
              <div className="cc-nav-section">Alert groups</div>
              <button className="cc-nav-link cc-nav-link--locked" disabled title="Administrator access required">
                <span className="cc-nav-icon"><FiZap size={18} /></span>
                <span className="cc-nav-label">Alert flows</span>
              </button>
              <button className="cc-nav-link cc-nav-link--locked" disabled title="Administrator access required">
                <span className="cc-nav-icon"><FiLayers size={18} /></span>
                <span className="cc-nav-label">Device groups</span>
              </button>
              <button className="cc-nav-link cc-nav-link--locked" disabled title="Administrator access required">
                <span className="cc-nav-icon"><FiBell size={18} /></span>
                <span className="cc-nav-label">Target groups</span>
              </button>
            </>
          )}
        </nav>

        {/* Logout */}
        <button className="cc-sidebar-logout" onClick={onLogout}>
          <span className="cc-nav-icon"><FiLogOut size={18} /></span>
          <span className="cc-nav-label">Logout</span>
        </button>
      </aside>

      {/* Main content area */}
      <div className="cc-shell-main">
        {/* Top bar */}
        <header className="cc-topbar">
          <button className="cc-menu-btn" onClick={() => setMenuOpen(!menuOpen)} aria-label="Toggle navigation">
            ☰
          </button>
          <div className="cc-topbar-spacer" />

          {/* Live status badge */}
          <div className={`cc-live-badge ${connectionStatus === 'connected' ? 'cc-live-badge--live' : ''}`}>
            <span className={`cc-live-dot ${connectionStatus !== 'connected' ? 'cc-live-dot--inactive' : ''}`} />
            {statusLabel}
          </div>

          {/* Site selector */}
          <label className="cc-site-label" htmlFor="active-site">Site</label>
          <select id="active-site" className="cc-site-select" value={siteId} onChange={changeSite}>
            <option value="all-sites">All Sites</option>
            {sites.map(site => <option key={site._id} value={site._id}>{site.name}</option>)}
          </select>

          {/* User info */}
          <span className="cc-topbar-user">{user?.username || 'Operator'}</span>
          <time className="cc-topbar-clock">{formattedClock}</time>

          {/* Logout button */}
          <button className="cc-topbar-logout" onClick={onLogout} aria-label="Logout">↪</button>
        </header>

        {/* Page content */}
        <main className="cc-main-content">{children}</main>
      </div>

      <style>{`
        /* ─── Layout Structure ──────────────────────────────────── */
        .cc-layout {
          display: flex;
          min-height: 100vh;
          background: #f3f5fa;
        }

        /* ─── Sidebar (deep navy, matches login palette) ─────────── */
        .cc-sidebar {
          width: 244px;
          min-width: 244px;
          background: linear-gradient(180deg, #151c2e 0%, #0e1422 60%, #0b101c 100%);
          border-right: 1px solid rgba(255, 255, 255, 0.07);
          color: white;
          display: flex;
          flex-direction: column;
          overflow-y: auto;
          overflow-x: hidden;
          transition: width var(--cc-transition-smooth),
                      min-width var(--cc-transition-smooth);
        }

        .cc-sidebar-brand {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 1rem;
          min-height: 64px;
          background: rgba(255, 255, 255, 0.04);
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        }

        .cc-sidebar-logo {
          width: 36px;
          height: 36px;
          border-radius: 10px;
          background: linear-gradient(135deg, #2f67f6, #1a4ad4);
          border: 1px solid rgba(255, 255, 255, 0.15);
          box-shadow: 0 4px 16px rgba(47, 103, 246, 0.35);
          display: grid;
          place-items: center;
          flex-shrink: 0;
        }

        .cc-sidebar-logo img {
          width: 100%;
          height: 100%;
          object-fit: contain;
          display: block;
        }

        .cc-sidebar-brand-text h1 {
          margin: 0;
          font-size: 0.95rem;
          font-weight: 600;
          color: rgba(255,255,255,0.95);
          line-height: 1.2;
        }

        .cc-sidebar-brand-text p {
          margin: 0.1rem 0 0;
          font-size: 0.72rem;
          color: rgba(255, 255, 255, 0.45);
        }

        /* ─── Navigation Links ──────────────────────────────────── */
        .cc-sidebar-nav {
          flex: 1;
          padding: 0.75rem 0.5rem;
          display: flex;
          flex-direction: column;
          gap: 0.15rem;
        }

        .cc-nav-link {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.7rem 0.8rem;
          border-radius: 10px;
          color: rgba(255,255,255,0.65);
          font-weight: 500;
          font-size: 0.88rem;
          text-decoration: none;
          transition: all var(--cc-transition-fast);
          border: none;
          background: transparent;
          cursor: pointer;
          width: 100%;
          text-align: left;
        }

        .cc-nav-link:hover {
          background: rgba(47, 103, 246, 0.18);
          color: rgba(255,255,255,0.95);
        }

        .cc-nav-link--active {
          background: linear-gradient(90deg, rgba(47, 103, 246, 0.55), rgba(47, 103, 246, 0.16)) !important;
          color: #ffffff !important;
          font-weight: 600;
          box-shadow: inset 3px 0 0 #7da2ff, 0 4px 18px rgba(47, 103, 246, 0.28);
        }

        .cc-nav-link--locked {
          opacity: 0.4;
          cursor: not-allowed;
        }

        .cc-nav-link--locked:disabled {
          opacity: 0.4;
        }

        .cc-nav-icon {
          width: 1.2rem;
          display: inline-flex;
          justify-content: center;
          flex-shrink: 0;
        }

        .cc-nav-label {
          white-space: nowrap;
          overflow: hidden;
        }

        .cc-nav-section {
          margin: 0.85rem 0.75rem 0.4rem;
          color: rgba(255, 255, 255, 0.38);
          font-size: 0.66rem;
          letter-spacing: 0.12em;
          font-weight: 700;
          text-transform: uppercase;
        }

        /* ─── Logout Button ─────────────────────────────────────── */
        .cc-sidebar-logout {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.75rem 0.8rem;
          margin: 0.5rem;
          border-radius: 10px;
          background: transparent;
          border: none;
          color: rgba(255,255,255,0.5);
          font-weight: 600;
          cursor: pointer;
          transition: all var(--cc-transition-fast);
        }

        .cc-sidebar-logout:hover {
          background: rgba(239, 68, 68, 0.15);
          color: #fca5a5;
        }

        /* ─── Main Content Area ─────────────────────────────────── */
        .cc-shell-main {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
          background: #f5f5f5;
        }

        /* ─── Top Bar ───────────────────────────────────────────── */
        .cc-topbar {
          height: 56px;
          background: rgba(255, 255, 255, 0.86);
          backdrop-filter: blur(14px);
          -webkit-backdrop-filter: blur(14px);
          border-bottom: 1px solid rgba(15, 23, 42, 0.07);
          box-shadow: 0 1px 0 rgba(15, 23, 42, 0.02), 0 6px 22px rgba(15, 23, 42, 0.05);
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0 1.4rem;
          color: var(--cc-text-primary);
          position: sticky;
          top: 0;
          z-index: 40;
        }

        .cc-menu-btn {
          display: none;
          border: 0;
          background: transparent;
          color: var(--cc-text-primary);
          font-size: 1.25rem;
          padding: 0.25rem;
          cursor: pointer;
        }

        .cc-topbar-spacer {
          flex: 1;
        }

        .cc-site-label {
          font-size: 0.78rem;
          color: var(--cc-text-secondary);
        }

        .cc-site-select {
          background: #ffffff;
          border: 1px solid rgba(15, 23, 42, 0.12);
          border-radius: 10px;
          padding: 0.4rem 0.7rem;
          font-size: 0.85rem;
          font-weight: 500;
          color: var(--cc-text-primary);
          cursor: pointer;
          box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
          transition: border-color 200ms ease, box-shadow 200ms ease;
        }

        .cc-site-select:focus {
          outline: none;
          border-color: #2f67f6;
          box-shadow: 0 0 0 3px rgba(47, 103, 246, 0.12);
        }

        .cc-site-select option {
          background: #ffffff;
          color: var(--cc-text-primary);
        }

        .cc-topbar-user {
          font-weight: 600;
          font-size: 0.88rem;
          color: var(--cc-text-primary);
        }

        .cc-topbar-clock {
          font-variant-numeric: tabular-nums;
          font-weight: 600;
          font-size: 0.85rem;
          color: var(--cc-text-secondary);
          white-space: nowrap;
        }

        .cc-theme-toggle {
          border: 0;
          background: rgba(0, 0, 0, 0.06);
          color: var(--cc-text-primary);
          width: 32px;
          height: 32px;
          border-radius: 8px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all var(--cc-transition-fast);
        }

        .cc-theme-toggle:hover {
          background: rgba(0, 0, 0, 0.12);
          color: var(--cc-accent);
        }

        .cc-topbar-logout {
          border: 0;
          background: transparent;
          color: var(--cc-text-secondary);
          font-size: 1.15rem;
          padding: 0.25rem;
          cursor: pointer;
          transition: color var(--cc-transition-fast);
        }

        .cc-topbar-logout:hover {
          color: #b91c1c;
        }

        /* ─── Main Content ──────────────────────────────────────── */
        .cc-main-content {
          flex: 1;
          padding: 1.5rem;
          overflow: auto;
          background: #f3f5fa;
        }

        /* ─── Live Badge Variants ───────────────────────────────── */
        .cc-live-badge--live {
          border-color: rgba(47, 103, 246, 0.45);
          box-shadow: 0 0 0 4px rgba(47, 103, 246, 0.06);
          color: #1d4ed8;
        }

        .cc-live-badge--live .cc-live-dot {
          background: #22c55e;
        }

        .cc-live-dot--inactive {
          background: #f59e0b;
          animation: none;
        }

        /* ─── Mobile Responsive ─────────────────────────────────── */
        @media (max-width: 960px) {
          .cc-layout {
            flex-direction: column;
          }

          .cc-sidebar {
            position: fixed;
            z-index: 100;
            left: -260px;
            top: 0;
            bottom: 0;
            width: 260px;
            min-width: 260px;
            transition: left 250ms cubic-bezier(0.4, 0, 0.2, 1);
          }

          .cc-sidebar--open {
            left: 0;
            box-shadow: 12px 0 40px rgba(0, 0, 0, 0.4);
          }

          .cc-menu-btn {
            display: inline-flex;
          }
        }

        @media (max-width: 640px) {
          .cc-live-badge,
          .cc-site-label,
          .cc-site-select,
          .cc-topbar-user {
            display: none;
          }
        }

        /* ─── Sidebar scrollbar ─────────────────────────────────── */
        .cc-sidebar::-webkit-scrollbar {
          width: 6px;
        }
        .cc-sidebar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.14);
          border-radius: 999px;
        }
        .cc-sidebar::-webkit-scrollbar-thumb:hover {
          background: rgba(47, 103, 246, 0.5);
        }


      `}</style>
    </div>
  )
}
