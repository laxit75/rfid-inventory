import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import axios from 'axios'

export default function TagHistory() {
  const { tagId } = useParams()
  const [history, setHistory] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const res = await axios.get(`/api/tags/${tagId}/history`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        })
        setHistory(res.data)
      } catch (err) {
        setError('Unable to load tag history.')
      } finally {
        setLoading(false)
      }
    }
    fetchHistory()
  }, [tagId])

  if (loading) return <div className="loading-state">Loading tag history…</div>
  if (error) return <div className="empty-state">{error}</div>
  if (!history) return <div className="empty-state">Tag history not found.</div>

  const { tag, movements, alerts, lifecycle } = history

  return (
    <div className="page-shell">
      <div className="page-head">
        <div>
          <p className="eyebrow">Tag history</p>
          <h2>{tag.tagId}</h2>
          <p className="page-subtitle">Full movement, alert, and lifecycle history for this tag.</p>
        </div>
        <Link className="button button-secondary" to="/tags">Back to tags</Link>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-title">Equipment</div>
          <div className="stat-value">{tag.equipment?.name || 'Unknown'}</div>
        </div>
        <div className="stat-card">
          <div className="stat-title">Current state</div>
          <div className="stat-value">{tag.status}</div>
        </div>
        <div className="stat-card">
          <div className="stat-title">Alert</div>
          <div className="stat-value">{tag.alertStatus}</div>
        </div>
      </div>

      <div className="content-card">
        <h3>Recent lifecycle events</h3>
        {lifecycle.length === 0 ? <div className="empty-state">No lifecycle events recorded.</div> : (
          <ul className="timeline-list">
            {lifecycle.map(event => (
              <li key={event._id} className="timeline-item">
                <div className="timeline-time">{new Date(event.createdAt).toLocaleString()}</div>
                <div className="timeline-body">
                  <strong>{event.eventType}</strong>
                  <p>{event.details || `${event.fromState} → ${event.toState}`}</p>
                  <small>Actor: {event.actor}</small>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="content-card">
        <h3>Alert history</h3>
        {alerts.length === 0 ? <div className="empty-state">No alerts recorded for this tag.</div> : (
          <ul className="timeline-list">
            {alerts.map(alert => (
              <li key={alert._id} className="timeline-item">
                <div className="timeline-time">{new Date(alert.timestamp).toLocaleString()}</div>
                <div className="timeline-body">
                  <strong>{alert.type}</strong>
                  <p>{alert.details}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="content-card">
        <h3>Movement history</h3>
        {movements.length === 0 ? <div className="empty-state">No movements recorded for this tag.</div> : (
          <ul className="timeline-list">
            {movements.map(movement => (
              <li key={movement._id} className="timeline-item">
                <div className="timeline-time">{new Date(movement.createdAt).toLocaleString()}</div>
                <div className="timeline-body">
                  <strong>{movement.direction}</strong>
                  <p>{movement.readerId} — {movement.zone || 'No zone'}</p>
                  <span className="status-pill neutral">{movement.classification}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
