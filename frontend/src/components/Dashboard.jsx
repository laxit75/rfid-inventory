import { useEffect, useMemo, useRef, useState } from 'react'
import axios from 'axios'
import { connectRealtime, disconnectRealtime } from '../realtime'
import { Link, useNavigate } from 'react-router-dom'
import PieChart from './PieChart'
import TrendChart from './TrendChart'

export default function Dashboard({ siteId }) {
  const navigate = useNavigate()
  const [tags, setTags] = useState([])
  const [settings, setSettings] = useState(null)
  const [summary, setSummary] = useState(null)
  const [trendData, setTrendData] = useState([])
  const [trendStart, setTrendStart] = useState(() => {
    const d = new Date()
    const start = new Date(d.getTime() - 29 * 24 * 60 * 60 * 1000)
    return start.toISOString().slice(0, 10)
  })
  const [trendEnd, setTrendEnd] = useState(() => (new Date()).toISOString().slice(0, 10))
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [tagFilter, setTagFilter] = useState('')
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
        params: siteId !== 'all-sites' ? { zone: siteId } : {},
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      })
      setTags(res.data)
      setLoadError('')
    } catch (err) {
      if (isInitial) setLoadError('Unable to load tags. Check the connection and try again.')
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

  const fetchSummary = async () => {
    try {
      const res = await axios.get('/api/reports/summary', { params: siteId !== 'all-sites' ? { zone: siteId } : {}, headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } })
      setSummary(res.data)
    } catch (err) {
      setSummary(null)
    }
  }

  const fetchTrend = async () => {
    try {
      const res = await axios.get('/api/reports/trends?days=30', { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } })
      setTrendData(res.data.trend || [])
    } catch (err) {
      setTrendData([])
    }
  }

  const fetchTrendRange = async (start, end) => {
    try {
      const qs = []
      if (start) qs.push(`start=${start}`)
      if (end) qs.push(`end=${end}`)
      const qstr = qs.length > 0 ? `?${qs.join('&')}` : ''
      const separator = qstr ? '&' : '?'
      const siteQuery = siteId !== 'all-sites' ? `${separator}zone=${encodeURIComponent(siteId)}` : ''
      const res = await axios.get(`/api/reports/trends${qstr}${siteQuery}`, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } })
      setTrendData(res.data.trend || [])
    } catch (err) {
      setTrendData([])
    }
  }

  useEffect(() => {
    let pollIntervalId = null
    let pollFallbackTimer = null

    const startPolling = (immediate = false) => {
      if (pollIntervalId) return
      if (immediate) fetchTags(false)
      pollIntervalId = setInterval(() => fetchTags(false), 2000)
    }

    const stopPolling = () => {
      if (pollIntervalId) {
        clearInterval(pollIntervalId)
        pollIntervalId = null
      }
      if (pollFallbackTimer) {
        clearTimeout(pollFallbackTimer)
        pollFallbackTimer = null
      }
    }

    fetchTags(true)
    fetchSettings()
    fetchSummary()
    // load default range (last 30 days)
    fetchTrendRange(trendStart, trendEnd)

    // Realtime with polling fallback
    const sock = connectRealtime()
    const mergeTag = (incoming) => {
      if (!incoming) return
      const tag = incoming.tag || incoming
      setTags(prev => {
        const idx = prev.findIndex(t => t.tagId === tag.tagId)
        if (idx === -1) return [tag, ...prev]
        const copy = [...prev]
        copy[idx] = { ...copy[idx], ...tag }
        return copy
      })
    }

    // If socket connects, stop polling; if it disconnects, start polling after short delay
    sock.on('connect', () => {
      stopPolling()
    })
    sock.on('disconnect', () => {
      // start polling fallback after 1s to allow quick reconnects
      if (pollFallbackTimer) clearTimeout(pollFallbackTimer)
      pollFallbackTimer = setTimeout(() => startPolling(true), 1000)
    })
    sock.on('connect_error', (err) => {
      console.warn('Realtime connect_error', err && err.message)
      // If connection cannot be established, ensure polling runs
      startPolling(true)
    })

    // Subscribe to events
    sock.on('tag:movement', (payload) => mergeTag(payload.tag || payload))
    sock.on('tag:alarm', (payload) => mergeTag(payload.tag || payload))

    // If socket isn't connected shortly after mount, start polling
    if (!sock.connected) {
      // allow short time for socket to connect before starting polling
      const t = setTimeout(() => {
        if (!sock.connected) startPolling(true)
      }, 800)
      // store to clear on cleanup
      pollFallbackTimer = t
    }

    return () => {
      stopPolling()
      try { sock.off('tag:movement') } catch (e) {}
      try { sock.off('tag:alarm') } catch (e) {}
      try { sock.off('connect') } catch (e) {}
      try { sock.off('disconnect') } catch (e) {}
      try { sock.off('connect_error') } catch (e) {}
      disconnectRealtime()
    }
  }, [siteId])

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

  const activeAlarms = summary?.alertCounts?.ALARMING ?? tags.filter(t => t.alertStatus === 'ALARMING').length
  const overdue = summary?.alertCounts?.OVERDUE ?? tags.filter(t => t.alertStatus === 'OVERDUE').length
  const outside = typeof summary?.outsideCount === 'number' ? summary.outsideCount : tags.filter(t => t.currentZone === null || t.currentZone === undefined).length
  const disabled = (summary?.totals?.TEMP_DISABLED ?? tags.filter(t => t.status === 'TEMP_DISABLED').length) + (summary?.totals?.PERMANENT_DISABLED ?? tags.filter(t => t.status === 'PERMANENT_DISABLED').length)
  const healthy = summary?.totals?.ACTIVE ?? tags.length - activeAlarms - overdue - disabled
  const violationsToday = summary?.violationsToday ?? 0
  const violationsWeek = summary?.violationsWeek ?? 0
  const avgResolutionMs = summary?.avgResolutionMs ?? null

  const formatDuration = (ms) => {
    if (ms === null) return 'N/A'
    const seconds = Math.round(ms / 1000)
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}m ${secs}s`
  }

  const trendBounds = useMemo(() => {
    if (!trendData || trendData.length === 0) return { max: 1 }
    return { max: Math.max(...trendData.map(item => item.total), 1) }
  }, [trendData])

  const scrollTo = (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  const focusMetric = (metric) => {
    const today = new Date()
    if (metric === 'today') {
      const day = today.toISOString().slice(0, 10)
      setTrendStart(day); setTrendEnd(day); fetchTrendRange(day, day); scrollTo('violation-trend')
    } else if (metric === 'week') {
      const start = new Date(today.getTime() - 6 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
      const end = today.toISOString().slice(0, 10)
      setTrendStart(start); setTrendEnd(end); fetchTrendRange(start, end); scrollTo('violation-trend')
    } else if (metric === 'resolution') {
      navigate('/summary-report')
    } else {
      setTagFilter(metric); scrollTo('tag-list')
    }
  }
  const visibleTags = tags.filter(tag => tagFilter === 'outside' ? !tag.currentZone : tagFilter === 'alarming' ? tag.alertStatus === 'ALARMING' : tagFilter === 'overdue' ? tag.alertStatus === 'OVERDUE' : true)

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
        <button className="summary-pill healthy" onClick={() => setTagFilter('')}>● {healthy} healthy</button>
        <button className="summary-pill alarming" onClick={() => focusMetric('alarming')}>🚨 {activeAlarms} alarming</button>
        <button className="summary-pill overdue" onClick={() => focusMetric('overdue')}>⏱ {overdue} overdue</button>
        <button className="summary-pill muted" onClick={() => setTagFilter('')}>• {disabled} disabled</button>
      </div>

      <div className="stats-grid">
        <button className="stat-card accent-info metric-card" onClick={() => focusMetric('today')}>
          <div className="stat-title">Violations today</div>
          <div className="stat-value">{violationsToday}</div>
          <span className="metric-card__hint">View daily trend →</span>
        </button>
        <button className="stat-card accent-info metric-card" onClick={() => focusMetric('week')}>
          <div className="stat-title">Violations this week</div>
          <div className="stat-value">{violationsWeek}</div>
          <span className="metric-card__hint">View weekly trend →</span>
        </button>
        <button className="stat-card accent-secondary metric-card" onClick={() => focusMetric('resolution')}>
          <div className="stat-title">Avg resolution</div>
          <div className="stat-value">{avgResolutionMs !== null ? `${Math.round(avgResolutionMs / 1000)}s` : 'N/A'}</div>
          <span className="metric-card__hint">Open summary report →</span>
        </button>
        <button className="stat-card accent-secondary metric-card" onClick={() => focusMetric('outside')}>
          <div className="stat-title">Outside lab</div>
          <div className="stat-value">{outside}</div>
          <span className="metric-card__hint">View affected tags →</span>
        </button>
      </div>

      <div className="content-card" id="violation-trend">
        <div className="card-header">
          <div>
            <h3>Violation trend</h3>
            <p className="card-copy">Alarms raised per day. Select a date range to focus the chart.</p>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <label style={{ fontSize: 13, color: '#475569' }}>From
              <input type="date" style={{ marginLeft: 8 }} value={trendStart || ''} onChange={e => setTrendStart(e.target.value)} />
            </label>
            <label style={{ fontSize: 13, color: '#475569' }}>To
              <input type="date" style={{ marginLeft: 8 }} value={trendEnd || ''} onChange={e => setTrendEnd(e.target.value)} />
            </label>
            <button className="button button-secondary" onClick={() => fetchTrendRange(trendStart, trendEnd)}>Apply</button>
            <button className="button button-ghost" onClick={() => { const d = new Date(); const s = new Date(d.getTime() - 29 * 24 * 60 * 60 * 1000); setTrendStart(s.toISOString().slice(0,10)); setTrendEnd(d.toISOString().slice(0,10)); fetchTrendRange(s.toISOString().slice(0,10), d.toISOString().slice(0,10)); }}>Last 30d</button>
          </div>
        </div>
        <div className="trend-chart">
          {trendData.length === 0 ? (
            <div className="empty-state">No trend data available yet.</div>
          ) : (
            <TrendChart data={trendData} onBarClick={(date) => { setTrendStart(date); setTrendEnd(date); fetchTrendRange(date, date) }} />
          )}
        </div>
      </div>

      <div className="content-card">
        <div className="card-header">
          <div>
            <h3>Violation distribution</h3>
            <p className="card-copy">Current proportion of tag alert statuses.</p>
          </div>
        </div>
        <div style={{ padding: 16 }}>
          <PieChart onSliceClick={(slice) => focusMetric(slice.label === 'Alarming' ? 'alarming' : slice.label === 'Overdue' ? 'overdue' : '')} data={[
            { label: 'Alarming', value: summary?.alertCounts?.ALARMING ?? 0, color: '#ef4444' },
            { label: 'Overdue', value: summary?.alertCounts?.OVERDUE ?? 0, color: '#f97316' },
            { label: 'Healthy', value: summary?.alertCounts?.NONE ?? 0, color: '#10b981' }
          ]} />
        </div>
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

      <div className="content-card" id="tag-list">
        <div className="card-header">
          <div>
            <h3>All tags</h3>
            <p className="card-copy">{tagFilter ? `Filtered view: ${tagFilter}.` : 'A live view of every tag in the lab system.'}</p>
          </div>
          <div className="chip-row">
            <button className="chip" onClick={() => setTagFilter('')}>{tags.length} total</button>
            <span className="chip chip-warning">{activeAlarms} alarming</span>
          </div>
        </div>

        {loadError ? (
          <div className="empty-state" role="alert">{loadError}</div>
        ) : loading ? (
          <div className="loading-state">Loading tags…</div>
        ) : visibleTags.length === 0 ? (
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
                {visibleTags.map(tag => (
                  <tr key={tag._id} className={`tag-row ${tag.alertStatus === 'ALARMING' ? 'tag-row--alarming' : tag.alertStatus === 'OVERDUE' ? 'tag-row--overdue' : ''}`}>
                    <td>
                      <div className="table-main"><Link to={`/tags/${tag._id}/history`}>{tag.tagId}</Link></div>
                      {tag.alertStatus === 'ALARMING' && <div className="table-meta">🚨 Immediate attention required</div>}
                      {tag.alertStatus === 'OVERDUE' && <div className="table-meta">⏱ Return or resolve overdue item</div>}
                    </td>
                    <td>{tag.equipment?.name || 'N/A'}</td>
                    <td>{tag.status}</td>
                    <td>{tag.assignedZone?.name || 'Unassigned'}</td>
                    <td>{tag.currentZone?.name || 'Outside all zones'}</td>
                    <td>
                      <span className={`status-pill ${tag.alertStatus === 'ALARMING' ? 'danger' : tag.alertStatus === 'OVERDUE' ? 'warning' : 'neutral'}`}>
                        {tag.alertStatus === 'ALARMING' ? '🚨 ALARMING' : tag.alertStatus === 'OVERDUE' ? '⏱ OVERDUE' : 'NO ALERT'}
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
