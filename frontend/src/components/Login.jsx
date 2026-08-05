import { useState, useEffect, useRef, useCallback } from 'react'
import axios from 'axios'
import gsap from 'gsap'
import AuroraBackground from './AuroraBackground'
import SplitText from './SplitText'
import SpecularButton from './SpecularButton'
import BubbleMenu from './BubbleMenu'
import Dock from './Dock'
import { VscAccount, VscTools, VscClearAll, VscEye, VscEyeClosed } from 'react-icons/vsc'

// Demo accounts matching backend/seed.js (admin / admin123, engineer1 / user123)
const DEMO_ACCOUNTS = [
  { label: 'Admin', username: 'admin', password: 'admin123', role: 'ADMIN' },
  { label: 'Engineer', username: 'engineer1', password: 'user123', role: 'USER' }
]

const MENU_ITEMS = [
  { label: 'overview', href: '#lp-overview', ariaLabel: 'Overview', rotation: -6, hoverStyles: { bgColor: '#2f67f6', textColor: '#ffffff' } },
  { label: 'access', href: '#lp-access', ariaLabel: 'Demo access', rotation: 6, hoverStyles: { bgColor: '#10b981', textColor: '#ffffff' } },
  { label: 'support', href: '#lp-support', ariaLabel: 'Support', rotation: -6, hoverStyles: { bgColor: '#8b5cf6', textColor: '#ffffff' } }
]

