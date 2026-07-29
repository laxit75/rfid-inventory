import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import { useState, useEffect, useRef, useCallback } from 'react'
import axios from 'axios'
import { connectRealtime, disconnectRealtime } from './realtime'
import ErrorBoundary from './components/ErrorBoundary'
import AnimatedPage from './components/AnimatedPage'
import Login from './components/Login'
import Dashboard from './components/Dashboard'
import Simulator from './components/Simulator'
import TagManagement from './components/TagManagement'
import TagHistory from './components/TagHistory'
import Settings from './components/Settings'
import Recipients from './components/Recipients'
import Users from './components/Users'
import AuditLog from './components/AuditLog'
import Layout from './components/Layout'
import Devices from './components/Devices'
import DeviceGroups from './components/DeviceGroups'
import AlertTargetGroups from './components/AlertTargetGroups'
import AlertFlows from './components/AlertFlows'
import SummaryReport from './components/SummaryReport'
import FullReport from './components/FullReport'
import ManageRoles from './components/ManageRoles'
import ManageSites from './components/ManageSites'
import ReportBuilder from './components/ReportBuilder'

function App() {
  const location = useLocation()
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [user, setUser] = useState(null);
  const [testingMode, setTestingMode] = useState(false);
  const [siteId, setSiteId] = useState(() => {
    const savedSite = localStorage.getItem('rfid-active-site')
    return savedSite === 'all-sites' || /^[a-f\d]{24}$/i.test(savedSite || '') ? savedSite : 'all-sites'
  });
  const [soundEnabled, setSoundEnabled] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.sessionStorage.getItem('rfid-sound-enabled') === 'true'
  });
  const [settings, setSettings] = useState(null);
  const navigate = useNavigate();
  const alarmAudioRef = useRef(null);
  const settingsRef = useRef(null);
  const intervalRef = useRef(null);
  const timeoutRef = useRef(null);
  const [sessionExpiring, setSessionExpiring] = useState(false);
  const inactivityTimerRef = useRef(null);
  const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
  const SESSION_WARNING_MS = 5 * 60 * 1000; // warn 5 min before expiry

  // Reset inactivity timer on user interaction
  const resetInactivityTimer = useCallback(() => {
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current)
    }
    setSessionExpiring(false)

    if (token) {
      inactivityTimerRef.current = setTimeout(() => {
        // Check if token is near expiry and attempt refresh
        const tokenData = parseJwt(token)
        if (tokenData && tokenData.exp) {
          const expiresIn = (tokenData.exp * 1000) - Date.now()
          if (expiresIn > 0 && expiresIn < SESSION_WARNING_MS) {
            setSessionExpiring(true)
          } else if (expiresIn <= 0) {
            // Token expired, logout
            handleLogout()
          }
        }
      }, INACTIVITY_TIMEOUT_MS)
    }
  }, [token])

  // Parse JWT to check expiry
  function parseJwt(t) {
    try {
      const payload = t.split('.')[1]
      const decoded = atob(payload)
      return JSON.parse(decoded)
    } catch {
      return null
    }
  }

  // Track user activity to detect inactivity
  useEffect(() => {
    if (!token) return

    const events = ['mousedown', 'keydown', 'touchstart', 'scroll', 'click']
    const handler = () => resetInactivityTimer()

    events.forEach(event => window.addEventListener(event, handler))
    resetInactivityTimer()

    return () => {
      events.forEach(event => window.removeEventListener(event, handler))
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current)
    }
  }, [token, resetInactivityTimer])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem('rfid-sound-enabled', String(soundEnabled))
    }
  }, [soundEnabled])

  useEffect(() => {
    settingsRef.current = settings
  }, [settings])

  const stopAlarmLoop = () => {
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    if (intervalRef.current) {
      window.clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    if (alarmAudioRef.current) {
      alarmAudioRef.current.pause()
      alarmAudioRef.current.currentTime = 0
    }
  }

  const playAlarmBurst = async () => {
    const currentSettings = settingsRef.current
    if (!alarmAudioRef.current || !currentSettings || currentSettings.alarmMuted || !soundEnabled) return

    try {
      alarmAudioRef.current.pause()
      alarmAudioRef.current.currentTime = 0
      alarmAudioRef.current.volume = Math.min(1, Math.max(0, (currentSettings.alarmVolume || 0) / 100))
      await alarmAudioRef.current.play()
    } catch (err) {
      console.warn('Alarm audio blocked until user interaction', err)
    }
  }

  const startAlarmLoop = async () => {
    const currentSettings = settingsRef.current
    if (!currentSettings || currentSettings.alarmMuted || !soundEnabled) return

    stopAlarmLoop()
    await playAlarmBurst()

    const intervalMs = Math.max(1000, (currentSettings.alarmRepeatIntervalSec || 5) * 1000)
    const durationMs = Math.max(1000, (currentSettings.alarmDurationSec || 5) * 1000)

    timeoutRef.current = window.setTimeout(() => {
      if (alarmAudioRef.current) {
        alarmAudioRef.current.pause()
        alarmAudioRef.current.currentTime = 0
      }
      timeoutRef.current = null
    }, durationMs)

    intervalRef.current = window.setInterval(() => {
      playAlarmBurst()
    }, intervalMs)
  }

  useEffect(() => {
    if (!token) return

    axios.get('/api/settings', {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then((response) => {
        setSettings(response.data)
        settingsRef.current = response.data
      })
      .catch(() => {
        setSettings(null)
        settingsRef.current = null
      })

    const sock = connectRealtime()
    const handleMovement = (payload) => {
      const tag = payload?.tag || payload
      const movement = payload?.movement || payload?.tag?.movement

      if (movement === 'RETURN') {
        stopAlarmLoop()
        return
      }

      if (!tag) return
      if (tag.alertStatus === 'ALARMING') {
        startAlarmLoop()
      } else {
        stopAlarmLoop()
      }
    }

    const handleAlarm = async (payload) => {
      const tag = payload?.tag || payload
      if (!tag || tag.alertStatus !== 'ALARMING') return
      await startAlarmLoop()
    }

    sock.on('tag:movement', handleMovement)
    sock.on('tag:alarm', handleAlarm)

    return () => {
      stopAlarmLoop()
      try { sock.off('tag:movement', handleMovement) } catch (e) {}
      try { sock.off('tag:alarm', handleAlarm) } catch (e) {}
    }
  }, [token, soundEnabled])

  useEffect(() => {
    if (token) {
      axios.get('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
        .then(response => setUser(response.data))
        .catch(() => {
          localStorage.removeItem('token')
          setToken(null)
          setUser(null)
        })
    }
  }, [token]);

  const handleLogin = (token, userData) => {
    localStorage.setItem('token', token);
    setToken(token);
    setUser(userData);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
    setSessionExpiring(false);
    disconnectRealtime();
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current)
    }
  };

  const enableAlarmSound = async () => {
    try {
      if (!alarmAudioRef.current) return
      alarmAudioRef.current.volume = 0.0001
      await alarmAudioRef.current.play()
      alarmAudioRef.current.pause()
      alarmAudioRef.current.currentTime = 0
      setSoundEnabled(true)
    } catch (err) {
      console.warn('Alarm audio must be enabled through a user gesture', err)
    }
  };

  // Keyboard shortcuts: Ctrl+1-5 for nav, Ctrl+Shift+L for logout
  useEffect(() => {
    if (!token) return
    const handler = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey) {
        const navMap = { '1': '/', '2': '/tags', '3': '/summary-report', '4': '/full-report', '5': '/audit' }
        const path = navMap[e.key]
        if (path) { e.preventDefault(); navigate(path) }
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'L') {
        e.preventDefault()
        handleLogout()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [token, navigate])

  useEffect(() => {
    if (!token) return

    const unlockAudio = () => {
      if (!soundEnabled) {
        enableAlarmSound()
      }
    }

    window.addEventListener('pointerdown', unlockAudio, { once: true })
    return () => window.removeEventListener('pointerdown', unlockAudio)
  }, [token, soundEnabled])

  if (!token) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <ErrorBoundary>
      {sessionExpiring && (
        <div className="session-timeout-banner">
          <span>Your session will expire soon due to inactivity.</span>
          <button className="button button-secondary" onClick={() => resetInactivityTimer()}>
            Stay logged in
          </button>
          <button className="button button-ghost" style={{ color: 'white', borderColor: 'rgba(255,255,255,0.3)' }} onClick={handleLogout}>
            Logout now
          </button>
        </div>
      )}
      <audio ref={alarmAudioRef} src="/sounds/alarm.wav" preload="auto" />
      <Layout user={user} onLogout={handleLogout} testingMode={testingMode} onTestingModeChange={setTestingMode} siteId={siteId} onSiteChange={setSiteId}>
        <AnimatePresence mode="wait">
          <Routes location={location} key={location.pathname}>
            <Route path="/" element={<ErrorBoundary key="dashboard"><AnimatedPage><Dashboard siteId={siteId} soundEnabled={soundEnabled} onEnableSound={enableAlarmSound} /></AnimatedPage></ErrorBoundary>} />
            <Route path="/simulator" element={user?.role === 'ADMIN' && testingMode ? <ErrorBoundary key="sim"><AnimatedPage><Simulator /></AnimatedPage></ErrorBoundary> : <Navigate to="/" />} />
            <Route path="/tags" element={<ErrorBoundary key="tags"><AnimatedPage><TagManagement /></AnimatedPage></ErrorBoundary>} />
            <Route path="/devices" element={user?.role === 'ADMIN' ? <ErrorBoundary key="devices"><AnimatedPage><Devices /></AnimatedPage></ErrorBoundary> : <Navigate to="/" />} />
          <Route path="/device-groups" element={user?.role === 'ADMIN' ? <ErrorBoundary key="device-groups"><AnimatedPage><DeviceGroups /></AnimatedPage></ErrorBoundary> : <Navigate to="/" />} />
          <Route path="/alert-target-groups" element={user?.role === 'ADMIN' ? <ErrorBoundary key="alert-target-groups"><AnimatedPage><AlertTargetGroups /></AnimatedPage></ErrorBoundary> : <Navigate to="/" />} />
          <Route path="/alert-flows" element={user?.role === 'ADMIN' ? <ErrorBoundary key="alert-flows"><AnimatedPage><AlertFlows /></AnimatedPage></ErrorBoundary> : <Navigate to="/" />} />
            <Route path="/summary-report" element={<ErrorBoundary key="summary"><AnimatedPage><SummaryReport siteId={siteId} /></AnimatedPage></ErrorBoundary>} />
            <Route path="/full-report" element={<ErrorBoundary key="full"><AnimatedPage><FullReport siteId={siteId} /></AnimatedPage></ErrorBoundary>} />
            <Route path="/report-builder" element={user?.role === 'ADMIN' ? <ErrorBoundary key="report-builder"><AnimatedPage><ReportBuilder /></AnimatedPage></ErrorBoundary> : <Navigate to="/" />} />
            <Route path="/manage-roles" element={user?.role === 'ADMIN' ? <ErrorBoundary key="roles"><AnimatedPage><ManageRoles /></AnimatedPage></ErrorBoundary> : <Navigate to="/" />} />
            <Route path="/manage-sites" element={user?.role === 'ADMIN' ? <ErrorBoundary key="sites"><AnimatedPage><ManageSites /></AnimatedPage></ErrorBoundary> : <Navigate to="/" />} />
            <Route path="/tags/:tagId/history" element={<ErrorBoundary key="history"><AnimatedPage><TagHistory /></AnimatedPage></ErrorBoundary>} />
            <Route path="/settings" element={user?.role === 'ADMIN' ? <ErrorBoundary key="settings"><AnimatedPage><Settings /></AnimatedPage></ErrorBoundary> : <Navigate to="/" />} />
            <Route path="/recipients" element={user?.role === 'ADMIN' ? <ErrorBoundary key="recipients"><AnimatedPage><Recipients /></AnimatedPage></ErrorBoundary> : <Navigate to="/" />} />
            <Route path="/users" element={user?.role === 'ADMIN' ? <ErrorBoundary key="users"><AnimatedPage><Users /></AnimatedPage></ErrorBoundary> : <Navigate to="/" />} />
            <Route path="/audit" element={<ErrorBoundary key="audit"><AnimatedPage><AuditLog /></AnimatedPage></ErrorBoundary>} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </AnimatePresence>
      </Layout>
    </ErrorBoundary>
  );
}

export default App;
