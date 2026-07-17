import { useEffect, useState } from 'react'
import api from '../api'

export default function FullReport({ siteId }) {
  const [alerts, setAlerts] = useState([])
  const [movements, setMovements] = useState([])
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = async () => {
    setLoading(true); setError('')
    const params = {}; if (start) params.start = start; if (end) params.end = end; if (siteId !== 'all-sites') params.zone = siteId
    try {
      const [alertResponse, movementResponse] = await Promise.all([api.get('/api/audit/alerts', { params }), api.get('/api/audit/movements', { params })])
      setAlerts(alertResponse.data); setMovements(movementResponse.data)
    } catch (err) { setError('Unable to load detailed report data.') } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [siteId])
  const exportCsv = async () => {
    const response = await api.get('/api/reports/audit.csv', { params: { ...(start && { start }), ...(end && { end }), ...(siteId !== 'all-sites' && { zone: siteId }) }, responseType: 'blob' })
    const url = URL.createObjectURL(new Blob([response.data], { type: 'text/csv' })); const link = document.createElement('a'); link.href = url; link.download = 'rfid-full-report.csv'; link.click(); URL.revokeObjectURL(url)
  }
  return <div className="page-shell"><div className="page-head"><div><p className="eyebrow">Reporting</p><h2>Full report</h2><p className="page-subtitle">Review complete movement and alert activity, then export the audit file.</p></div></div>
    <section className="content-card"><form className="filter-bar" onSubmit={e => { e.preventDefault(); load() }}><label className="field-group compact"><span>From</span><input type="date" value={start} onChange={e => setStart(e.target.value)} /></label><label className="field-group compact"><span>To</span><input type="date" value={end} onChange={e => setEnd(e.target.value)} /></label><button className="button button-secondary">Apply filters</button><button className="button" type="button" onClick={exportCsv}>Export CSV</button></form></section>
    {error && <div className="inline-banner error">{error}</div>}
    <div className="stats-grid"><div className="stat-card accent-info"><div className="stat-title">Movement events</div><div className="stat-value">{movements.length}</div></div><div className="stat-card accent-danger"><div className="stat-title">Alert events</div><div className="stat-value">{alerts.length}</div></div></div>
    <section className="content-card"><div className="card-header"><div><h3>Combined activity</h3><p className="card-copy">Most recent first.</p></div></div>{loading ? <div className="loading-state">Loading full report…</div> : <div className="table-wrapper"><table className="data-table"><thead><tr><th>Time</th><th>Type</th><th>Tag</th><th>Details</th></tr></thead><tbody>{[...alerts.map(item => ({ ...item, reportType: item.type, reportTime: item.timestamp, reportDetails: item.details })), ...movements.map(item => ({ ...item, reportType: item.direction, reportTime: item.createdAt, reportDetails: `${item.classification} via ${item.readerId}` }))].sort((a, b) => new Date(b.reportTime) - new Date(a.reportTime)).map((item, index) => <tr key={`${item._id}-${index}`}><td>{new Date(item.reportTime).toLocaleString()}</td><td><span className="status-pill neutral">{item.reportType}</span></td><td>{item.tagId}</td><td>{item.reportDetails || '—'}</td></tr>)}</tbody></table>{!alerts.length && !movements.length && <div className="empty-state">No activity found for this period.</div>}</div>}</section>
  </div>
}
