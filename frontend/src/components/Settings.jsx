import { useState, useEffect } from 'react'
import axios from 'axios'
import { useToast } from '../hooks/useToast'
import { settingsSchema } from '../utils/validation'

export default function Settings() {
  const [settings, setSettings] = useState(null)
  const [form, setForm] = useState({})
  const [fieldErrors, setFieldErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const { toast, Toaster } = useToast()

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
    // Clear field error when user corrects the input
    setFieldErrors(prev => ({ ...prev, [name]: undefined }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setFieldErrors({})

    const values = {
      alarmDurationSec: Number(form.alarmDurationSec),
      alarmRepeatIntervalSec: Number(form.alarmRepeatIntervalSec),
      alarmVolume: Number(form.alarmVolume),
      alarmMuted: Boolean(form.alarmMuted),
      emailRepeatIntervalSec: Number(form.emailRepeatIntervalSec),
      overdueEmailRepeatIntervalSec: Number(form.overdueEmailRepeatIntervalSec)
    }

    // Validate with Zod schema (inspired by MSIL production system)
    const result = settingsSchema.safeParse(values)
    if (!result.success) {
      const errors = {}
      result.error.issues.forEach(issue => {
        const path = issue.path.join('.')
        if (!errors[path]) errors[path] = issue.message
      })
      setFieldErrors(errors)
      toast({ title: 'Validation error', description: result.error.issues[0].message, variant: 'error' })
      return
    }

    setSaving(true)
    try {
      await axios.put('/api/settings', result.data, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      })
      toast({ title: 'Settings saved', description: 'Alarm and notification settings updated successfully.', variant: 'success' })
      fetchSettings()
    } catch (err) {
      toast({ title: 'Save failed', description: err.response?.data?.error || 'Unable to save settings.', variant: 'error' })
    } finally {
      setSaving(false)
    }
  }

  if (!settings) return <div className="loading-state">Loading settings…</div>

  return (
    <div className="page-shell">
      <Toaster />
      <div className="page-head">
        <div>
          <p className="eyebrow">Admin</p>
          <h2>Settings</h2>
          <p className="page-subtitle">Control alarm cadence, sound volume, and repeat intervals.</p>
        </div>
        <span className="protected-badge">Password-protected</span>
      </div>

      <div className="content-card">
        <div className="admin-note" style={{ marginBottom: '1rem' }}>
          <span className="admin-note__icon">🔒</span>
          <div>
            <strong>Password-protected controls</strong><br />
            Per BRD requirements: Only authorized administrators with valid credentials can modify
            alarm and notification settings. All changes are logged to the audit trail.
          </div>
        </div>

        <form onSubmit={handleSubmit} className="form-grid">
          <label className="field-group">
            <span>Alarm duration <span className="protected-badge" style={{ fontSize: '0.65rem', marginLeft: 4 }}>Admin only</span></span>
            <input type="number" name="alarmDurationSec" value={form.alarmDurationSec} onChange={handleChange} min="1" className={fieldErrors.alarmDurationSec ? 'input-error' : ''} />
            {fieldErrors.alarmDurationSec && <span className="field-error">{fieldErrors.alarmDurationSec}</span>}
            <small style={{ color: '#64748b', fontSize: '0.75rem', marginTop: 2 }}>How long each alarm beep lasts (default: 5s, BRD requirement)</small>
          </label>
          <label className="field-group">
            <span>Alarm repeat interval <span className="protected-badge" style={{ fontSize: '0.65rem', marginLeft: 4 }}>Admin only</span></span>
            <input type="number" name="alarmRepeatIntervalSec" value={form.alarmRepeatIntervalSec} onChange={handleChange} min="1" className={fieldErrors.alarmRepeatIntervalSec ? 'input-error' : ''} />
            {fieldErrors.alarmRepeatIntervalSec && <span className="field-error">{fieldErrors.alarmRepeatIntervalSec}</span>}
            <small style={{ color: '#64748b', fontSize: '0.75rem', marginTop: 2 }}>Seconds between alarm beeps while tag is outside (default: 5s, BRD requirement)</small>
          </label>
          <label className="field-group">
            <span>Alarm volume (0-100) <span className="protected-badge" style={{ fontSize: '0.65rem', marginLeft: 4 }}>Admin only</span></span>
            <input type="number" name="alarmVolume" value={form.alarmVolume} onChange={handleChange} min="0" max="100" className={fieldErrors.alarmVolume ? 'input-error' : ''} />
            {fieldErrors.alarmVolume && <span className="field-error">{fieldErrors.alarmVolume}</span>}
            <small style={{ color: '#64748b', fontSize: '0.75rem', marginTop: 2 }}>Volume level for alarm (audible within 10m radius per BRD requirement)</small>
          </label>
          <label className="field-group checkbox-field">
            <input type="checkbox" name="alarmMuted" checked={form.alarmMuted} onChange={handleChange} />
            <span>Mute all alarms globally <span className="protected-badge" style={{ fontSize: '0.65rem', marginLeft: 4 }}>Admin only</span></span>
          </label>
          <label className="field-group">
            <span>Alert email repeat interval <span className="protected-badge" style={{ fontSize: '0.65rem', marginLeft: 4 }}>Admin only</span></span>
            <input type="number" name="emailRepeatIntervalSec" value={form.emailRepeatIntervalSec} onChange={handleChange} min="1" className={fieldErrors.emailRepeatIntervalSec ? 'input-error' : ''} />
            {fieldErrors.emailRepeatIntervalSec && <span className="field-error">{fieldErrors.emailRepeatIntervalSec}</span>}
            <small style={{ color: '#64748b', fontSize: '0.75rem', marginTop: 2 }}>How often to send alert emails while equipment is outside (default: 3600s = 1 hour, BRD requirement)</small>
          </label>
          <label className="field-group">
            <span>Overdue email repeat interval <span className="protected-badge" style={{ fontSize: '0.65rem', marginLeft: 4 }}>Admin only</span></span>
            <input type="number" name="overdueEmailRepeatIntervalSec" value={form.overdueEmailRepeatIntervalSec} onChange={handleChange} min="1" className={fieldErrors.overdueEmailRepeatIntervalSec ? 'input-error' : ''} />
            {fieldErrors.overdueEmailRepeatIntervalSec && <span className="field-error">{fieldErrors.overdueEmailRepeatIntervalSec}</span>}
            <small style={{ color: '#64748b', fontSize: '0.75rem', marginTop: 2 }}>How often to send overdue notifications (default: 86400s = 1 day, BRD requirement)</small>
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
