import { useState, useEffect } from 'react'
import axios from 'axios'
import ConfirmDialog from './ConfirmDialog'
import { useToast } from '../hooks/useToast'

export default function AlertFlows() {
  const [flows, setFlows] = useState([])
  const [deviceGroups, setDeviceGroups] = useState([])
  const [targetGroups, setTargetGroups] = useState([])
  const [speakers, setSpeakers] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [selectedFlow, setSelectedFlow] = useState(null)
  const { toast, Toaster } = useToast()

  const token = localStorage.getItem('token')

  const emptyForm = {
    name: '',
    description: '',
    enabled: true,
    sourceGroup: '',
    targetGroups: [],
    speakerDevices: [],
    triggerOnExit: true,
    triggerOnOverdue: true,
    isResolutionRequired: false
  }

  const [form, setForm] = useState(emptyForm)

  const loadAll = async () => {
    setLoading(true)
    try {
      const [flowsRes, dgRes, tgRes, speakersRes] = await Promise.all([
        axios.get('/api/alert-flows', { headers: { Authorization: `Bearer ${token}` } }),
        axios.get('/api/device-groups', { headers: { Authorization: `Bearer ${token}` } }),
        axios.get('/api/alert-target-groups', { headers: { Authorization: `Bearer ${token}` } }),
        axios.get('/api/devices', { headers: { Authorization: `Bearer ${token}` } })
      ])
      setFlows(flowsRes.data)
      setDeviceGroups(dgRes.data)
      setTargetGroups(tgRes.data)
      setSpeakers(speakersRes.data.filter(d => d.type === 'SPEAKER'))
    } catch (err) {
      toast({ title: 'Load failed', description: 'Unable to load alert flows.', variant: 'error' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadAll() }, [])

  const startEdit = (flow) => {
    setEditingId(flow._id)
    setForm({
      name: flow.name,
      description: flow.description || '',
      enabled: flow.enabled,
      sourceGroup: flow.sourceGroup?._id || flow.sourceGroup || '',
      targetGroups: flow.targetGroups?.map(t => t._id || t) || [],
      speakerDevices: flow.speakerDevices?.map(s => s._id || s) || [],
      triggerOnExit: flow.triggerOnExit ?? true,
      triggerOnOverdue: flow.triggerOnOverdue ?? true,
      isResolutionRequired: flow.isResolutionRequired ?? false
    })
    setShowForm(true)
    setSelectedFlow(flow._id)
  }

  const handleSave = async (e) => {
    e.preventDefault()
    if (!form.name.trim() || !form.sourceGroup) {
      toast({ title: 'Validation', description: 'Name and source group are required.', variant: 'error' })
      return
    }
    setSaving(true)
    try {
      if (editingId) {
        await axios.put(`/api/alert-flows/${editingId}`, form, { headers: { Authorization: `Bearer ${token}` } })
        toast({ title: 'Flow updated', description: 'Alert flow saved.', variant: 'success' })
      } else {
        await axios.post('/api/alert-flows', form, { headers: { Authorization: `Bearer ${token}` } })
        toast({ title: 'Flow created', description: 'New alert flow created.', variant: 'success' })
      }
      setForm(emptyForm)
      setEditingId(null)
      setShowForm(false)
      setSelectedFlow(null)
      loadAll()
    } catch (err) {
      toast({ title: 'Save failed', description: err.response?.data?.error || 'Unable to save.', variant: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const handleToggle = async (id, currentEnabled) => {
    try {
      await axios.patch(`/api/alert-flows/${id}/toggle`, {}, { headers: { Authorization: `Bearer ${token}` } })
      toast({ title: currentEnabled ? 'Flow disabled' : 'Flow enabled', variant: 'info' })
      loadAll()
    } catch (err) {
      toast({ title: 'Toggle failed', variant: 'error' })
    }
  }

  const handleDelete = async () => {
    if (!confirmDelete) return
    setSaving(true)
    try {
      await axios.delete(`/api/alert-flows/${confirmDelete}`, { headers: { Authorization: `Bearer ${token}` } })
      toast({ title: 'Flow deleted', description: 'Alert flow removed.', variant: 'success' })
      setConfirmDelete(null)
      setSelectedFlow(null)
      loadAll()
    } catch (err) {
      toast({ title: 'Delete failed', variant: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const toggleArrayItem = (field, id) => {
    setForm(prev => ({
      ...prev,
      [field]: prev[field].includes(id)
        ? prev[field].filter(x => x !== id)
        : [...prev[field], id]
    }))
  }

  const getSourceGroupName = (flow) => flow.sourceGroup?.name || 'Unknown group'

  return (
    <div className="page-shell">
      <ConfirmDialog
        open={!!confirmDelete}
        title="Delete alert flow"
        message="Remove this alert flow rule. This action cannot be undone."
        confirmLabel="Delete"
        destructive
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(null)}
        loading={saving}
      />
      <Toaster />

      <div className="page-head">
        <div>
          <p className="eyebrow">Automation</p>
          <h2>Alert flows</h2>
          <p className="page-subtitle">Define rules that connect equipment movements to notifications and alarms. (Inspired by MSIL Alert Flow system)</p>
        </div>
        <button className="button" onClick={() => { setShowForm(!showForm); setEditingId(null); setForm(emptyForm); setSelectedFlow(null) }}>
          {showForm ? 'Cancel' : 'New flow'}
        </button>
      </div>

      {showForm && (
        <div className="content-card">
          <div className="card-header">
            <h3>{editingId ? 'Edit alert flow' : 'Create alert flow rule'}</h3>
          </div>
          <form onSubmit={handleSave}>
            <div className="form-grid">
              <label className="field-group">
                <span>Flow name</span>
                <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Test Bay Exit Alert" required />
              </label>
              <label className="field-group">
                <span>Description</span>
                <input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="What this flow does" />
              </label>
              <label className="field-group">
                <span>Source: Device group</span>
                <select value={form.sourceGroup} onChange={e => setForm({ ...form, sourceGroup: e.target.value })} required>
                  <option value="">Select a device group</option>
                  {deviceGroups.map(dg => (
                    <option key={dg._id} value={dg._id}>{dg.name}</option>
                  ))}
                </select>
              </label>
              <label className="field-group checkbox-field">
                <input type="checkbox" checked={form.enabled} onChange={e => setForm({ ...form, enabled: e.target.checked })} />
                <span>Enabled</span>
              </label>
            </div>

            <div style={{ margin: '0.75rem 0' }}>
              <span style={{ fontWeight: 600, fontSize: '0.9rem', color: '#334155' }}>Trigger conditions</span>
              <div className="chip-row" style={{ marginTop: '0.4rem' }}>
                <label className="chip" style={{ cursor: 'pointer', background: form.triggerOnExit ? '#2563eb' : '#f1f5f9', color: form.triggerOnExit ? 'white' : '#334155' }}>
                  <input type="checkbox" checked={form.triggerOnExit} onChange={e => setForm({ ...form, triggerOnExit: e.target.checked })} style={{ display: 'none' }} />
                  Exit movement
                </label>
                <label className="chip" style={{ cursor: 'pointer', background: form.triggerOnOverdue ? '#2563eb' : '#f1f5f9', color: form.triggerOnOverdue ? 'white' : '#334155' }}>
                  <input type="checkbox" checked={form.triggerOnOverdue} onChange={e => setForm({ ...form, triggerOnOverdue: e.target.checked })} style={{ display: 'none' }} />
                  Overdue return
                </label>
                <label className="chip" style={{ cursor: 'pointer', background: form.isResolutionRequired ? '#2563eb' : '#f1f5f9', color: form.isResolutionRequired ? 'white' : '#334155' }}>
                  <input type="checkbox" checked={form.isResolutionRequired} onChange={e => setForm({ ...form, isResolutionRequired: e.target.checked })} style={{ display: 'none' }} />
                  Manual resolution required
                </label>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.75rem', margin: '0.75rem 0' }}>
              <div className="field-group">
                <span>Target groups (email) ({form.targetGroups.length} selected)</span>
                <div className="multi-select-list">
                  {targetGroups.length === 0 && <div className="empty-state-sm">No target groups</div>}
                  {targetGroups.map(tg => (
                    <label key={tg._id} className={`multi-select-item ${form.targetGroups.includes(tg._id) ? 'selected' : ''}`}>
                      <input type="checkbox" checked={form.targetGroups.includes(tg._id)} onChange={() => toggleArrayItem('targetGroups', tg._id)} />
                      <span>{tg.name} ({tg.recipients?.length || 0} recipients)</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="field-group">
                <span>Speaker devices ({form.speakerDevices.length} selected)</span>
                <div className="multi-select-list">
                  {speakers.length === 0 && <div className="empty-state-sm">No speaker devices</div>}
                  {speakers.map(s => (
                    <label key={s._id} className={`multi-select-item ${form.speakerDevices.includes(s._id) ? 'selected' : ''}`}>
                      <input type="checkbox" checked={form.speakerDevices.includes(s._id)} onChange={() => toggleArrayItem('speakerDevices', s._id)} />
                      <span>{s.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="form-actions button-row">
              <button className="button" type="submit" disabled={saving}>
                {saving ? 'Saving…' : editingId ? 'Save flow' : 'Create flow'}
              </button>
              <button className="button button-ghost" type="button" onClick={() => { setShowForm(false); setForm(emptyForm); setEditingId(null); setSelectedFlow(null) }}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div className="content-card">
        {loading ? (
          <div className="loading-state">Loading alert flows…</div>
        ) : flows.length === 0 ? (
          <div className="empty-state">No alert flows configured yet. Create one to connect equipment movements to notifications.</div>
        ) : (
          <div className="groups-grid">
            {flows.map(flow => (
              <div key={flow._id} className={`group-card ${selectedFlow === flow._id ? 'group-card--active' : ''} ${!flow.enabled ? 'group-card--disabled' : ''}`}>
                <div className="group-card__header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <h3>{flow.name}</h3>
                    <span className={`status-pill ${flow.enabled ? 'success' : 'neutral'}`}>
                      {flow.enabled ? 'Active' : 'Disabled'}
                    </span>
                  </div>
                </div>
                {flow.description && <p className="group-card__desc">{flow.description}</p>}

                <div className="flow-route">
                  <div className="flow-route__node">
                    <span className="flow-route__label">Source</span>
                    <strong>{getSourceGroupName(flow)}</strong>
                    <span className="chip">
                      {((flow.sourceGroup?.readers?.length) || 0) + (flow.sourceGroup?.tags?.length || 0) + (flow.sourceGroup?.speakers?.length || 0)} devices
                    </span>
                  </div>
                  <div className="flow-route__arrow">→</div>
                  <div className="flow-route__node">
                    <span className="flow-route__label">Triggers</span>
                    <div className="chip-row">
                      {flow.triggerOnExit && <span className="chip">Exit</span>}
                      {flow.triggerOnOverdue && <span className="chip">Overdue</span>}
                    </div>
                  </div>
                  <div className="flow-route__arrow">→</div>
                  <div className="flow-route__node">
                    <span className="flow-route__label">Targets</span>
                    <strong>{flow.targetGroups?.length || 0} groups</strong>
                    <span className="chip">{flow.speakerDevices?.length || 0} speakers</span>
                  </div>
                </div>

                <div className="group-card__actions">
                  <button className="button button-secondary" onClick={() => startEdit(flow)}>Edit</button>
                  <button className={`button ${flow.enabled ? 'button-ghost' : 'button-secondary'}`} onClick={() => handleToggle(flow._id, flow.enabled)}>
                    {flow.enabled ? 'Disable' : 'Enable'}
                  </button>
                  <button className="button button-ghost" onClick={() => setConfirmDelete(flow._id)}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
