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

  const token = localStorage.getItem('token')

  const fetchData = async () => {
    setLoading(true)
    const params = filterTagId ? { tagId: filterTagId } : {}
    try {
      // Diagnostic: ensure token is present and header being set
      console.debug('AuditLog: using token (length):', token ? token.length : null)
      if (tab === 'movements') {
        const res = await api.get('/api/audit/movements', { params })
        setMovements(res.data)
      } else {
        const res = await api.get('/api/audit/alerts', { params })
        setAlerts(res.data)
      }
    } catch (err) {
      // Log full error for debugging (shows response status and data)
      console.error('AuditLog fetchData error:', err?.response ? { status: err.response.status, data: err.response.data } : err.message || err)
      // If unauthorized, optionally clear token to force re-login (do not auto-clear in production)
      if (err?.response?.status === 401) {
        console.warn('AuditLog: received 401 — token may be missing/expired')
      }
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
    } catch (err) {
      console.error('AuditLog download error:', err)
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
    <div className="page-shell">
      <div className="page-head">
        <div>
          <p className="eyebrow">Audit</p>
          <h2>Audit log</h2>
          <p className="page-subtitle">Review movement events and alert history with a clearer, more readable timeline.</p>
        </div>
      </div>

      <div className="content-card">
        <div className="tabs">
          <button onClick={() => setTab('movements')} className={tab === 'movements' ? 'active' : ''}>Movements</button>
          <button onClick={() => setTab('alerts')} className={tab === 'alerts' ? 'active' : ''}>Alerts</button>
        </div>
        <form onSubmit={handleFilter} className="filter-bar">
          <label className="field-group compact">
            <span>Filter by tag</span>
            <input placeholder="Tag ID" value={filterTagId} onChange={e => setFilterTagId(e.target.value)} />
          </label>
          <label className="field-group compact">
            <span>From</span>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
          </label>
          <label className="field-group compact">
            <span>To</span>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
          </label>
          <button className="button button-secondary" type="submit">Apply</button>
          <button className="button button-primary" type="button" onClick={downloadAuditCsv}>Download CSV</button>
        </form>

        {loading ? (
          <div className="loading-state">Loading audit entries…</div>
        ) : tab === 'movements' ? (
          <div className="timeline-list">
            {Object.keys(groupedMovements).length === 0 ? (
              <div className="empty-state">No movement events found.</div>
            ) : Object.entries(groupedMovements).map(([day, entries]) => (
              <div key={day} className="timeline-day">
                <h4>{day}</h4>
                {entries.map(m => (
                  <div key={m._id} className="timeline-item">
                    <div className="timeline-time">{new Date(m.createdAt).toLocaleTimeString()}</div>
                    <div className="timeline-body">
                      <strong>{m.tagId}</strong>
                      <p>{m.direction} via {m.readerId}</p>
                      <span className="status-pill neutral">{m.classification}</span>
                      <p className="card-copy">Resolved: {m.resolvedAt ? new Date(m.resolvedAt).toLocaleString() : 'No'}</p>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        ) : (
          <div className="timeline-list">
            {Object.keys(groupedAlerts).length === 0 ? (
              <div className="empty-state">No alert history found.</div>
            ) : Object.entries(groupedAlerts).map(([day, entries]) => (
              <div key={day} className="timeline-day">
                <h4>{day}</h4>
                {entries.map(a => (
                  <div key={a._id} className="timeline-item">
                    <div className="timeline-time">{new Date(a.timestamp).toLocaleTimeString()}</div>
                    <div className="timeline-body">
                      <strong>{a.tagId}</strong>
                      <p>{a.details}</p>
                      <span className={`status-pill ${a.type.includes('OVERDUE') ? 'warning' : 'danger'}`}>{a.type}</span>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}