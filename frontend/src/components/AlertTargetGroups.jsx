import { useState, useEffect, useMemo } from 'react'
import axios from 'axios'
import ConfirmDialog from './ConfirmDialog'
import { useToast } from '../hooks/useToast'

const emptyForm = { name: '', description: '', recipients: [], tagAssignments: [] }

// Empty form for creating a new tag-to-person assignment inline
const emptyTagAssignment = { tagId: '', personName: '', personEmail: '', notes: '' }

// Helper: build a lookup map from tagAssignmentId -> full object for quick display
function buildAssignmentLookup(groups, localCache) {
  const map = new Map();
  // Populate from existing groups
  for (const g of groups) {
    for (const ta of (g.tagAssignments || [])) {
      if (ta && ta._id) map.set(ta._id, ta);
    }
  }
  // Overlay with locally-created assignments (more recent)
  for (const ta of localCache) {
    if (ta && ta._id) map.set(ta._id, ta);
  }
  return map;
}

export default function AlertTargetGroups() {
  const [groups, setGroups] = useState([])
  const [recipients, setRecipients] = useState([])
  const [allTags, setAllTags] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [showForm, setShowForm] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [newTagAssign, setNewTagAssign] = useState(emptyTagAssignment)
  const [tagAssignError, setTagAssignError] = useState('')
  // Local cache of tag assignments created during this form session (not yet saved to a group)
  const [localTagAssignments, setLocalTagAssignments] = useState([])
  const { toast, Toaster } = useToast()

  const token = localStorage.getItem('token')

  const loadAll = async () => {
    setLoading(true)
    try {
      const [groupsRes, recipientsRes, tagsRes] = await Promise.all([
        axios.get('/api/alert-target-groups', { headers: { Authorization: `Bearer ${token}` } }),
        axios.get('/api/recipients', { headers: { Authorization: `Bearer ${token}` } }),
        axios.get('/api/tags', { headers: { Authorization: `Bearer ${token}` } })
      ])
      setGroups(groupsRes.data)
      setRecipients(recipientsRes.data)
      setAllTags(tagsRes.data)
    } catch (err) {
      toast({ title: 'Load failed', description: 'Unable to load data.', variant: 'error' })
    } finally {
      setLoading(false)
    }
  }

  // Build the lookup map used throughout the render (memoized)
  const assignmentLookup = useMemo(() => buildAssignmentLookup(groups, localTagAssignments), [groups, localTagAssignments])

  useEffect(() => { loadAll() }, [])

  const startEdit = (group) => {
    setEditingId(group._id)
    setForm({
      name: group.name,
      description: group.description || '',
      recipients: group.recipients?.map(r => r._id || r) || [],
      tagAssignments: group.tagAssignments?.map(ta => ta._id || ta) || []
    })
    // Pre-populate local cache with existing assignments so they display correctly
    setLocalTagAssignments(group.tagAssignments?.filter(ta => ta && ta._id) || [])
    setShowForm(true)
  }

  // Add a new tag→person assignment inline
  const addTagAssignment = async () => {
    if (!newTagAssign.tagId || !newTagAssign.personName || !newTagAssign.personEmail) {
      setTagAssignError('Tag, person name, and email are required.')
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newTagAssign.personEmail)) {
      setTagAssignError('Please enter a valid email address.')
      return
    }
    // Warn if this tag is already assigned to someone in this group
    const isDuplicate = form.tagAssignments.some(id => {
      const existing = assignmentLookup.get(id)
      return existing?.tagId?._id === newTagAssign.tagId || existing?.tagId === newTagAssign.tagId
    })
    if (isDuplicate) {
      setTagAssignError('This tag is already assigned to someone in this group. Remove the existing assignment first or use a different tag.')
      return
    }
    setTagAssignError('')
    setSaving(true)
    try {
      const res = await axios.post('/api/tag-assignments', newTagAssign, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const created = res.data
      // Add the new assignment ID to the form
      setForm(prev => ({
        ...prev,
        tagAssignments: [...prev.tagAssignments, created._id]
      }))
      // Cache the full object locally so we can display it immediately
      setLocalTagAssignments(prev => [...prev, created])
      setNewTagAssign(emptyTagAssignment)
      toast({ title: 'Tag assignment added', description: `${created.personName} assigned to tag.`, variant: 'success' })
    } catch (err) {
      toast({ title: 'Failed to add', description: err.response?.data?.error || 'Unable to add tag assignment.', variant: 'error' })
    } finally {
      setSaving(false)
    }
  }

  // Remove a tag assignment
  const removeTagAssignment = async (assignmentId) => {
    setSaving(true)
    try {
      await axios.delete(`/api/tag-assignments/${assignmentId}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      setForm(prev => ({
        ...prev,
        tagAssignments: prev.tagAssignments.filter(id => id !== assignmentId)
      }))
      setLocalTagAssignments(prev => prev.filter(ta => ta._id !== assignmentId))
      toast({ title: 'Assignment removed', variant: 'info' })
    } catch (err) {
      toast({ title: 'Failed to remove', variant: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const handleSave = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) {
      toast({ title: 'Validation', description: 'Group name is required.', variant: 'error' })
      return
    }
    setSaving(true)
    try {
      if (editingId) {
        await axios.put(`/api/alert-target-groups/${editingId}`, form, { headers: { Authorization: `Bearer ${token}` } })
        toast({ title: 'Group updated', description: 'Alert target group saved.', variant: 'success' })
      } else {
        await axios.post('/api/alert-target-groups', form, { headers: { Authorization: `Bearer ${token}` } })
        toast({ title: 'Group created', description: 'New alert target group created.', variant: 'success' })
      }
      setForm(emptyForm)
      setEditingId(null)
      setLocalTagAssignments([])
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
      await axios.delete(`/api/alert-target-groups/${confirmDelete}`, { headers: { Authorization: `Bearer ${token}` } })
      toast({ title: 'Group deleted', description: 'Alert target group removed.', variant: 'success' })
      setConfirmDelete(null)
      loadAll()
    } catch (err) {
      toast({ title: 'Delete failed', description: err.response?.data?.error || 'Unable to delete.', variant: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const toggleRecipient = (id) => {
    setForm(prev => ({
      ...prev,
      recipients: prev.recipients.includes(id)
        ? prev.recipients.filter(x => x !== id)
        : [...prev.recipients, id]
    }))
  }

  return (
    <div className="page-shell">
      <ConfirmDialog
        open={!!confirmDelete}
        title="Delete target group"
        message="Remove this alert target group? Alert flows using this group will lose these targets."
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
          <h2>Alert target groups</h2>
          <p className="page-subtitle">Group email recipients together so alert flows can notify the right people.</p>
        </div>
        <button className="button" onClick={() => { setShowForm(!showForm); setEditingId(null); setForm(emptyForm); setLocalTagAssignments([]); setNewTagAssign(emptyTagAssignment); setTagAssignError('') }}>
          {showForm ? 'Cancel' : 'New group'}
        </button>
      </div>

      {showForm && (
        <div className="content-card">
          <div className="card-header">
            <h3>{editingId ? 'Edit target group' : 'Create target group'}</h3>
          </div>
          <form onSubmit={handleSave}>
            <div className="form-grid">
              <label className="field-group">
                <span>Group name</span>
                <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Lab Supervisors" required />
              </label>
              <label className="field-group">
                <span>Description</span>
                <input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Optional description" />
              </label>
            </div>

            <div className="field-group" style={{ marginTop: '0.75rem' }}>
              <span>Recipients ({form.recipients.length} selected)</span>
              <div className="multi-select-list">
                {recipients.length === 0 && <div className="empty-state-sm">No recipients configured yet. Add recipients first.</div>}
                {recipients.map(r => (
                  <label key={r._id} className={`multi-select-item ${form.recipients.includes(r._id) ? 'selected' : ''}`}>
                    <input type="checkbox" checked={form.recipients.includes(r._id)} onChange={() => toggleRecipient(r._id)} />
                    <span><strong>{r.name}</strong> ({r.email})</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Tag→Person assignments section */}
            <div style={{ marginTop: '1rem', padding: '0.75rem', background: '#f8fafc', borderRadius: 10, border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <span style={{ fontWeight: 600, fontSize: '0.9rem', color: '#334155' }}>
                  Tag→Person assignments ({form.tagAssignments.length})
                </span>
                <span style={{ fontSize: '0.78rem', color: '#64748b' }}>Assign a specific person to a specific tag</span>
              </div>

              {/* Inline form to add a new tag→person assignment */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: '0.5rem', alignItems: 'end', marginBottom: '0.5rem' }}>
                <div className="field-group compact">
                  <span>Tag</span>
                  <select value={newTagAssign.tagId} onChange={e => setNewTagAssign({ ...newTagAssign, tagId: e.target.value })}>
                    <option value="">Select tag</option>
                    {allTags.map(t => (
                      <option key={t._id} value={t._id}>{t.tagId} {t.equipment?.name ? `(${t.equipment.name})` : ''}</option>
                    ))}
                  </select>
                </div>
                <div className="field-group compact">
                  <span>Person name</span>
                  <input type="text" placeholder="e.g. John" value={newTagAssign.personName} onChange={e => setNewTagAssign({ ...newTagAssign, personName: e.target.value })} />
                </div>
                <div className="field-group compact">
                  <span>Email</span>
                  <input type="email" placeholder="john@company.com" value={newTagAssign.personEmail} onChange={e => setNewTagAssign({ ...newTagAssign, personEmail: e.target.value })} />
                </div>
                <button
                  type="button"
                  onClick={addTagAssignment}
                  disabled={saving || !newTagAssign.tagId || !newTagAssign.personName || !newTagAssign.personEmail}
                  style={{
                    whiteSpace: 'nowrap',
                    padding: '0.7rem 1rem',
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    background: '#0891b2',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 8,
                    cursor: saving ? 'not-allowed' : 'pointer',
                    opacity: saving || !newTagAssign.tagId || !newTagAssign.personName || !newTagAssign.personEmail ? 0.5 : 1,
                    transition: 'opacity 0.15s, background 0.15s'
                  }}
                >
                  {saving ? '…' : 'Add'}
                </button>
              </div>
              {tagAssignError && <div className="field-error" style={{ marginBottom: '0.3rem' }}>{tagAssignError}</div>}

              {/* List of current tag assignments */}
              {form.tagAssignments.length > 0 && (
                <div className="multi-select-list" style={{ maxHeight: 150 }}>
                  {form.tagAssignments.map(id => {
                    const fullAssignment = assignmentLookup.get(id)
                    return (
                      <div key={id} className="multi-select-item" style={{ justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1 }}>
                          <span style={{ fontWeight: 600 }}>{fullAssignment?.personName || 'Unknown'}</span>
                          <span style={{ color: '#64748b', fontSize: '0.82rem' }}>{fullAssignment?.personEmail || ''}</span>
                          <span className="chip" style={{ fontSize: '0.7rem' }}>Tag: {fullAssignment?.tagId?.tagId || '—'}</span>
                        </div>
                        <button
                          type="button"
                          className="toast-close"
                          onClick={() => removeTagAssignment(id)}
                          title="Remove assignment"
                        >×</button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            <div className="form-actions button-row" style={{ marginTop: '1rem' }}>
              <button className="button" type="submit" disabled={saving}>
                {saving ? 'Saving…' : editingId ? 'Save group' : 'Create group'}
              </button>
              <button className="button button-ghost" type="button" onClick={() => { setShowForm(false); setForm(emptyForm); setEditingId(null); setNewTagAssign(emptyTagAssignment); setTagAssignError(''); setLocalTagAssignments([]) }}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div className="content-card">
        {loading ? (
          <div className="loading-state">Loading alert target groups…</div>
        ) : groups.length === 0 ? (
          <div className="empty-state">No alert target groups configured yet. Create one to organize your email recipients and tag assignments.</div>
        ) : (
          <div className="groups-grid">
            {groups.map(g => (
              <div key={g._id} className="group-card">
                <div className="group-card__header">
                  <h3>{g.name}</h3>
                  <span className="chip">{g.recipients?.length || 0} recipients</span>
                </div>
                {g.description && <p className="group-card__desc">{g.description}</p>}
                <div className="group-card__recipients">
                  {g.recipients?.slice(0, 5).map(r => (
                    <span key={r._id} className="chip">{r.name}</span>
                  ))}
                  {(g.recipients?.length || 0) > 5 && <span className="chip">+{g.recipients.length - 5} more</span>}
                  {(!g.recipients || g.recipients.length === 0) && <span className="chip chip-warning">No recipients assigned</span>}
                </div>
                {/* Show tag→person assignments */}
                {g.tagAssignments && g.tagAssignments.length > 0 && (
                  <div style={{ marginTop: '0.3rem' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.3rem' }}>
                      Tag assignments ({g.tagAssignments.length})
                    </div>
                    <div className="group-card__recipients">
                      {g.tagAssignments.slice(0, 4).map(ta => (
                        <span key={ta._id} className="chip" style={{ background: '#fef3c7', color: '#92400e' }} title={`${ta.personName} <${ta.personEmail}> → ${ta.tagId?.tagId || 'Unknown tag'}`}>
                          {ta.personName} → {ta.tagId?.tagId || '—'}
                        </span>
                      ))}
                      {g.tagAssignments.length > 4 && <span className="chip">+{g.tagAssignments.length - 4} more</span>}
                    </div>
                  </div>
                )}
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
