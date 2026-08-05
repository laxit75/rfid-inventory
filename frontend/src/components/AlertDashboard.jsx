import { useEffect, useState, useRef, useCallback } from 'react'
import axios from 'axios'
import { connectRealtime } from '../realtime'
import { useToast } from '../hooks/useToast'

export default function AlertDashboard() {
  const [alertStates, setAlertStates] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all') // 'all' | 'unintentional_alert' | 'temp_disabled_overdue'
  const { toast, Toaster } = useToast()
  const socketRef = useRef(null)

  const token = localStorage.getItem('token')
  const headers = { Authorization: `Bearer ${token}` }

  const fetchAlertStates = useCallback(async () => {
    try {
      const params = filter !== 'all' ? { status: filter } : {}
      const res = await axios.get('/api/tag-alert-states', { params, headers })
      setAlertStates(res.data)
      setLoading(false)
    } catch (err) {
      console.warn('Failed to fetch alert states', err)
      setLoading(false)
    }
  }, [filter])

  // Fetch on mount and when filter changes
  useEffect(() => {
    fetchAlertStates()
  }, [fetchAlertStates])

  // Socket.io real-time subscription — set up once, not on filter change
  useEffect(() => {
    const sock = connectRealtime()
    socketRef.current = sock

    const handleUpdate = (payload) => {
      if (!payload?.tagId) return
      setAlertStates(prev => {
        const idx = prev.findIndex(s => s.tagId === payload.tagId)
        if (idx === -1) {
          // New alert state — fetch full record
          axios.get(`/api/tag-alert-states/${payload.tagId}`, { headers })
            .then(res => {
              setAlertStates(p => [...p, res.data])
            })
            .catch(() => {})
          return prev
        }
        const copy = [...prev]
        copy[idx] = { ...copy[idx], ...payload }
        return copy
      })
    }

    sock.on('tagAlertState:update', handleUpdate)

    return () => {
      sock.off('tagAlertState:update', handleUpdate)
      socketRef.current = null
    }
  }, []) // Only on mount

  const handleMute = async (tagId) => {
    try {
      await axios.post(`/api/tag-alert-states/${tagId}/mute`,
        { mutedBy: 'operator', muteDurationMs: 5 * 60 * 1000 },
        { headers }
      )
      toast({ title: 'Tag muted', description: `${tagId} silenced for 5 minutes`, variant: 'success' })
      fetchAlertStates()
    } catch (err) {
      toast({
        title: 'Mute failed',
        description: err.response?.data?.error || 'Unable to mute tag',
        variant: 'error'
      })
    }
  }

  const handleResolve = async (tagId) => {
    try {
      await axios.post(`/api/tag-alert-states/${tagId}/resolve`, {}, { headers })
      toast({ title: 'Alert resolved', description: `${tagId} cleared`, variant: 'success' })
      fetchAlertStates()
    } catch (err) {
      toast({
        title: 'Resolve failed',
        description: err.response?.data?.error || 'Unable to resolve',
        variant: 'error'
      })
    }
  }

  const formatDuration = (fromDate) => {
    if (!fromDate) return '—'
    const ms = Date.now() - new Date(fromDate).getTime()
    const mins = Math.floor(ms / 60000)
    if (mins < 1) return '< 1 min'
    if (mins < 60) return `${mins}m`
    const hours = Math.floor(mins / 60)
    const remainMins = mins % 60
    return `${hours}h ${remainMins}m`
  }

  const statusBadge = (status, alarmMuted) => {
    if (alarmMuted) return <span className="nx-badge nx-badge-neutral">🔇 Muted</span>
    switch (status) {
      case 'unintentional_alert':
        return <span className="nx-badge nx-badge-danger">🚨 Alerting</span>
      case 'temp_disabled_overdue':
        return <span className="nx-badge nx-badge-warning">⏱ Overdue</span>
      case 'normal':
        return <span className="nx-badge nx-badge-success">Normal</span>
      default:
        return <span className="nx-badge nx-badge-neutral">{status}</span>
    }
  }

  const isMutedExpired = (state) => {
    if (!state.alarmMuted || !state.muteExpiresAt) return false
    return new Date(state.muteExpiresAt) <= new Date()
  }

  const alertCount = alertStates.filter(s => s.status === 'unintentional_alert' && !s.alarmMuted).length
  const overdueCount = alertStates.filter(s => s.status === 'temp_disabled_overdue').length

  return (
    <div className="cc-dashboard">
      <Toaster />
      <div className="cc-page-header cc-animate-in" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <p className="cc-eyebrow">Alerts</p>
          <h2 className="cc-page-title">Live alert dashboard</h2>
          <p className="cc-page-subtitle">
            Real-time view of tag alert states. Mute or resolve alerts as needed.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div className="cc-live-badge cc-live-badge--live"><span className="cc-live-dot" /> LIVE</div>
          {alertCount > 0 && (
            <span className="cc-pill cc-pill--alarm">🚨 {alertCount} alerting</span>
          )}
          {overdueCount > 0 && (
            <span className="cc-pill cc-pill--warning">⏱ {overdueCount} overdue</span>
          )}
        </div>
      </div>

      <div className="cc-alert-tabs cc-animate-in" style={{ animationDelay: '0.1s' }}>
        {['all', 'unintentional_alert', 'temp_disabled_overdue'].map((f) => (
          <button
            key={f}
            className={`cc-alert-tab ${filter === f ? 'cc-alert-tab--active' : ''}`}
            onClick={() => setFilter(f === 'all' ? 'all' : f)}
          >
            {f === 'all' ? 'All' : f === 'unintentional_alert' ? 'Alerting' : 'Overdue'}
          </button>
        ))}
      </div>

      <div className="cc-content-card cc-animate-in" style={{ animationDelay: '0.2s' }}>
        {loading ? (
          <div className="cc-loading-state">Loading alert states…</div>
        ) : alertStates.length === 0 ? (
          <div className="cc-empty-state">
            <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>✅</div>
            <p style={{ fontWeight: 600, fontSize: '1rem', marginBottom: '0.25rem', color: 'var(--cc-text-primary)' }}>No active alerts</p>
            <p style={{ color: 'var(--cc-text-secondary)', fontSize: '0.9rem' }}>All tags are accounted for.</p>
          </div>
        ) : (
          <div className="cc-table-wrapper">
            <table className="cc-data-table">
              <thead>
                <tr>
                  <th>Tag ID</th>
                  <th>Status</th>
                  <th>Duration</th>
                  <th>Alarm count</th>
                  <th>Location</th>
                  <th>Last triggered</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {alertStates.map((s) => (
                  <tr
                    key={s.tagId}
                    className={
                      s.status === 'unintentional_alert' && !s.alarmMuted
                        ? 'cc-tag-row--alarming'
                        : ''
                    }
                  >
                    <td><strong style={{ fontFamily: 'monospace', fontSize: '0.92rem' }}>{s.tagId}</strong></td>
                    <td>{statusBadge(s.status, s.alarmMuted && !isMutedExpired(s))}</td>
                    <td style={{ color: 'var(--cc-text-secondary)', fontSize: '0.85rem' }}>{formatDuration(s.firstDetectedAt)}</td>
                    <td>
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        minWidth: '28px',
                        padding: '2px 8px',
                        borderRadius: '8px',
                        background: (s.alarmCount || 0) > 0 ? 'rgba(239, 68, 68, 0.10)' : 'rgba(0, 0, 0, 0.06)',
                        color: (s.alarmCount || 0) > 0 ? '#b91c1c' : 'var(--cc-text-secondary)',
                        fontWeight: 700,
                        fontSize: '0.88rem'
                      }}>
                        {s.alarmCount || 0}
                      </span>
                    </td>
                    <td style={{ color: 'var(--cc-text-secondary)', fontSize: '0.85rem' }}>{s.location || s.vehicleId || '—'}</td>
                    <td style={{ color: 'var(--cc-text-muted)', fontSize: '0.85rem' }}>
                      {s.lastAlarmTriggeredAt
                        ? new Date(s.lastAlarmTriggeredAt).toLocaleTimeString()
                        : '—'}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        {s.status === 'unintentional_alert' && !s.alarmMuted && (
                          <button
                            className="cc-btn-ghost cc-magnetic"
                            style={{ fontSize: '0.78rem', padding: '0.3rem 0.6rem' }}
                            onClick={() => handleMute(s.tagId)}
                            title="Mute alarm for 5 minutes"
                          >
                            🔇 Mute
                          </button>
                        )}
                        {(s.status === 'unintentional_alert' || s.status === 'temp_disabled_overdue') && (
                          <button
                            className="cc-btn-accent cc-magnetic"
                            style={{ fontSize: '0.78rem', padding: '0.3rem 0.6rem' }}
                            onClick={() => handleResolve(s.tagId)}
                            title="Mark as resolved"
                          >
                            ✓ Resolve
                          </button>
                        )}
                        {s.alarmMuted && !isMutedExpired(s) && (
                          <span className="cc-pill cc-pill--neutral" style={{ fontSize: '0.72rem' }}>
                            Muted until {new Date(s.muteExpiresAt).toLocaleTimeString()}
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <style>{`
        .cc-alert-tabs {
          display: flex;
          gap: 0.4rem;
          padding: 0.5rem;
          background: var(--cc-glass-bg);
          backdrop-filter: blur(var(--cc-glass-blur));
          -webkit-backdrop-filter: blur(var(--cc-glass-blur));
          border: 1px solid var(--cc-glass-border);
          border-radius: var(--cc-radius-md);
        }
        .cc-alert-tab {
          padding: 0.55rem 1rem;
          border-radius: var(--cc-radius-sm);
          border: none;
          background: transparent;
          color: var(--cc-text-secondary);
          font-weight: 500;
          font-size: 0.88rem;
          cursor: pointer;
          transition: all var(--cc-transition-fast);
        }
        .cc-alert-tab:hover {
          color: var(--cc-text-primary);
          background: rgba(0, 0, 0, 0.04);
        }
        .cc-alert-tab--active {
          background: linear-gradient(135deg, #2f67f6, #1a4ad4) !important;
          color: #ffffff !important;
          font-weight: 600;
          box-shadow: 0 4px 14px rgba(47, 103, 246, 0.28);
        }
      `}</style>
    </div>
  )
}
