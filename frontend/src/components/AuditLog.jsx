import { useEffect, useState } from 'react'
import api from '../api'

export default function AuditLog() {
  const [tab, setTab] = useState('movements')
  const [movements, setMovements] = useState([])
  const [alerts, setAlerts] = useState([])
  const [filterTagId, setFilterTagId] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [loading, setLoading] = useState(true)

  const fetchData = async () => {
    setLoading(true)
    const params = filterTagId ? { tagId: filterTagId } : {}
    try {
      if (tab === 'movements') {
        const res = await api.get('/api/audit/movements', { params })
        setMovements(res.data)
      } else {
        const res = await api.get('/api/audit/alerts', { params })
        setAlerts(res.data)
      }
    } catch {
      // silently fail — empty state shown below
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [tab])

  const handleFilter = (e) => {
    e.preventDefault()
    fetchData()
  }

  const downloadAuditCsv = async () => {
    try {
      const params = {}
      if (startDate) params.start = startDate
      if (endDate) params.end = endDate
      const res = await api.get('/api/reports/audit.csv', {
        params,
        responseType: 'blob'
      })
      const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8;' })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      const fileName = `rfid-audit-${startDate || 'start'}-${endDate || 'end'}.csv`
      link.setAttribute('download', fileName)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch {
      // silently fail download
    }
  }

  const groupedMovements = movements.reduce((acc, item) => {
    const day = new Date(item.createdAt).toLocaleDateString()
    if (!acc[day]) acc[day] = []
    acc[day].push(item)
    return acc
  }, {})

  const groupedAlerts = alerts.reduce((acc, item) => {
    const day = new Date(item.timestamp).toLocaleDateString()
    if (!acc[day]) acc[day] = []
    acc[day].push(item)
    return acc
  }, {})

  return (
    <div className="cc-dashboard">
      {/* Page Header */}
      <div className="cc-page-header cc-animate-in">
        <div>
          <p className="cc-eyebrow">Audit</p>
          <h2 className="cc-page-title">Audit log</h2>
          <p className="cc-page-subtitle">Review movement events and alert history with a readable timeline.</p>
        </div>
      </div>

      {/* Tabs + Filters */}
      <div className="cc-content-card cc-animate-in" style={{ animationDelay: '0.1s' }}>
        {/* Tab switcher */}
        <div className="cc-audit-tabs">
          <button
            className={`cc-audit-tab ${tab === 'movements' ? 'cc-audit-tab--active' : ''}`}
            onClick={() => setTab('movements')}
          >
            Movements
          </button>
          <button
            className={`cc-audit-tab ${tab === 'alerts' ? 'cc-audit-tab--active' : ''}`}
            onClick={() => setTab('alerts')}
          >
            Alerts
          </button>
        </div>

        {/* Filter bar */}
        <form onSubmit={handleFilter} className="cc-filter-bar">
          <label className="cc-field-group">
            <span>Filter by tag</span>
            <input
              className="cc-input"
              placeholder="Tag ID"
              value={filterTagId}
              onChange={e => setFilterTagId(e.target.value)}
            />
          </label>
          <label className="cc-field-group">
            <span>From</span>
            <input
              className="cc-input"
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
            />
          </label>
          <label className="cc-field-group">
            <span>To</span>
            <input
              className="cc-input"
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
            />
          </label>
          <div className="cc-filter-actions">
            <button className="cc-btn-ghost" type="submit">Apply</button>
            <button className="cc-btn-accent" type="button" onClick={downloadAuditCsv}>
              📥 Download CSV
            </button>
          </div>
        </form>

        {/* Content */}
        {loading ? (
          <div className="cc-loading-state">Loading audit entries…</div>
        ) : tab === 'movements' ? (
          <div className="cc-timeline-list">
            {Object.keys(groupedMovements).length === 0 ? (
              <div className="cc-empty-state">No movement events found.</div>
            ) : Object.entries(groupedMovements).map(([day, entries]) => (
              <div key={day} className="cc-timeline-day">
                <h4 className="cc-timeline-day__title">{day}</h4>
                {entries.map(m => (
                  <div key={m._id} className="cc-timeline-item">
                    <div className="cc-timeline-time">
                      {new Date(m.createdAt).toLocaleTimeString()}
                    </div>
                    <div className="cc-timeline-body">
                      <strong style={{ color: 'var(--cc-text-primary)' }}>{m.tagId}</strong>
                      <p style={{ color: 'var(--cc-text-secondary)', margin: '0.2rem 0 0.35rem', fontSize: '0.88rem' }}>
                        {m.direction} via {m.readerId}
                      </p>
                      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                        <span className="cc-status-pill cc-status-pill--neutral">{m.classification}</span>
                        {m.resolvedAt && (
                          <span style={{ fontSize: '0.78rem', color: 'var(--cc-text-muted)' }}>
                            Resolved: {new Date(m.resolvedAt).toLocaleString()}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        ) : (
          <div className="cc-timeline-list">
            {Object.keys(groupedAlerts).length === 0 ? (
              <div className="cc-empty-state">No alert history found.</div>
            ) : Object.entries(groupedAlerts).map(([day, entries]) => (
              <div key={day} className="cc-timeline-day">
                <h4 className="cc-timeline-day__title">{day}</h4>
                {entries.map(a => (
                  <div key={a._id} className="cc-timeline-item">
                    <div className="cc-timeline-time">
                      {new Date(a.timestamp).toLocaleTimeString()}
                    </div>
                    <div className="cc-timeline-body">
                      <strong style={{ color: 'var(--cc-text-primary)' }}>{a.tagId}</strong>
                      <p style={{ color: 'var(--cc-text-secondary)', margin: '0.2rem 0 0.35rem', fontSize: '0.88rem' }}>
                        {a.details}
                      </p>
                      <span className={`cc-status-pill ${a.type.includes('OVERDUE') ? 'cc-status-pill--warning' : 'cc-status-pill--danger'}`}>
                        {a.type}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      <style>{`
        .cc-eyebrow {
          margin: 0 0 0.35rem;
          text-transform: uppercase;
          letter-spacing: 0.2em;
          font-size: 0.76rem;
          color: #1d4ed8;
          font-weight: 700;
        }
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
          gap: 1rem;
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
        .cc-content-card {
          background: var(--cc-glass-bg);
          backdrop-filter: blur(var(--cc-glass-blur));
          -webkit-backdrop-filter: blur(var(--cc-glass-blur));
          border: 1px solid var(--cc-glass-border);
          border-radius: var(--cc-radius-lg);
          padding: 1.25rem 1.5rem;
        }
        /* Tab switcher */
        .cc-audit-tabs {
          display: flex;
          gap: 0.4rem;
          margin-bottom: 1rem;
          padding: 0.35rem;
          background: rgba(0, 0, 0, 0.04);
          border: 1px solid var(--cc-glass-border);
          border-radius: 10px;
          width: fit-content;
        }
        .cc-audit-tab {
          padding: 0.5rem 1.1rem;
          border: none;
          border-radius: 8px;
          background: transparent;
          color: var(--cc-text-secondary);
          font-weight: 500;
          font-size: 0.88rem;
          cursor: pointer;
          transition: all 200ms ease;
        }
        .cc-audit-tab:hover {
          color: var(--cc-text-primary);
          background: rgba(0, 0, 0, 0.04);
        }
        .cc-audit-tab--active {
          background: linear-gradient(135deg, #2f67f6, #1a4ad4) !important;
          color: #ffffff !important;
          font-weight: 600;
          box-shadow: 0 4px 14px rgba(47, 103, 246, 0.28);
        }
        /* Filter bar */
        .cc-filter-bar {
          display: flex;
          flex-wrap: wrap;
          gap: 0.75rem;
          align-items: flex-end;
          margin-bottom: 1.25rem;
          padding-bottom: 1.25rem;
          border-bottom: 1px solid var(--cc-glass-border);
        }
        .cc-filter-actions {
          display: flex;
          gap: 0.5rem;
          align-items: flex-end;
          padding-bottom: 0;
          margin-top: auto;
        }
        .cc-field-group {
          display: flex;
          flex-direction: column;
          gap: 0.35rem;
        }
        .cc-field-group span {
          font-size: 0.82rem;
          font-weight: 600;
          color: var(--cc-text-secondary);
        }
        .cc-input {
          background: #ffffff;
          border: 1px solid var(--cc-glass-border);
          border-radius: var(--cc-radius-sm);
          padding: 0.6rem 0.8rem;
          color: var(--cc-text-primary);
          font-size: 0.88rem;
          transition: border-color 200ms ease, box-shadow 200ms ease;
          min-height: 40px;
        }
        .cc-input:focus {
          outline: none;
          border-color: #2f67f6;
          box-shadow: 0 0 0 3px rgba(47, 103, 246, 0.12);
        }
        input[type="date"].cc-input::-webkit-calendar-picker-indicator {
          opacity: 0.55;
        }
        /* Timeline */
        .cc-timeline-list {
          display: flex;
          flex-direction: column;
          gap: 0;
        }
        .cc-timeline-day {
          padding: 0.75rem 0;
          border-top: 1px solid var(--cc-glass-border);
        }
        .cc-timeline-day:first-child {
          border-top: none;
        }
        .cc-timeline-day__title {
          margin: 0 0 0.65rem;
          font-size: 0.82rem;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: var(--cc-text-muted);
          font-weight: 700;
        }
        .cc-timeline-item {
          display: flex;
          gap: 1rem;
          align-items: flex-start;
          padding: 0.65rem 0;
          border-bottom: 1px solid rgba(0, 0, 0, 0.06);
        }
        .cc-timeline-item:last-child {
          border-bottom: none;
        }
        .cc-timeline-time {
          min-width: 72px;
          color: var(--cc-text-muted);
          font-size: 0.82rem;
          font-variant-numeric: tabular-nums;
          padding-top: 0.1rem;
        }
        .cc-timeline-body {
          flex: 1;
        }
        /* Status pills */
        .cc-status-pill {
          display: inline-flex;
          align-items: center;
          border-radius: 999px;
          padding: 0.25rem 0.55rem;
          font-size: 0.72rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          white-space: nowrap;
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
          color: #475569;
        }
        /* Empty / Loading */
        .cc-empty-state,
        .cc-loading-state {
          padding: 2rem;
          border-radius: 12px;
          background: rgba(0, 0, 0, 0.03);
          color: var(--cc-text-secondary);
          text-align: center;
          font-size: 0.92rem;
        }
        .cc-loading-state::before {
          content: '';
          display: block;
          width: 20px;
          height: 20px;
          border: 2.5px solid rgba(0, 0, 0, 0.12);
          border-top-color: #2f67f6;
          border-radius: 50%;
          animation: spin 700ms linear infinite;
          margin: 0 auto 0.6rem;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        /* Buttons */
        .cc-btn-accent {
          background: linear-gradient(135deg, #2f67f6, #1a4ad4);
          color: #ffffff;
          font-weight: 600;
          border: none;
          border-radius: 10px;
          padding: 0.6rem 1.1rem;
          cursor: pointer;
          font-size: 0.88rem;
          box-shadow: 0 6px 18px rgba(47, 103, 246, 0.25);
          transition: transform 200ms ease, box-shadow 200ms ease, filter 200ms ease;
          display: inline-flex;
          align-items: center;
          gap: 0.4rem;
          min-height: 40px;
        }
        .cc-btn-accent:hover {
          filter: brightness(1.1);
          box-shadow: 0 8px 22px rgba(47, 103, 246, 0.35);
          transform: translateY(-1px);
        }
        .cc-btn-ghost {
          background: transparent;
          color: #1a1a1a;
          font-weight: 600;
          border: 1px solid rgba(0, 0, 0, 0.16);
          border-radius: 10px;
          padding: 0.6rem 1.1rem;
          cursor: pointer;
          font-size: 0.88rem;
          transition: all 200ms ease;
          min-height: 40px;
          display: inline-flex;
          align-items: center;
        }
        .cc-btn-ghost:hover {
          border-color: rgba(47, 103, 246, 0.5);
          background: rgba(47, 103, 246, 0.07);
          color: #1d4ed8;
        }
        .cc-dashboard {
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
        }
        @media (max-width: 640px) {
          .cc-filter-bar {
            flex-direction: column;
          }
          .cc-filter-actions {
            flex-direction: row;
          }
        }
      `}</style>
    </div>
  )
}
