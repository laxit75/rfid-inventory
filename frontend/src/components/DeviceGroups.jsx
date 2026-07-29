import { useState, useEffect } from 'react'
import axios from 'axios'
import ConfirmDialog from './ConfirmDialog'
import { useToast } from '../hooks/useToast'

const emptyForm = { name: '', description: '', readers: [], tags: [], speakers: [] }

export default function DeviceGroups() {
  const [groups, setGroups] = useState([])
  const [readers, setReaders] = useState([])
  const [tags, setTags] = useState([])
  const [speakers, setSpeakers] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [showForm, setShowForm] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const { toast, Toaster } = useToast()

  const token = localStorage.getItem('token')

  const loadAll = async () => {
    setLoading(true)
    try {
      const [groupsRes, readersRes, tagsRes, speakersRes] = await Promise.all([
        axios.get('/api/device-groups', { headers: { Authorization: `Bearer ${token}` } }),
        axios.get('/api/readers', { headers: { Authorization: `Bearer ${token}` } }),
        axios.get('/api/tags', { headers: { Authorization: `Bearer ${token}` } }),
        axios.get('/api/devices', { headers: { Authorization: `Bearer ${token}` } })
      ])
      setGroups(groupsRes.data)
      setReaders(readersRes.data)
      setTags(tagsRes.data)
      setSpeakers(speakersRes.data.filter(d => d.type === 'SPEAKER'))
    } catch (err) {
      toast({ title: 'Load failed', description: 'Unable to load data.', variant: 'error' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadAll() }, [])

  const startEdit = (group) => {
    setEditingId(group._id)
    setForm({
      name: group.name,
      description: group.description || '',
      readers: group.readers?.map(r => r._id || r) || [],
      tags: group.tags?.map(t => t._id || t) || [],
      speakers: group.speakers?.map(s => s._id || s) || []
    })
    setShowForm(true)
  }

  const handleSave = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) {
      toast({ title: 'Validation', description: 'Group name is required.', variant: 'error' })
      return
    }
    setSaving(true)
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim(),
        readers: form.readers,
        tags: form.tags,
        speakers: form.speakers
      }
      if (editingId) {
        await axios.put(`/api/device-groups/${editingId}`, payload, { headers: { Authorization: `Bearer ${token}` } })
        toast({ title: 'Group updated', description: 'Device group saved successfully.', variant: 'success' })
      } else {
        await axios.post('/api/device-groups', payload, { headers: { Authorization: `Bearer ${token}` } })
        toast({ title: 'Group created', description: 'New device group created.', variant: 'success' })
      }
      setForm(emptyForm)
      setEditingId(null)
      setShowForm(false)
      loadAll()
    } catch (err) {
      toast({ title: 'Save failed', description: err.response?.data?.error || 'Unable to save.', variant: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!confirmDelete) return
    setSaving(true)
    try {
      await axios.delete(`/api/device-groups/${confirmDelete}`, { headers: { Authorization: `Bearer ${token}` } })
      toast({ title: 'Group deleted', description: 'Device group removed.', variant: 'success' })
      setConfirmDelete(null)
      loadAll()
    } catch (err) {
      toast({ title: 'Delete failed', description: err.response?.data?.error || 'Unable to delete.', variant: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const toggleMember = (field, id) => {
    setForm(prev => ({
      ...prev,
      [field]: prev[field].includes(id)
        ? prev[field].filter(x => x !== id)
        : [...prev[field], id]
    }))
  }

  const groupCount = (group) => {
    const r = group.readers?.length || 0
    const t = group.tags?.length || 0
    const s = group.speakers?.length || 0
    return `${r} reader${r !== 1 ? 's' : ''}, ${t} tag${t !== 1 ? 's' : ''}, ${s} speaker${s !== 1 ? 's' : ''}`
  }

  return (
    <div className="page-shell">
      <ConfirmDialog
        open={!!confirmDelete}
        title="Delete device group"
        message="Remove this device group? Alert flows referencing this group will be affected."
        confirmLabel="Delete"
        destructive
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(null)}
        loading={saving}
      />
      <Toaster />

      <div className="page-head">
        <div>
          <p className="eyebrow">Groups</p>
          <h2>Device groups</h2>
          <p className="page-subtitle">Group readers, tags, and speaker devices together for alert flow configuration.</p>
        </div>
        <button className="button" onClick={() => { setShowForm(!showForm); setEditingId(null); setForm(emptyForm) }}>
          {showForm ? 'Cancel' : 'New group'}
        </button>
      </div>

      {showForm && (
        <div className="content-card">
          <div className="card-header">
            <h3>{editingId ? 'Edit device group' : 'Create device group'}</h3>
          </div>
          <form onSubmit={handleSave}>
            <div className="form-grid">
              <label className="field-group">
                <span>Group name</span>
                <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Test Bay Equipment" required />
              </label>
              <label className="field-group">
                <span>Description</span>
                <input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Optional description" />
              </label>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem', margin: '1rem 0' }}>
              <div className="field-group">
                <span>Readers ({form.readers.length} selected)</span>
                <div className="multi-select-list">
                  {readers.length === 0 && <div className="empty-state-sm">No readers configured</div>}
                  {readers.map(r => (
                    <label key={r._id} className={`multi-select-item ${form.readers.includes(r._id) ? 'selected' : ''}`}>
                      <input type="checkbox" checked={form.readers.includes(r._id)} onChange={() => toggleMember('readers', r._id)} />
                      <span>{r.name}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="field-group">
                <span>Tags ({form.tags.length} selected)</span>
                <div className="multi-select-list">
                  {tags.length === 0 && <div className="empty-state-sm">No tags configured</div>}
                  {tags.map(t => (
                    <label key={t._id} className={`multi-select-item ${form.tags.includes(t._id) ? 'selected' : ''}`}>
                      <input type="checkbox" checked={form.tags.includes(t._id)} onChange={() => toggleMember('tags', t._id)} />
                      <span>{t.tagId} {t.equipment?.name ? `(${t.equipment.name})` : ''}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="field-group">
                <span>Speakers ({form.speakers.length} selected)</span>
                <div className="multi-select-list">
                  {speakers.length === 0 && <div className="empty-state-sm">No speakers configured</div>}
                  {speakers.map(s => (
                    <label key={s._id} className={`multi-select-item ${form.speakers.includes(s._id) ? 'selected' : ''}`}>
                      <input type="checkbox" checked={form.speakers.includes(s._id)} onChange={() => toggleMember('speakers', s._id)} />
                      <span>{s.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="form-actions button-row">
              <button className="button" type="submit" disabled={saving}>
                {saving ? 'Saving…' : editingId ? 'Save group' : 'Create group'}
              </button>
              <button className="button button-ghost" type="button" onClick={() => { setShowForm(false); setForm(emptyForm); setEditingId(null) }}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div className="content-card">
        {loading ? (
          <div className="loading-state">Loading device groups…</div>
        ) : groups.length === 0 ? (
          <div className="empty-state">No device groups configured yet. Create one to organize your readers, tags, and speakers.</div>
        ) : (
          <div className="groups-grid">
            {groups.map(g => (
              <div key={g._id} className="group-card">
                <div className="group-card__header">
                  <h3>{g.name}</h3>
                  <span className={`chip ${g.readers?.length + g.tags?.length + g.speakers?.length > 0 ? '' : 'chip-warning'}`}>
                    {g.readers?.length || 0} readers
                  </span>
                </div>
                {g.description && <p className="group-card__desc">{g.description}</p>}
                <div className="group-card__stats">
                  <span className="summary-pill muted">📡 {g.readers?.length || 0} readers</span>
                  <span className="summary-pill muted">🏷 {g.tags?.length || 0} tags</span>
                  <span className="summary-pill muted">🔊 {g.speakers?.length || 0} speakers</span>
                </div>
                <div className="group-card__actions">
                  <button className="button button-secondary" onClick={() => startEdit(g)}>Edit</button>
                  <button className="button button-ghost" onClick={() => setConfirmDelete(g._id)}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
