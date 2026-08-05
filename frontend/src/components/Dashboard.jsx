import { useEffect, useState } from 'react'
import axios from 'axios'
import { connectRealtime } from '../realtime'
import { Link, useNavigate } from 'react-router-dom'
import PieChart from './PieChart'
import TrendChart from './TrendChart'
import SplitText from './SplitText'

export default function Dashboard({ siteId, soundEnabled, onEnableSound }) {
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
  const [soundNotice, setSoundNotice] = useState('')

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
    fetchTrendRange(trendStart, trendEnd)

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

    sock.on('connect', () => { stopPolling() })
    sock.on('disconnect', () => {
      if (pollFallbackTimer) clearTimeout(pollFallbackTimer)
      pollFallbackTimer = setTimeout(() => startPolling(true), 1000)
    })
    sock.on('connect_error', (err) => {
      console.warn('Realtime connect_error', err && err.message)
      startPolling(true)
    })

    sock.on('tag:movement', (payload) => mergeTag(payload.tag || payload))
    sock.on('tag:alarm', (payload) => mergeTag(payload.tag || payload))

    if (!sock.connected) {
      const t = setTimeout(() => {
        if (!sock.connected) startPolling(true)
      }, 800)
      pollFallbackTimer = t
    }

    return () => {
      stopPolling()
      try { sock.off('tag:movement') } catch (e) {}
      try { sock.off('tag:alarm') } catch (e) {}
      try { sock.off('connect') } catch (e) {}
      try { sock.off('disconnect') } catch (e) {}
      try { sock.off('connect_error') } catch (e) {}
    }
  }, [siteId])

  const enableSound = async () => {
    try {
      await onEnableSound?.()
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

  const exportCsv = () => {
    const headers = ['Tag ID', 'Equipment', 'Status', 'Assigned Zone', 'Current Zone', 'Alert Status']
    const rows = visibleTags.map(tag => [
      tag.tagId,
      tag.equipment?.name || 'N/A',
      tag.status,
      tag.assignedZone?.name || 'Unassigned',
      tag.currentZone?.name || 'Outside all zones',
      tag.alertStatus
    ])
    const csv = [headers.join(','), ...rows.map(r => r.map(c => `\"${c}\"`).join(','))].join('\\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `rfid-dashboard-${new Date().toISOString().slice(0,10)}.csv`
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  }

  const visibleTags = tags.filter(tag => tagFilter === 'outside' ? !tag.currentZone : tagFilter === 'alarming' ? tag.alertStatus === 'ALARMING' : tagFilter === 'overdue' ? tag.alertStatus === 'OVERDUE' : true)

  return (
    <div className="cc-dashboard">
      {/* Page Header */}
      <div className="cc-page-header cc-animate-in">
        <div>
          <p className="cc-eyebrow">Live operations</p>
          <SplitText
            tag="h2"
            text="Lab dashboard"
            className="cc-page-title"
            textAlign="left"
            delay={40}
            duration={0.8}
            ease="power3.out"
            splitType="words, chars"
            from={{ opacity: 0, y: 24 }}
            to={{ opacity: 1, y: 0 }}
          />
          <p className="cc-page-subtitle">Monitor tag movement, alarming equipment, and overdue exits in one place.</p>
        </div>
        <div className="cc-page-actions">
          <div className="cc-live-badge cc-live-badge--live">
            <span className="cc-live-dot" />
            LIVE
          </div>
          <button className="cc-btn-ghost cc-magnetic" onClick={exportCsv} title="Download visible tags as CSV">
            📥 Export CSV
          </button>
        </div>
      </div>

      {/* Sound Notice */}
      {!soundEnabled && (
        <div className="cc-banner cc-banner--info">
          <span>Click to enable alarm sound for this session.</span>
          <button className="cc-btn-accent cc-magnetic" onClick={enableSound} style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}>
            Enable sound
          </button>
        </div>
      )}

      {soundNotice && (
        <div className={`cc-banner ${soundEnabled ? 'cc-banner--success' : 'cc-banner--info'}`}>
          {soundNotice}
        </div>
      )}

      {/* Status Pills */}
      <div className="cc-status-pills">
        <button className="cc-pill cc-pill--healthy" onClick={() => setTagFilter('')}>
          ● {healthy} healthy
        </button>
        <button className="cc-pill cc-pill--alarm" onClick={() => focusMetric('alarming')}>
          🚨 {activeAlarms} alarming
        </button>
        <button className="cc-pill cc-pill--warning" onClick={() => focusMetric('overdue')}>
          ⏱ {overdue} overdue
        </button>
        <button className="cc-pill cc-pill--neutral" onClick={() => setTagFilter('')}>
          • {disabled} disabled
        </button>
      </div>

      {/* Primary Stats Grid */}
      <div className="cc-stats-grid cc-animate-in" style={{ animationDelay: '0.1s' }}>
        <button className="cc-stat-card cc-tilt" onClick={() => focusMetric('today')}>
          <div className="cc-stat-card__header">
            <div>
              <div className="cc-stat-card__label">Violations today</div>
              <div className="cc-stat-card__value">{violationsToday}</div>
              {violationsToday > 0 && <div className="cc-stat-card__trend cc-stat-card__trend--up">↑ vs yesterday</div>}
            </div>
            <div className="cc-stat-card__icon">📊</div>
          </div>
          <span className="cc-stat-card__hint">View daily trend →</span>
        </button>

        <button className="cc-stat-card cc-tilt" onClick={() => focusMetric('week')}>
          <div className="cc-stat-card__header">
            <div>
              <div className="cc-stat-card__label">Violations this week</div>
              <div className="cc-stat-card__value">{violationsWeek}</div>
              {violationsWeek > 0 && <div className="cc-stat-card__trend cc-stat-card__trend--up">↑ weekly count</div>}
            </div>
            <div className="cc-stat-card__icon">📈</div>
          </div>
          <span className="cc-stat-card__hint">View weekly trend →</span>
        </button>

        <button className="cc-stat-card cc-tilt" onClick={() => focusMetric('resolution')}>
          <div className="cc-stat-card__header">
            <div>
              <div className="cc-stat-card__label">Avg resolution</div>
              <div className="cc-stat-card__value">{avgResolutionMs !== null ? `${Math.round(avgResolutionMs / 1000)}s` : 'N/A'}</div>
            </div>
            <div className="cc-stat-card__icon">⚡</div>
          </div>
          <span className="cc-stat-card__hint">Open summary report →</span>
        </button>

        <button className="cc-stat-card cc-tilt" onClick={() => focusMetric('outside')}>
          <div className="cc-stat-card__header">
            <div>
              <div className="cc-stat-card__label">Outside lab</div>
              <div className="cc-stat-card__value">{outside}</div>
              {outside > 0 && <div className="cc-stat-card__trend cc-stat-card__trend--down">↓ needs attention</div>}
            </div>
            <div className="cc-stat-card__icon">📍</div>
          </div>
          <span className="cc-stat-card__hint">View affected tags →</span>
        </button>
      </div>

      {/* Violation Distribution — big centered donut */}
      <div className="cc-content-card cc-animate-in" style={{ animationDelay: '0.2s' }}>
        <div className="cc-card-header">
          <div>
            <h3 className="cc-card-title">Violation distribution</h3>
            <p className="cc-card-subtitle">Current proportion of tag alert statuses.</p>
          </div>
        </div>
        <div className="cc-pie-layout">
          <PieChart
            size={250}
            innerRadius={74}
            onSliceClick={(slice) => focusMetric(slice.label === 'Alarming' ? 'alarming' : slice.label === 'Overdue' ? 'overdue' : '')}
            data={[
              { label: 'Alarming', value: summary?.alertCounts?.ALARMING ?? 0, color: '#b91c1c' },
              { label: 'Overdue', value: summary?.alertCounts?.OVERDUE ?? 0, color: '#92400e' },
              { label: 'Healthy', value: summary?.alertCounts?.NONE ?? 0, color: '#22c55e' }
            ]}
          />
        </div>
      </div>

      {/* Violation Trend Chart */}
      <div className="cc-content-card cc-animate-in" style={{ animationDelay: '0.25s' }} id="violation-trend">
        <div className="cc-card-header">
          <div>
            <h3 className="cc-card-title">Violation trend</h3>
            <p className="cc-card-subtitle">Alarms raised per day. Select a date range to focus the chart.</p>
          </div>
          <div className="cc-card-controls">
            <label className="cc-date-label">From
              <input type="date" className="cc-date-input" value={trendStart || ''} onChange={e => setTrendStart(e.target.value)} />
            </label>
            <label className="cc-date-label">To
              <input type="date" className="cc-date-input" value={trendEnd || ''} onChange={e => setTrendEnd(e.target.value)} />
            </label>
            <button className="cc-btn-accent cc-magnetic" onClick={() => fetchTrendRange(trendStart, trendEnd)} style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}>
              Apply
            </button>
            <button className="cc-btn-ghost cc-magnetic" onClick={() => { const d = new Date(); const s = new Date(d.getTime() - 29 * 24 * 60 * 60 * 1000); setTrendStart(s.toISOString().slice(0,10)); setTrendEnd(d.toISOString().slice(0,10)); fetchTrendRange(s.toISOString().slice(0,10), d.toISOString().slice(0,10)); }} style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}>
              Last 30d
            </button>
          </div>
        </div>
        <div className="cc-trend-chart">
          {trendData.length === 0 ? (
            <div className="cc-empty-state">No trend data available yet.</div>
          ) : (
            <TrendChart data={trendData} onBarClick={(date) => { setTrendStart(date); setTrendEnd(date); fetchTrendRange(date, date) }} />
          )}
        </div>
      </div>

      {/* Alert Banner */}
      {activeAlarms > 0 && (
        <div className="cc-alert-banner cc-animate-in">
          <div className="cc-alert-banner__icon">🚨</div>
          <div>
            <strong>{activeAlarms} tag{activeAlarms === 1 ? '' : 's'} currently alarming</strong>
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.88rem' }}>Alarm audio will play automatically while the alert remains active.</p>
          </div>
        </div>
      )}

      {/* Secondary Stats Grid */}
      <div className="cc-stats-grid cc-animate-in" style={{ animationDelay: '0.3s' }}>
        <div className="cc-stat-card cc-tilt">
          <div className="cc-stat-card__header">
            <div>
              <div className="cc-stat-card__label">Active alarms</div>
              <div className="cc-stat-card__value">{activeAlarms}</div>
            </div>
            <div className="cc-stat-card__icon">🚨</div>
          </div>
        </div>

        <div className="cc-stat-card cc-tilt">
          <div className="cc-stat-card__header">
            <div>
              <div className="cc-stat-card__label">Overdue items</div>
              <div className="cc-stat-card__value">{overdue}</div>
            </div>
            <div className="cc-stat-card__icon">⏱</div>
          </div>
        </div>

        <div className="cc-stat-card cc-tilt">
          <div className="cc-stat-card__header">
            <div>
              <div className="cc-stat-card__label">Outside lab</div>
              <div className="cc-stat-card__value">{outside}</div>
            </div>
            <div className="cc-stat-card__icon">📍</div>
          </div>
        </div>

        <div className="cc-stat-card cc-tilt">
          <div className="cc-stat-card__header">
            <div>
              <div className="cc-stat-card__label">Disabled tags</div>
              <div className="cc-stat-card__value">{disabled}</div>
            </div>
            <div className="cc-stat-card__icon">🔒</div>
          </div>
        </div>
      </div>

      {/* Tags Table */}
      <div className="cc-content-card cc-animate-in" style={{ animationDelay: '0.35s' }} id="tag-list">
        <div className="cc-card-header">
          <div>
            <h3 className="cc-card-title">All tags</h3>
            <p className="cc-card-subtitle">{tagFilter ? `Filtered view: ${tagFilter}.` : 'A live view of every tag in the lab system.'}</p>
          </div>
          <div className="cc-card-chips">
            <button className="cc-pill cc-pill--neutral" onClick={() => setTagFilter('')}>{tags.length} total</button>
            <span className="cc-pill cc-pill--warning">{activeAlarms} alarming</span>
          </div>
        </div>

        {loadError ? (
          <div className="cc-empty-state" role="alert">{loadError}</div>
        ) : loading ? (
          <div className="cc-loading-state">Loading tags…</div>
        ) : visibleTags.length === 0 ? (
          <div className="cc-empty-state">No tags have been created yet.</div>
        ) : (
          <div className="cc-table-wrapper">
            <table className="cc-data-table">
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
                  <tr key={tag._id} className={`cc-tag-row ${tag.alertStatus === 'ALARMING' ? 'cc-tag-row--alarming' : tag.alertStatus === 'OVERDUE' ? 'cc-tag-row--overdue' : ''}`}>
                    <td>
                      <div className="cc-table-main"><Link to={`/tags/${tag._id}/history`}>{tag.tagId}</Link></div>
                      {tag.alertStatus === 'ALARMING' && <div className="cc-table-meta">🚨 Immediate attention required</div>}
                      {tag.alertStatus === 'OVERDUE' && <div className="cc-table-meta">⏱ Return or resolve overdue item</div>}
                    </td>
                    <td>{tag.equipment?.name || 'N/A'}</td>
                    <td>{tag.status}</td>
                    <td>{tag.assignedZone?.name || 'Unassigned'}</td>
                    <td>{tag.currentZone?.name || 'Outside all zones'}</td>
                    <td>
                      <span className={`cc-status-pill ${tag.alertStatus === 'ALARMING' ? 'cc-status-pill--danger' : tag.alertStatus === 'OVERDUE' ? 'cc-status-pill--warning' : 'cc-status-pill--neutral'}`}>
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

      <style>{`
        /* ─── Dashboard Layout ───────────────────────────────────── */
        .cc-dashboard {
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
        }

        /* ─── Page Header ────────────────────────────────────────── */
        .cc-page-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          padding: 1.25rem 1.5rem;
          background: var(--cc-glass-bg);
          backdrop-filter: blur(var(--cc-glass-blur));
          -webkit-backdrop-filter: blur(var(--cc-glass-blur));
          border: 1px solid var(--cc-glass-border);
          border-radius: var(--cc-radius-lg);
        }

        .cc-eyebrow {
          margin: 0 0 0.35rem;
          text-transform: uppercase;
          letter-spacing: 0.2em;
          font-size: 0.76rem;
          color: var(--cc-accent);
          font-weight: 700;
        }

        .cc-page-title {
          margin: 0;
          font-size: 1.75rem;
          font-weight: 700;
          color: var(--cc-text-primary);
        }

        .cc-page-subtitle {
          margin: 0.3rem 0 0;
          color: var(--cc-text-secondary);
          font-size: 0.92rem;
        }

        .cc-page-actions {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        /* ─── Banners ────────────────────────────────────────────── */
        .cc-banner {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 1rem;
          padding: 0.85rem 1.25rem;
          border-radius: var(--cc-radius-md);
          font-size: 0.92rem;
          animation: cc-slideUp 300ms ease;
        }

        .cc-banner--info {
          background: rgba(14, 165, 233, 0.08);
          color: #1e40af;
          border: 1px solid rgba(14, 165, 233, 0.2);
        }

        .cc-banner--success {
          background: rgba(34, 197, 94, 0.08);
          color: #166534;
          border: 1px solid rgba(34, 197, 94, 0.2);
        }

        /* ─── Status Pills ───────────────────────────────────────── */
        .cc-status-pills {
          display: flex;
          flex-wrap: wrap;
          gap: 0.6rem;
        }

        /* ─── Stats Grid ─────────────────────────────────────────── */
        .cc-stats-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 1rem;
        }

        .cc-stat-card__header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
        }

        .cc-stat-card__icon {
          font-size: 1.5rem;
          opacity: 0.8;
        }

        .cc-stat-card__trend {
          font-size: 0.78rem;
          font-weight: 600;
          margin-top: 0.35rem;
        }

        .cc-stat-card__trend--up {
          color: #22c55e;
        }

        .cc-stat-card__trend--down {
          color: #f59e0b;
        }

        /* ─── Content Card ───────────────────────────────────────── */
        .cc-content-card {
          background: var(--cc-glass-bg);
          backdrop-filter: blur(var(--cc-glass-blur));
          -webkit-backdrop-filter: blur(var(--cc-glass-blur));
          border: 1px solid var(--cc-glass-border);
          border-radius: var(--cc-radius-lg);
          padding: 1.25rem 1.5rem;
        }

        .cc-card-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1rem;
          gap: 1rem;
        }

        .cc-card-title {
          margin: 0;
          font-size: 1.1rem;
          font-weight: 600;
          color: var(--cc-text-primary);
        }

        .cc-card-subtitle {
          margin: 0.25rem 0 0;
          color: var(--cc-text-secondary);
          font-size: 0.88rem;
        }

        .cc-card-controls {
          display: flex;
          gap: 0.5rem;
          align-items: center;
          flex-wrap: wrap;
        }

        .cc-date-label {
          font-size: 0.82rem;
          color: var(--cc-text-secondary);
        }

        .cc-date-input {
          margin-left: 0.4rem;
          padding: 0.4rem 0.5rem;
          border-radius: var(--cc-radius-sm);
          border: 1px solid var(--cc-glass-border);
          background: #ffffff;
          color: var(--cc-text-primary);
          font-size: 0.85rem;
          transition: border-color 200ms ease, box-shadow 200ms ease;
        }

        .cc-date-input:focus {
          outline: none;
          border-color: var(--cc-accent);
          box-shadow: 0 0 0 3px rgba(47, 103, 246, 0.12);
        }

        .cc-card-chips {
          display: flex;
          gap: 0.5rem;
        }

        /* ─── Pie layout — big, centered donut ─────────────────── */
        .cc-pie-layout {
          display: flex;
          justify-content: center;
          padding: 0.5rem 0 0.25rem;
        }

        /* ─── Alert Banner ───────────────────────────────────────── */
        .cc-alert-banner {
          display: flex;
          gap: 0.8rem;
          align-items: center;
          padding: 1rem 1.25rem;
          border-radius: var(--cc-radius-md);
          background: rgba(239, 68, 68, 0.06);
          border: 1px solid rgba(239, 68, 68, 0.2);
          color: #b91c1c;
        }

        .cc-alert-banner__icon {
          font-size: 1.25rem;
        }

        .cc-alert-banner strong {
          color: #b91c1c;
        }

        /* ─── Table ──────────────────────────────────────────────── */
        .cc-table-wrapper {
          overflow-x: auto;
          margin: 0 -0.5rem;
          padding: 0 0.5rem;
        }

        .cc-data-table {
          width: 100%;
          border-collapse: collapse;
        }

        .cc-data-table th,
        .cc-data-table td {
          padding: 0.85rem 0.75rem;
          text-align: left;
          border-bottom: 1px solid var(--cc-glass-border);
          transition: background 150ms ease;
        }

        .cc-data-table th {
          color: var(--cc-text-muted);
          font-size: 0.76rem;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          font-weight: 700;
        }

        .cc-data-table tbody tr:hover {
          background: rgba(0, 0, 0, 0.03);
        }

        .cc-table-main {
          font-weight: 600;
        }

        .cc-table-main a {
          color: var(--cc-accent);
          text-decoration: none;
          transition: opacity var(--cc-transition-fast);
        }

        .cc-table-main a:hover {
          opacity: 0.7;
          text-decoration: underline;
        }

        .cc-table-meta {
          font-size: 0.78rem;
          color: var(--cc-text-muted);
          margin-top: 0.25rem;
        }

        .cc-tag-row--alarming {
          background: rgba(239, 68, 68, 0.05);
        }

        .cc-tag-row--overdue {
          background: rgba(245, 158, 11, 0.05);
        }

        /* ─── Status Pill Variants ───────────────────────────────── */
        .cc-status-pill {
          display: inline-flex;
          align-items: center;
          border-radius: var(--cc-radius-full);
          padding: 0.3rem 0.6rem;
          font-size: 0.72rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        .cc-status-pill--danger {
          background: rgba(239, 68, 68, 0.10);
          color: #b91c1c;
        }

        .cc-status-pill--warning {
          background: rgba(245, 158, 11, 0.10);
          color: #92400e;
        }

        .cc-status-pill--neutral {
          background: rgba(0, 0, 0, 0.06);
          color: var(--cc-text-secondary);
        }

        /* ─── Empty / Loading States ─────────────────────────────── */
        .cc-empty-state,
        .cc-loading-state {
          padding: 2rem;
          border-radius: var(--cc-radius-md);
          background: rgba(0,0,0,0.03);
          color: var(--cc-text-secondary);
          text-align: center;
          font-size: 0.92rem;
        }

        .cc-loading-state {
          position: relative;
        }

        .cc-loading-state::before {
          content: '';
          display: inline-block;
          width: 20px;
          height: 20px;
          border: 2.5px solid rgba(0,0,0,0.1);
          border-top-color: #2f67f6;
          border-radius: 50%;
          animation: spin 700ms linear infinite;
          margin-bottom: 0.6rem;
        }

        @keyframes spin { to { transform: rotate(360deg); } }

        /* ─── Responsive ─────────────────────────────────────────── */
        @media (max-width: 960px) {
          .cc-stats-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 640px) {
          .cc-stats-grid {
            grid-template-columns: 1fr;
          }

          .cc-page-header {
            flex-direction: column;
            gap: 1rem;
          }

          .cc-card-controls {
            flex-direction: column;
            align-items: stretch;
          }
        }
      `}</style>
    </div>
  )
}
