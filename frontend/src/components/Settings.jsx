import { useState, useEffect } from 'react'
import axios from 'axios'

export default function Settings() {
  const [settings, setSettings] = useState(null)
  const [form, setForm] = useState({})
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [saving, setSaving] = useState(false)

  const fetchSettings = async () => {
    const res = await axios.get('/api/settings', {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
    })
    setSettings(res.data)
    setForm(res.data)
  }

  useEffect(() => {
    fetchSettings()
  }, [])

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setForm({ ...form, [name]: type === 'checkbox' ? checked : value })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    const values = {
      alarmDurationSec: Number(form.alarmDurationSec),
      alarmRepeatIntervalSec: Number(form.alarmRepeatIntervalSec),
      alarmVolume: Number(form.alarmVolume),
      emailRepeatIntervalSec: Number(form.emailRepeatIntervalSec),
      overdueEmailRepeatIntervalSec: Number(form.overdueEmailRepeatIntervalSec)
    }

    if ([values.alarmDurationSec, values.alarmRepeatIntervalSec, values.alarmVolume, values.emailRepeatIntervalSec, values.overdueEmailRepeatIntervalSec].some(Number.isNaN)) {
      setError('All numeric fields must be valid numbers.')
      return
    }

    if (values.alarmDurationSec < 1 || values.alarmRepeatIntervalSec < 1 || values.alarmVolume < 0 || values.alarmVolume > 100) {
      setError('Alarm duration and repeat interval must be at least 1 second, and volume must stay between 0 and 100.')
      return
    }

    setSaving(true)
    try {
      await axios.put('/api/settings', { ...form, ...values }, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      })
      setSuccess('Settings updated successfully.')
      fetchSettings()
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to save settings.')
    } finally {
      setSaving(false)
    }
  }

  if (!settings) return <div className="loading-state">Loading settings…</div>

  return (
    <div className="page-shell">
      <div className="page-head">
        <div>
          <p className="eyebrow">Admin</p>
          <h2>Settings</h2>
          <p className="page-subtitle">Control alarm cadence, sound volume, and repeat intervals.</p>
        </div>
      </div>

      <div className="content-card">
        {error && <div className="inline-banner error">{error}</div>}
        {success && <div className="inline-banner success">{success}</div>}
        <form onSubmit={handleSubmit} className="form-grid">
          <label className="field-group">
            <span>Alarm duration (sec)</span>
            <input type="number" name="alarmDurationSec" value={form.alarmDurationSec} onChange={handleChange} min="1" />
          </label>
          <label className="field-group">
            <span>Alarm repeat interval (sec)</span>
            <input type="number" name="alarmRepeatIntervalSec" value={form.alarmRepeatIntervalSec} onChange={handleChange} min="1" />
          </label>
          <label className="field-group">
            <span>Alarm volume (0-100)</span>
            <input type="number" name="alarmVolume" value={form.alarmVolume} onChange={handleChange} min="0" max="100" />
          </label>
          <label className="field-group checkbox-field">
            <input type="checkbox" name="alarmMuted" checked={form.alarmMuted} onChange={handleChange} />
            <span>Mute all alarms globally</span>
          </label>
          <label className="field-group">
            <span>Email repeat interval (sec)</span>
            <input type="number" name="emailRepeatIntervalSec" value={form.emailRepeatIntervalSec} onChange={handleChange} min="1" />
          </label>
          <label className="field-group">
            <span>Overdue email repeat interval (sec)</span>
            <input type="number" name="overdueEmailRepeatIntervalSec" value={form.overdueEmailRepeatIntervalSec} onChange={handleChange} min="1" />
          </label>
          <div className="form-actions">
            <button className="button" type="submit" disabled={saving}>
              {saving ? 'Saving…' : 'Save settings'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
