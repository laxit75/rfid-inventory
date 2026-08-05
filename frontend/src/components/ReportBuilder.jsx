import { useState } from 'react'
import api from '../api'

const SECTIONS = {
  alerts: 'Alert activity',
  movements: 'Movement events',
  devices: 'Device inventory'
}

export default function ReportBuilder() {
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [include, setInclude] = useState({ alerts: true, movements: true, devices: false })
  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const build = async (event) => {
    event.preventDefault()
    if (from && to && new Date(to) < new Date(from)) {
      setError('The "To" date must be on or after the "From" date.')
      return
    }
    const selected = Object.entries(include).filter(([, v]) => v).map(([key]) => key)
    if (selected.length === 0) {
      setError('Select at least one data section to include in the report.')
      return
    }
    setLoading(true)
    setError('')
    const params = {}
    if (from) params.start = from
    if (to) params.end = to
    try {
      const result = {}
      if (include.alerts) result.alerts = (await api.get('/api/audit/alerts', { params })).data
      if (include.movements) result.movements = (await api.get('/api/audit/movements', { params })).data
      if (include.devices) result.devices = (await api.get('/api/devices')).data
      setReport(result)
    } catch (err) {
      setError('Unable to build the report. Check the connection and try again.')
      setReport(null)
    } finally {
      setLoading(false)
    }
  }

  const clear = () => {
    setReport(null)
    setError('')
  }

  const alerts = report?.alerts || []
  const movements = report?.movements || []
  const devices = report?.devices || []
  const periodLabel = from || to
    ? `${from || 'earliest'} → ${to || 'today'}`
    : 'All time'

  const alertTone = (type) =>
    /ALARM|OVERDUE/.test(type || '') ? 'danger'
      : /EMAIL/.test(type || '') ? 'warning'
        : 'neutral'

  const movementTone = (direction) =>
    direction === 'RETURN' ? 'success'
      : direction === 'EXIT' ? 'warning'
        : 'neutral'

  return (
    <div className="rb-root">
      {/* Page header */}
      <div className="cc-page-header cc-animate-in">
        <div>
          <p className="cc-eyebrow">Reporting</p>
          <h2 className="cc-page-title">Report builder</h2>
          <p className="cc-page-subtitle">Choose a reporting period and data sections, then build the report right here.</p>
        </div>
        {report && !loading && (
          <div className="rb-built-badge">
            <span className="cc-live-badge">
              <span className="cc-live-dot" /> Built
            </span>
            <span className="rb-period">{periodLabel}</span>
          </div>
        )}
      </div>

      {/* Builder form */}
      <section className="cc-content-card cc-animate-in" style={{ animationDelay: '0.05s' }}>
        <form className="rb-form" onSubmit={build}>
          <div className="rb-fields">
            <label className="rb-field">
              <span className="rb-label">From</span>
              <input
                type="date"
                className="cc-date-input"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
            </label>
            <label className="rb-field">
              <span className="rb-label">To</span>
              <input
                type="date"
                className="cc-date-input"
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
            </label>
            <div className="rb-options">
              <span className="rb-label">Include</span>
              {Object.entries(SECTIONS).map(([key, label]) => (
                <label key={key} className="rb-check">
                  <input
                    type="checkbox"
                    checked={include[key]}
                    onChange={(e) => setInclude({ ...include, [key]: e.target.checked })}
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>
          <div className="rb-actions">
            <button className="cc-btn-accent cc-magnetic" type="submit" disabled={loading}>
              {loading ? 'Building…' : 'Build report'}
            </button>
            {report && !loading && (
              <button className="cc-btn-ghost cc-magnetic" type="button" onClick={clear}>
                Clear
              </button>
            )}
          </div>
        </form>
      </section>

      {error && <div className="inline-banner error">{error}</div>}
      {loading && <div className="cc-loading-state">Building report…</div>}

      {/* Built report */}
      {report && !loading && (
        <div className="rb-report">
          <div className="rb-stats">
            <div className="cc-stat-card" style={{ cursor: 'default' }}>
              <div className="rb-stat-inner">
                <div>
                  <div className="cc-stat-card__label">Alert events</div>
                  <div className="cc-stat-card__value">{alerts.length}</div>
                </div>
                <div className="rb-stat-chip">🔔</div>
              </div>
            </div>
            <div className="cc-stat-card" style={{ cursor: 'default' }}>
              <div className="rb-stat-inner">
                <div>
                  <div className="cc-stat-card__label">Movement events</div>
                  <div className="cc-stat-card__value">{movements.length}</div>
                </div>
                <div className="rb-stat-chip">🚶</div>
              </div>
            </div>
            <div className="cc-stat-card" style={{ cursor: 'default' }}>
              <div className="rb-stat-inner">
                <div>
                  <div className="cc-stat-card__label">Devices</div>
                  <div className="cc-stat-card__value">{devices.length}</div>
                </div>
                <div className="rb-stat-chip">📡</div>
              </div>
            </div>
          </div>

          {include.alerts && (
            <section className="cc-content-card">
              <div className="rb-card-header">
                <div>
                  <h3 className="cc-card-title">Alert activity</h3>
                  <p className="cc-card-subtitle">Alarm and email events{periodLabel !== 'All time' ? ` from ${periodLabel}` : ' across all time'}.</p>
                </div>
              </div>
              {alerts.length === 0 ? (
                <div className="cc-empty-state">No alert activity found for this period.</div>
              ) : (
                <div className="cc-table-wrapper">
                  <table className="cc-data-table">
                    <thead>
                      <tr><th>Time</th><th>Type</th><th>Tag</th><th>Details</th></tr>
                    </thead>
                    <tbody>
                      {alerts.map((item) => (
                        <tr key={item._id}>
                          <td>{new Date(item.timestamp).toLocaleString()}</td>
                          <td><span className={`status-pill ${alertTone(item.type)}`}>{item.type}</span></td>
                          <td>{item.tagId}</td>
                          <td>{item.details || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}

          {include.movements && (
            <section className="cc-content-card">
              <div className="rb-card-header">
                <div>
                  <h3 className="cc-card-title">Movement events</h3>
                  <p className="cc-card-subtitle">Tag movements{periodLabel !== 'All time' ? ` from ${periodLabel}` : ' across all time'}, most recent first.</p>
                </div>
              </div>
              {movements.length === 0 ? (
                <div className="cc-empty-state">No movement events found for this period.</div>
              ) : (
                <div className="cc-table-wrapper">
                  <table className="cc-data-table">
                    <thead>
                      <tr><th>Time</th><th>Direction</th><th>Tag</th><th>Reader</th><th>Classification</th></tr>
                    </thead>
                    <tbody>
                      {movements.map((item) => (
                        <tr key={item._id}>
                          <td>{new Date(item.createdAt).toLocaleString()}</td>
                          <td><span className={`status-pill ${movementTone(item.direction)}`}>{item.direction}</span></td>
                          <td>{item.tagId}</td>
                          <td>{item.readerId || '—'}</td>
                          <td>{item.classification || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}

          {include.devices && (
            <section className="cc-content-card">
              <div className="rb-card-header">
                <div>
                  <h3 className="cc-card-title">Device inventory</h3>
                  <p className="cc-card-subtitle">Registered speakers, sirens, and displays across all zones.</p>
                </div>
              </div>
              {devices.length === 0 ? (
                <div className="cc-empty-state">No devices registered yet.</div>
              ) : (
                <div className="cc-table-wrapper">
                  <table className="cc-data-table">
                    <thead>
                      <tr><th>Name</th><th>Type</th><th>Zone</th><th>Status</th></tr>
                    </thead>
                    <tbody>
                      {devices.map((item) => (
                        <tr key={item._id}>
                          <td>{item.name}</td>
                          <td>{item.type}</td>
                          <td>{item.zone?.name || 'Global'}</td>
                          <td>
                            <span className={`status-pill ${item.active ? 'success' : 'neutral'}`}>
                              {item.active ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}
        </div>
      )}

      <style>{`
        .rb-root {
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
        }

        .rb-built-badge {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 0.4rem;
        }

        .rb-period {
          font-size: 0.78rem;
          color: var(--cc-text-secondary);
          font-weight: 600;
          font-variant-numeric: tabular-nums;
        }

        .rb-form {
          display: flex;
          flex-direction: column;
          gap: 1.1rem;
        }

        .rb-fields {
          display: flex;
          flex-wrap: wrap;
          gap: 1.25rem;
          align-items: flex-end;
        }

        .rb-field {
          display: flex;
          flex-direction: column;
          gap: 0.4rem;
        }

        .rb-label {
          font-size: 0.8rem;
          font-weight: 600;
          color: var(--cc-text-secondary);
        }

        .rb-options {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 0.5rem 1.1rem;
          padding: 0.65rem 1rem;
          border-radius: 12px;
          background: rgba(47, 103, 246, 0.05);
          border: 1px solid rgba(47, 103, 246, 0.14);
        }

        .rb-check {
          display: inline-flex;
          align-items: center;
          gap: 0.45rem;
          font-size: 0.88rem;
          color: var(--cc-text-primary);
          cursor: pointer;
          user-select: none;
        }

        .rb-check input {
          width: 15px;
          height: 15px;
          accent-color: var(--cc-accent);
          cursor: pointer;
        }

        .rb-actions {
          display: flex;
          gap: 0.6rem;
        }

        .rb-report {
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
          animation: cc-slideUp 0.4s ease;
        }

        .rb-stats {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 1rem;
        }

        .rb-stat-inner {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 0.75rem;
        }

        .rb-stat-chip {
          width: 42px;
          height: 42px;
          border-radius: 12px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-size: 1.2rem;
          background: linear-gradient(135deg, rgba(47, 103, 246, 0.10), rgba(47, 103, 246, 0.03));
          border: 1px solid rgba(47, 103, 246, 0.16);
          flex-shrink: 0;
        }

        .rb-card-header {
          margin-bottom: 1rem;
        }

        @media (max-width: 720px) {
          .rb-stats { grid-template-columns: 1fr; }
          .rb-fields { flex-direction: column; align-items: stretch; }
          .rb-options { align-items: flex-start; }
          .rb-built-badge { align-items: flex-start; }
        }
      `}</style>
    </div>
  )
}
