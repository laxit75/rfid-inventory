import { useEffect, useRef, useState } from 'react'
import axios from 'axios'

export default function Dashboard() {
  const [tags, setTags] = useState([])
  const [settings, setSettings] = useState(null)
  const [loading, setLoading] = useState(true)
  const [soundEnabled, setSoundEnabled] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.sessionStorage.getItem('rfid-sound-enabled') === 'true'
  })
  const [soundNotice, setSoundNotice] = useState('')
  const audioRef = useRef(null)

  const fetchTags = async (isInitial = false) => {
    try {
      if (isInitial) setLoading(true)
      const res = await axios.get('/api/tags', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      })
      setTags(res.data)
    } finally {
      if (isInitial) setLoading(false)
    }
  }

  const fetchSettings = async () => {
    const res = await axios.get('/api/settings', {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
    })
    setSettings(res.data)
  }

  useEffect(() => {
    fetchTags(true)
    fetchSettings()
    const interval = setInterval(() => fetchTags(false), 2000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem('rfid-sound-enabled', String(soundEnabled))
    }
  }, [soundEnabled])

  useEffect(() => {
    if (!settings) return

    const alarmingTags = tags.filter(tag => tag.alertStatus === 'ALARMING' && !tag.silenced)
    const shouldPlay = alarmingTags.length > 0 && !settings.alarmMuted && soundEnabled

    if (!shouldPlay) {
      audioRef.current?.pause()
      audioRef.current && (audioRef.current.currentTime = 0)
      return
    }

    const intervalMs = Math.max(1000, (settings.alarmRepeatIntervalSec || 5) * 1000)
    const durationMs = Math.max(1000, (settings.alarmDurationSec || 5) * 1000)

    const playBurst = async () => {
      if (!audioRef.current) return
      audioRef.current.pause()
      audioRef.current.currentTime = 0
      audioRef.current.volume = Math.min(1, Math.max(0, (settings.alarmVolume || 0) / 100))
      try {
        await audioRef.current.play()
      } catch (err) {
        setSoundNotice('Audio playback is blocked until you interact with the page.')
      }
    }

    playBurst()
    const timeoutId = window.setTimeout(() => {
      audioRef.current?.pause()
      audioRef.current && (audioRef.current.currentTime = 0)
    }, durationMs)
    const intervalId = window.setInterval(() => {
      playBurst()
    }, intervalMs)

    return () => {
      window.clearTimeout(timeoutId)
      window.clearInterval(intervalId)
      audioRef.current?.pause()
      audioRef.current && (audioRef.current.currentTime = 0)
    }
  }, [tags, settings, soundEnabled])

  const enableSound = async () => {
    try {
      if (!audioRef.current) return
      audioRef.current.volume = 0.0001
      await audioRef.current.play()
      audioRef.current.pause()
      audioRef.current.currentTime = 0
      setSoundEnabled(true)
      setSoundNotice('Alarm sound enabled.')
    } catch (err) {
      setSoundNotice('Audio is blocked until you click the page again.')
    }
  }

  const activeAlarms = tags.filter(t => t.alertStatus === 'ALARMING').length
  const overdue = tags.filter(t => t.alertStatus === 'OVERDUE').length
  const outside = tags.filter(t => t.currentZone === null || t.currentZone === undefined).length
  const disabled = tags.filter(t => t.status === 'TEMP_DISABLED' || t.status === 'PERMANENT_DISABLED').length
  const healthy = tags.length - activeAlarms - overdue - disabled

  return (
    <div className="page-shell">
      <audio ref={audioRef} src="/sounds/alarm.wav" preload="auto" />
      <div className="page-head">
        <div>
          <p className="eyebrow">Live operations</p>
          <h2>Lab dashboard</h2>
          <p className="page-subtitle">Monitor tag movement, alarming equipment, and overdue exits in one place.</p>
        </div>
      </div>

      {!soundEnabled && (
        <div className="inline-banner info sound-banner">
          <span>Click to enable alarm sound for this session.</span>
          <button className="button button-secondary" onClick={enableSound}>
            Enable sound
          </button>
        </div>
      )}

      {soundNotice && (
        <div className={`inline-banner ${soundEnabled ? 'success' : 'info'}`}>
          {soundNotice}
        </div>
      )}

      <div className="summary-strip">
        <span className="summary-pill healthy">● {healthy} healthy</span>
        <span className="summary-pill warning">⚠ {activeAlarms} alarming</span>
        <span className="summary-pill neutral">• {overdue} overdue</span>
        <span className="summary-pill muted">• {disabled} disabled</span>
      </div>

      {activeAlarms > 0 && (
        <div className="alert-banner">
          <div className="alert-banner__icon">🚨</div>
          <div>
            <strong>{activeAlarms} tag{activeAlarms === 1 ? '' : 's'} currently alarming</strong>
            <p>Alarm audio will play automatically while the alert remains active.</p>
          </div>
        </div>
      )}

      <div className="stats-grid">
        <div className="stat-card accent-danger">
          <div className="stat-title">Active alarms</div>
          <div className="stat-value">{activeAlarms}</div>
        </div>
        <div className="stat-card">
          <div className="stat-title">Overdue items</div>
          <div className="stat-value">{overdue}</div>
        </div>
        <div className="stat-card">
          <div className="stat-title">Outside lab</div>
          <div className="stat-value">{outside}</div>
        </div>
        <div className="stat-card">
          <div className="stat-title">Disabled tags</div>
          <div className="stat-value">{disabled}</div>
        </div>
      </div>

      <div className="content-card">
        <div className="card-header">
          <div>
            <h3>All tags</h3>
            <p className="card-copy">A live view of every tag in the lab system.</p>
          </div>
          <div className="chip-row">
            <span className="chip">{tags.length} total</span>
            <span className="chip chip-warning">{activeAlarms} alarming</span>
          </div>
        </div>

        {loading ? (
          <div className="loading-state">Loading tags…</div>
        ) : tags.length === 0 ? (
          <div className="empty-state">No tags have been created yet.</div>
        ) : (
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Tag ID</th>
                  <th>Equipment</th>
                  <th>Status</th>
                  <th>Assigned zone</th>
                  <th>Current zone</th>
                  <th>Alert</th>
                </tr>
              </thead>
              <tbody>
                {tags.map(tag => (
                  <tr key={tag._id} className={tag.alertStatus !== 'NONE' ? 'alert-row' : ''}>
                    <td>
                      <div className="table-main">{tag.tagId}</div>
                      {tag.alertStatus === 'ALARMING' && <div className="table-meta">Needs attention</div>}
                    </td>
                    <td>{tag.equipment?.name || 'N/A'}</td>
                    <td>{tag.status}</td>
                    <td>{tag.assignedZone?.name || 'Unassigned'}</td>
                    <td>{tag.currentZone?.name || 'Outside all zones'}</td>
                    <td>
                      <span className={`status-pill ${tag.alertStatus === 'ALARMING' ? 'danger' : tag.alertStatus === 'OVERDUE' ? 'warning' : 'neutral'}`}>
                        {tag.alertStatus}
                      </span>
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