import { useEffect, useState } from 'react'
import api from '../api'
import TrendChart from './TrendChart'

export default function SummaryReport({ siteId }) {
  const [summary, setSummary] = useState(null)
  const [trend, setTrend] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const params = siteId !== 'all-sites' ? { zone: siteId } : {}
    Promise.all([api.get('/api/reports/summary', { params }), api.get('/api/reports/trends?days=30', { params })])
      .then(([summaryResponse, trendResponse]) => { setSummary(summaryResponse.data); setTrend(trendResponse.data.trend || []) })
      .catch(() => setError('Unable to load the summary report.'))
      .finally(() => setLoading(false))
  }, [siteId])

  if (loading) return <div className="loading-state">Building summary report…</div>
  if (error) return <div className="inline-banner error">{error}</div>
  const cards = [
    ['Tracked tags', (summary.totals.ACTIVE || 0) + (summary.totals.TEMP_DISABLED || 0) + (summary.totals.PERMANENT_DISABLED || 0), 'info'],
    ['Active alarms', summary.alertCounts.ALARMING || 0, 'danger'],
    ['Overdue items', summary.alertCounts.OVERDUE || 0, 'warning'],
    ['Outside lab', summary.outsideCount || 0, 'neutral']
  ]
  return <div className="page-shell"><div className="page-head"><div><p className="eyebrow">Reporting</p><h2>Summary report</h2><p className="page-subtitle">A 30-day operational overview of RFID inventory, alerts, and resolution performance.</p></div></div>
    <div className="stats-grid">{cards.map(([label, value, tone]) => <div key={label} className={`stat-card accent-${tone}`}><div className="stat-title">{label}</div><div className="stat-value">{value}</div></div>)}</div>
    <section className="content-card"><div className="card-header"><div><h3>Alert trend</h3><p className="card-copy">Alarm events raised over the last 30 days.</p></div></div>{trend.length ? <TrendChart data={trend} /> : <div className="empty-state">No alert activity in this period.</div>}</section>
    <section className="content-card"><div className="card-header"><div><h3>Operational totals</h3><p className="card-copy">Current inventory state at the time this report was generated.</p></div></div><div className="report-metrics"><div><span>Healthy / no alert</span><strong>{summary.alertCounts.NONE || 0}</strong></div><div><span>Temporarily disabled</span><strong>{summary.totals.TEMP_DISABLED || 0}</strong></div><div><span>Permanently disabled</span><strong>{summary.totals.PERMANENT_DISABLED || 0}</strong></div><div><span>Avg. alert resolution</span><strong>{summary.avgResolutionMs ? `${Math.round(summary.avgResolutionMs / 60000)} min` : 'N/A'}</strong></div></div></section>
  </div>
}