export default function Login({ onLogin }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [selectedDemo, setSelectedDemo] = useState(0)
  const cardRef = useRef(null)

  // Card entry animation — transform-only (no opacity), so the card is never
  // see-through. Timeline is killed on unmount to stay safe under StrictMode.
  useEffect(() => {
    if (!cardRef.current) return
    const tl = gsap.timeline({ defaults: { ease: 'power3.out' } })
    tl.from(cardRef.current, { y: 26, scale: 0.985, duration: 0.55, delay: 0.05 })
    return () => tl.kill()
  }, [])

  const fillAccount = useCallback((index, { announce = true } = {}) => {
    const account = DEMO_ACCOUNTS[index]
    if (!account) return
    setUsername(account.username)
    setPassword(account.password)
    setSelectedDemo(index)
    setError('')
    if (announce) setNotice(`${account.label} credentials filled — ready to sign in.`)
  }, [])

  // Prefill the Admin demo account silently on mount
  useEffect(() => {
    fillAccount(0, { announce: false })
  }, [fillAccount])

  const clearForm = useCallback(() => {
    setUsername('')
    setPassword('')
    setError('')
    setNotice('')
  }, [])

  const handleSelectDemo = useCallback((index) => fillAccount(index), [fillAccount])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!username.trim()) { setError('Username is required.'); return }
    if (!password) { setError('Password is required.'); return }
    setError('')
    setNotice('')
    setLoading(true)
    try {
      const res = await axios.post('/api/auth/login', { username: username.trim(), password })
      onLogin(res.data.token, res.data.user)
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed. Please check your credentials.')
      if (cardRef.current) {
        gsap.fromTo(cardRef.current,
          { x: -8 },
          { x: 0, duration: 0.4, ease: 'elastic.out(1, 0.3)' }
        )
      }
    } finally {
      setLoading(false)
    }
  }

  const dockItems = [
    { icon: <VscAccount size={18} />, label: 'Admin demo', onClick: () => fillAccount(0) },
    { icon: <VscTools size={18} />, label: 'Engineer demo', onClick: () => fillAccount(1) },
    { icon: <VscClearAll size={18} />, label: 'Clear form', onClick: clearForm },
    { icon: showPassword ? <VscEyeClosed size={18} /> : <VscEye size={18} />, label: showPassword ? 'Hide password' : 'Show password', onClick: () => setShowPassword(v => !v) }
  ]

  return (
    <div className="lp-root" id="lp-overview">
      <AuroraBackground />

      {/* Floating bubble navigation */}
      <BubbleMenu
        logo="/logo.png?v=1"
        items={MENU_ITEMS}
        menuAriaLabel="Toggle navigation"
        menuBg="#111827"
        menuContentColor="#f5f5f5"
        useFixedPosition
        animationEase="back.out(1.6)"
        animationDuration={0.5}
        staggerDelay={0.1}
      />

      {/* Sign-in card + demo access panel */}
      <div className="lp-shell">
        <div ref={cardRef} className="lp-card" role="main">
          {/* Brand row */}
          <div className="lp-brand">
            <div className="lp-logo" aria-hidden="true">
              <img src="/logo.png?v=1" alt="RFID Inventory logo" width="22" height="22" />
            </div>
            <span className="lp-brand-name">RFID Inventory</span>
            <span className="lp-brand-badge">v2</span>
          </div>

          {/* Heading */}
          <div className="lp-heading-block">
            <SplitText
              tag="h1"
              text="Welcome back"
              className="lp-title"
              textAlign="left"
              delay={35}
              duration={0.7}
              ease="power4.out"
              splitType="chars"
              from={{ opacity: 0, y: 48, rotateX: 90, transformPerspective: 700, transformOrigin: '50% 100%' }}
              to={{ opacity: 1, y: 0, rotateX: 0 }}
            />
            <p className="lp-subtitle">
              Sign in to your operator dashboard to view live inventory, alerts, and reports.
            </p>
          </div>

          {/* Banners */}
          {error && (
            <div className="lp-error" role="alert" aria-live="assertive">
              <span className="lp-error-icon">⚠</span>
              {error}
            </div>
          )}
          {notice && (
            <div className="lp-notice" role="status">
              <span className="lp-error-icon">⚡</span>
              {notice}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="lp-form" noValidate>
            <div className="lp-field">
              <label htmlFor="lp-username" className="lp-label">Username</label>
              <div className="lp-input-wrap">
                <span className="lp-input-icon" aria-hidden="true">👤</span>
                <input
                  id="lp-username"
                  type="text"
                  className="lp-input"
                  placeholder="Enter your username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  autoFocus
                  required
                  disabled={loading}
                />
              </div>
            </div>

            <div className="lp-field">
              <label htmlFor="lp-password" className="lp-label">Password</label>
              <div className="lp-input-wrap">
                <span className="lp-input-icon" aria-hidden="true">🔑</span>
                <input
                  id="lp-password"
                  type={showPassword ? 'text' : 'password'}
                  className="lp-input"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                  disabled={loading}
                />
                <button
                  type="button"
                  className="lp-pw-toggle"
                  onClick={() => setShowPassword(v => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  tabIndex={0}
                  disabled={loading}
                >
                  {showPassword ? '🙈' : '👁'}
                </button>
              </div>
            </div>

            <SpecularButton
              type="submit"
              size="lg"
              className="lp-submit"
              disabled={loading}
              radius={14}
              tint="#1f2937"
              tintOpacity={1}
              blur={12}
              textColor="#ffffff"
              lineColor="#9db8ff"
              baseColor="#334155"
              intensity={1.15}
              shineSize={12}
              shineFade={45}
              thickness={1.1}
              speed={0.4}
              followMouse
              proximity={260}
              autoAnimate
            >
              {loading ? (
                <span className="lp-submit-loading">
                  <span className="lp-spinner" aria-hidden="true" />
                  Signing in…
                </span>
              ) : (
                'Sign in →'
              )}
            </SpecularButton>
          </form>

          {/* Footer */}
          <div className="lp-footer">
            <span>RFID Inventory System</span>
            <span>Secure · Encrypted · Monitored</span>
          </div>
        </div>

        {/* Demo access panel */}
        <aside className="lp-aside" id="lp-access">
          <p className="lp-eyebrow">Demo access</p>
          <p className="lp-aside-title">Pick a seeded account</p>

          <div className="lp-demo-list" role="group" aria-label="Demo accounts">
            {DEMO_ACCOUNTS.map((account, i) => (
              <button
                key={account.username}
                type="button"
                aria-pressed={selectedDemo === i}
                className={`lp-demo-item${selectedDemo === i ? ' lp-demo-item--active' : ''}`}
                onClick={() => handleSelectDemo(i)}
              >
                <span className="lp-demo-avatar" aria-hidden="true">{account.label[0]}</span>
                <span className="lp-demo-main">
                  <span className="lp-demo-name">{account.label}</span>
                  <span className="lp-demo-role">{account.role}</span>
                </span>
                <span className="lp-demo-check" aria-hidden="true">✓</span>
              </button>
            ))}
          </div>

          {selectedDemo != null && (
            <div className="lp-demo-creds">
              <span><span className="lp-demo-creds-key">user</span> {DEMO_ACCOUNTS[selectedDemo].username}</span>
              <span><span className="lp-demo-creds-key">pass</span> {DEMO_ACCOUNTS[selectedDemo].password}</span>
            </div>
          )}

          <p className="lp-aside-hint">
            Select an account to auto-fill the form — then sign in.
          </p>
        </aside>
      </div>

      {/* Quick-actions dock */}
      <div className="lp-dock" id="lp-support">
        <Dock items={dockItems} panelHeight={64} baseItemSize={46} magnification={64} distance={220} />
      </div>

      <style>{`
        .lp-root { scroll-behavior: smooth; }

        /* ─── Root ───────────────────────────────────────────────── */
        /* Bubble nav buttons get definition on the dark backdrop */
        .lp-root .bubble-menu .bubble {
          border: 1px solid rgba(255, 255, 255, 0.14);
          box-shadow: 0 6px 22px rgba(0, 0, 0, 0.45);
        }

        .lp-root {
          position: relative;
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: safe center;
          overflow: hidden auto;
          padding: 4.5rem 1.25rem 7rem;
          background: linear-gradient(135deg, #04060c 0%, #0a101d 55%, #0e1626 100%);
        }

        /* ─── Shell ──────────────────────────────────────────────── */
        .lp-shell {
          position: relative;
          z-index: 5;
          display: grid;
          grid-template-columns: minmax(0, 1fr) 300px;
          gap: 1.5rem;
          width: min(92vw, 1000px);
          align-items: stretch;
          flex-shrink: 0;
        }

        /* Darken the backdrop directly behind the cards so they separate
           from the aurora, then add a soft accent glow on top. */
        .lp-shell::before {
          content: '';
          position: absolute;
          inset: -90px -120px;
          z-index: -2;
          pointer-events: none;
          background: radial-gradient(ellipse 90% 80% at 50% 46%, rgba(2, 4, 10, 0.72), transparent 74%);
          filter: blur(26px);
        }

        .lp-shell::after {
          content: '';
          position: absolute;
          inset: -70px -90px;
          z-index: -1;
          pointer-events: none;
          background:
            radial-gradient(ellipse 55% 60% at 32% 42%, rgba(47, 103, 246, 0.20), transparent 70%),
            radial-gradient(ellipse 40% 50% at 78% 45%, rgba(139, 92, 246, 0.12), transparent 72%);
          filter: blur(34px);
        }

        /* ─── Sign-in card — same surface treatment as the demo panel ── */
        .lp-card {
          position: relative;
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
          padding: 2.25rem 2.5rem;
          border-radius: 24px;
          background: linear-gradient(180deg, #1b2334 0%, #111726 100%);
          border: 1px solid rgba(255, 255, 255, 0.26);
          box-shadow:
            0 0 0 1px rgba(47, 103, 246, 0.35),
            0 28px 70px rgba(0, 0, 0, 0.8),
            inset 0 1px 0 rgba(255, 255, 255, 0.1);
        }

        .lp-card::before {
          content: '';
          position: absolute;
          inset: 0;
          border-radius: inherit;
          background: linear-gradient(180deg, rgba(255, 255, 255, 0.05), transparent 34%);
          pointer-events: none;
        }

        @media (max-width: 480px) {
          .lp-card { padding: 1.75rem 1.5rem; border-radius: 20px; }
        }

        /* ─── Brand ──────────────────────────────────────────────── */
        .lp-brand { display: flex; align-items: center; gap: 0.65rem; }

        .lp-logo {
          width: 40px;
          height: 40px;
          border-radius: 11px;
          background: rgba(47, 103, 246, 0.12);
          border: 1px solid rgba(47, 103, 246, 0.35);
          display: grid;
          place-items: center;
          flex-shrink: 0;
          box-shadow: 0 4px 18px rgba(47, 103, 246, 0.25);
        }

        .lp-logo img {
          width: 100%;
          height: 100%;
          object-fit: contain;
          display: block;
        }

        .lp-brand-name { font-weight: 700; font-size: 0.95rem; color: #ffffff; letter-spacing: -0.01em; }

        .lp-brand-badge {
          margin-left: auto;
          padding: 0.2rem 0.55rem;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.1);
          border: 1px solid rgba(255, 255, 255, 0.16);
          color: rgba(255, 255, 255, 0.85);
          font-size: 0.72rem;
          font-weight: 700;
          letter-spacing: 0.04em;
        }

        /* ─── Heading ────────────────────────────────────────────── */
        .lp-heading-block { display: flex; flex-direction: column; gap: 0.4rem; }

        .lp-title { margin: 0; font-size: 2rem; font-weight: 700; color: #ffffff; line-height: 1.15; letter-spacing: -0.03em; }

        .lp-subtitle { margin: 0; font-size: 0.88rem; color: rgba(255, 255, 255, 0.65); line-height: 1.6; }

        /* ─── Banners ────────────────────────────────────────────── */
        .lp-error, .lp-notice {
          display: flex;
          align-items: flex-start;
          gap: 0.6rem;
          padding: 0.85rem 1rem;
          border-radius: 12px;
          font-size: 0.88rem;
          font-weight: 600;
          line-height: 1.5;
          animation: lp-shake-in 0.3s ease;
        }

        .lp-error { background: #2a1216; border: 1px solid rgba(239, 68, 68, 0.35); color: #fca5a5; }
        .lp-notice { background: #0e1a2e; border: 1px solid rgba(47, 103, 246, 0.35); color: #9db8ff; }

        .lp-error-icon { flex-shrink: 0; font-style: normal; line-height: 1.5; }

        @keyframes lp-shake-in {
          from { opacity: 0; transform: translateY(-4px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        /* ─── Form ───────────────────────────────────────────────── */
        .lp-form { display: flex; flex-direction: column; gap: 1.1rem; }
        .lp-field { display: flex; flex-direction: column; gap: 0.45rem; }

        .lp-label { font-size: 0.83rem; font-weight: 600; color: #ffffff; letter-spacing: 0.01em; user-select: none; }

        .lp-input-wrap { position: relative; display: flex; align-items: center; }
        .lp-input-icon { position: absolute; left: 0.9rem; font-size: 1rem; line-height: 1; pointer-events: none; opacity: 0.55; user-select: none; }

        .lp-input {
          width: 100%;
          min-height: 50px;
          padding: 0 1rem 0 2.6rem;
          border: 1px solid rgba(255, 255, 255, 0.16);
          border-radius: 12px;
          background: #ffffff;
          color: #000000;
          font-size: 0.95rem;
          font-family: inherit;
          transition: border-color 200ms ease, background 200ms ease, box-shadow 200ms ease;
        }

        .lp-input::placeholder { color: rgba(0, 0, 0, 0.5); }
        .lp-input:focus { outline: none; border-color: rgba(47, 103, 246, 0.7); box-shadow: 0 0 0 6px rgba(47, 103, 246, 0.15); }
        .lp-input:disabled { opacity: 0.5; cursor: not-allowed; }

        .lp-pw-toggle {
          position: absolute;
          right: 0.75rem;
          background: none;
          border: none;
          color: rgba(0, 0, 0, 0.65);
          font-size: 1rem;
          cursor: pointer;
          padding: 0.25rem;
          line-height: 1;
          transition: color 150ms ease;
          border-radius: 6px;
        }
        .lp-pw-toggle:hover { color: rgba(0, 0, 0, 0.9); }
        .lp-pw-toggle:focus-visible { outline: 2px solid rgba(47, 103, 246, 0.6); outline-offset: 2px; }

        /* SpecularButton used as full-width submit */
        .lp-submit { width: 100%; margin-top: 0.25rem; min-height: 52px; }

        .lp-submit-loading { display: inline-flex; align-items: center; gap: 0.6rem; }

        .lp-spinner {
          width: 16px;
          height: 16px;
          border: 2.5px solid rgba(255, 255, 255, 0.25);
          border-top-color: #ffffff;
          border-radius: 50%;
          animation: lp-spin 650ms linear infinite;
          flex-shrink: 0;
        }

        @keyframes lp-spin { to { transform: rotate(360deg); } }

        /* ─── Footer ─────────────────────────────────────────────── */
        .lp-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 0.75rem;
          color: rgba(255, 255, 255, 0.55);
          padding-top: 0.75rem;
          border-top: 1px solid rgba(255, 255, 255, 0.1);
          letter-spacing: 0.01em;
        }

        /* ─── Demo access aside ──────────────────────────────────── */
        .lp-aside {
          display: flex;
          flex-direction: column;
          gap: 0.85rem;
          padding: 1.5rem 1.4rem 1.1rem;
          border-radius: 24px;
          background: linear-gradient(180deg, #1b2334 0%, #111726 100%);
          border: 1px solid rgba(255, 255, 255, 0.26);
          box-shadow:
            0 0 0 1px rgba(47, 103, 246, 0.35),
            0 28px 70px rgba(0, 0, 0, 0.8),
            inset 0 1px 0 rgba(255, 255, 255, 0.1);
          animation: lp-aside-in 0.7s cubic-bezier(0.16, 1, 0.3, 1) 0.15s both;
        }

        @keyframes lp-aside-in {
          from { transform: translateY(14px); }
          to   { transform: translateY(0); }
        }

        .lp-eyebrow {
          margin: 0;
          text-transform: uppercase;
          letter-spacing: 0.18em;
          font-size: 0.72rem;
          color: #9db8ff;
          font-weight: 700;
        }

        .lp-aside-title { margin: -0.3rem 0 0; font-size: 0.86rem; font-weight: 600; color: rgba(255, 255, 255, 0.85); }

        /* ── Demo account selector ── */
        .lp-demo-list { display: flex; flex-direction: column; gap: 0.65rem; }

        .lp-demo-item {
          display: flex;
          align-items: center;
          gap: 0.8rem;
          width: 100%;
          padding: 0.8rem 0.85rem;
          border-radius: 14px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.12);
          color: #ffffff;
          font-family: inherit;
          cursor: pointer;
          text-align: left;
          transition: background 180ms ease, border-color 180ms ease, transform 180ms ease, box-shadow 180ms ease;
        }

        .lp-demo-item:hover {
          background: rgba(255, 255, 255, 0.09);
          border-color: rgba(255, 255, 255, 0.24);
          transform: translateY(-1px);
        }

        .lp-demo-item--active {
          background: linear-gradient(135deg, rgba(47, 103, 246, 0.24), rgba(47, 103, 246, 0.10));
          border-color: rgba(47, 103, 246, 0.65);
          box-shadow: 0 0 0 3px rgba(47, 103, 246, 0.14), 0 8px 24px rgba(47, 103, 246, 0.16);
        }

        .lp-demo-avatar {
          width: 38px;
          height: 38px;
          border-radius: 12px;
          display: grid;
          place-items: center;
          background: rgba(47, 103, 246, 0.16);
          border: 1px solid rgba(47, 103, 246, 0.35);
          color: #9db8ff;
          font-weight: 700;
          font-size: 0.95rem;
          flex-shrink: 0;
          transition: background 180ms ease, color 180ms ease, box-shadow 180ms ease;
        }

        .lp-demo-item--active .lp-demo-avatar {
          background: #2f67f6;
          color: #ffffff;
          box-shadow: 0 4px 14px rgba(47, 103, 246, 0.4);
        }

        .lp-demo-main { display: flex; flex-direction: column; gap: 0.08rem; min-width: 0; }

        .lp-demo-name { font-weight: 600; font-size: 0.92rem; color: #ffffff; letter-spacing: 0.01em; }

        .lp-demo-role {
          font-size: 0.66rem;
          text-transform: uppercase;
          letter-spacing: 0.14em;
          color: rgba(255, 255, 255, 0.5);
          font-weight: 600;
        }

        .lp-demo-item--active .lp-demo-role { color: #9db8ff; }

        .lp-demo-check {
          margin-left: auto;
          width: 22px;
          height: 22px;
          border-radius: 50%;
          display: grid;
          place-items: center;
          font-size: 0.68rem;
          font-weight: 700;
          color: transparent;
          border: 1px solid rgba(255, 255, 255, 0.2);
          flex-shrink: 0;
          transition: background 180ms ease, border-color 180ms ease, color 180ms ease;
        }

        .lp-demo-item--active .lp-demo-check {
          background: #2f67f6;
          border-color: #2f67f6;
          color: #ffffff;
          box-shadow: 0 0 0 3px rgba(47, 103, 246, 0.2);
        }

        .lp-demo-creds {
          display: flex;
          flex-wrap: wrap;
          gap: 0.35rem 1rem;
          padding: 0.6rem 0.75rem;
          border-radius: 10px;
          background: rgba(0, 0, 0, 0.35);
          border: 1px dashed rgba(255, 255, 255, 0.16);
          font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
          font-size: 0.72rem;
          color: rgba(255, 255, 255, 0.78);
        }

        .lp-demo-creds-key {
          color: #9db8ff;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          font-size: 0.6rem;
          font-weight: 700;
          margin-right: 0.15rem;
        }

        .lp-aside-hint { margin: 0; font-size: 0.8rem; line-height: 1.5; color: rgba(255, 255, 255, 0.5); }

        /* ─── Quick-actions dock ─────────────────────────────────── */
        .lp-dock {
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          display: flex;
          justify-content: center;
          z-index: 60;
          pointer-events: none;
        }

        .lp-dock .dock-outer { pointer-events: none; }
        .lp-dock .dock-panel { pointer-events: auto; }

        /* ─── Responsive ─────────────────────────────────────────── */
        @media (max-width: 860px) {
          .lp-shell { grid-template-columns: 1fr; width: min(94vw, 480px); }
          .lp-aside { min-height: 280px; }
        }
      `}</style>
    </div>
  )
}
