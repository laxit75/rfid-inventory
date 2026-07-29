import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import axios from 'axios'

export default function TagManagement() {
  const [tags, setTags] = useState([])
  const [zones, setZones] = useState([])
  const [equipments, setEquipments] = useState([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState(null)
  const [showAdd, setShowAdd] = useState(false)
  const [newTagId, setNewTagId] = useState('')
  const [newEquipment, setNewEquipment] = useState('')
  const [newZone, setNewZone] = useState('')
  const [newStatus, setNewStatus] = useState('ACTIVE')
  const [newError, setNewError] = useState('')
  const [selectedIds, setSelectedIds] = useState([])
  const [bulkAction, setBulkAction] = useState('')
  const [bulkBusy, setBulkBusy] = useState(false)

  // Keyboard shortcut: Ctrl+A to select all, Escape to deselect all
  useEffect(() => {
    const handler = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return
      if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        e.preventDefault()
        if (tags.length > 0) setSelectedIds(tags.map(t => t._id))
      }
      if (e.key === 'Escape') setSelectedIds([])
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [tags])

  const toggleSelect = (id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  const selectAll = () => {
    if (selectedIds.length === tags.length) {
      setSelectedIds([])
    } else {
      setSelectedIds(tags.map(t => t._id))
    }
  }

  const handleBulkAction = async () => {
    if (selectedIds.length === 0 || !bulkAction) return
    setBulkBusy(true)
    try {
      const token = localStorage.getItem('token')
      await Promise.all(selectedIds.map(id =>
        axios.patch(`/api/tags/${id}`, { status: bulkAction }, { headers: { Authorization: `Bearer ${token}` } })
      ))
      setSelectedIds([])
      setBulkAction('')
      fetchTags(false)
    } catch (err) {
      console.error('Bulk action failed', err)
    } finally {
      setBulkBusy(false)
    }
  }

  const fetchTags = async (isInitial = false) => {
    try {
      if (isInitial) setLoading(true)
      const res = await axios.get('/api/tags', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      })
      setTags(res.data)
    } finally {
      if (isInitial) setLoading(false)
    }
  }

  const fetchZones = async () => {
    const res = await axios.get('/api/zones', {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
    })
    setZones(res.data)
  }

  const fetchEquipments = async () => {
    const res = await axios.get('/api/equipment', {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
    })
    setEquipments(res.data)
  }

  useEffect(() => {
    fetchTags(true)
    fetchZones()
    fetchEquipments()
  }, [])

  const handleSilence = async (id) => {
    setBusyId(id)
    try {
      await axios.post(`/api/tags/${id}/silence`, {}, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      })
      fetchTags(false)
    } finally {
      setBusyId(null)
    }
  }

  const createTag = async () => {
    setNewError('')
    if (!newTagId.trim() || !newEquipment) {
      setNewError('Tag ID and equipment are required.')
      return
    }
    setBusyId('new')
    try {
      await axios.post('/api/tags', {
        tagId: newTagId.trim(),
        equipment: newEquipment,
        assignedZone: newZone || null,
        status: newStatus
      }, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      })
      setNewTagId('')
      setNewEquipment('')
      setNewZone('')
      setNewStatus('ACTIVE')
      setShowAdd(false)
      fetchTags(false)
    } catch (err) {
      setNewError(err.response?.data?.error || 'Unable to create tag.')
    } finally {
      setBusyId(null)
    }
  }

  const updateTag = async (id, updates) => {
    setBusyId(id)
    try {
      await axios.patch(`/api/tags/${id}`, updates, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      })
      fetchTags(false)
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="page-shell">
      <div className="page-head">
        <div>
          <p className="eyebrow">Tag control</p>
          <h2>Tag management</h2>
          <p className="page-subtitle">Adjust tag state and resolve active alarms without changing backend behavior.</p>
        </div>
      </div>

      <div className="content-card">
        <div className="card-header">
          <div>
            <h3>All tags</h3>
            <p className="card-copy">Adjust tag state, silence alarms, and manage assignments.</p>
          </div>
          <button className="button button-primary" onClick={() => setShowAdd(prev => !prev)}>
            {showAdd ? 'Cancel' : 'Add Tag'}
          </button>
        </div>
        {showAdd && (
          <div className="content-panel" style={{ marginBottom: 16, padding: 16, background: '#f8fafc', borderRadius: 12 }}>
            <div style={{ display: 'grid', gap: 12, gridTemplateColumns: '1fr 1fr', alignItems: 'end' }}>
              <label className="field-group">
                <span>Tag ID</span>
                <input value={newTagId} onChange={(e) => setNewTagId(e.target.value)} placeholder="TAG-004" />
              </label>
              <label className="field-group">
                <span>Equipment</span>
                <select value={newEquipment} onChange={(e) => setNewEquipment(e.target.value)}>
                  <option value="">Select equipment</option>
                  {equipments.map(item => (
                    <option key={item._id} value={item._id}>{item.name}</option>
                  ))}
                </select>
              </label>
              <label className="field-group">
                <span>Assigned zone</span>
                <select value={newZone} onChange={(e) => setNewZone(e.target.value)}>
                  <option value="">Unassigned</option>
                  {zones.map(zone => (
                    <option key={zone._id} value={zone._id}>{zone.name}</option>
                  ))}
                </select>
              </label>
              <label className="field-group">
                <span>Status</span>
                <select value={newStatus} onChange={(e) => setNewStatus(e.target.value)}>
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="TEMP_DISABLED">TEMP_DISABLED</option>
                  <option value="PERMANENT_DISABLED">PERMANENT_DISABLED</option>
                </select>
              </label>
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 12 }}>
              <button className="button button-primary" onClick={createTag} disabled={busyId === 'new'}>
                {busyId === 'new' ? 'Creating…' : 'Create Tag'}
              </button>
              {newError && <span style={{ color: '#b91c1c' }}>{newError}</span>}
            </div>
          </div>
        )}
        {loading ? (
          <div className="loading-state">Loading tags…</div>
        ) : tags.length === 0 ? (
          <div className="empty-state">No tags are available to manage.</div>
        ) : (
          <>
            {/* Bulk actions toolbar */}
            {selectedIds.length > 0 && (
              <div className="bulk-bar">
                <span className="bulk-bar__count">{selectedIds.length} tag{selectedIds.length !== 1 ? 's' : ''} selected</span>
                <select value={bulkAction} onChange={e => setBulkAction(e.target.value)} className="bulk-bar__select">
                  <option value="">Bulk action…</option>
                  <option value="ACTIVE">Set Active</option>
                  <option value="TEMP_DISABLED">Temp Disable</option>
                  <option value="PERMANENT_DISABLED">Perm Disable</option>
                </select>
                <button className="button" onClick={handleBulkAction} disabled={!bulkAction || bulkBusy}>
                  {bulkBusy ? 'Applying…' : 'Apply'}
                </button>
                <button className="button button-ghost" onClick={() => setSelectedIds([])}>Clear</button>
              </div>
            )}
            <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th><input type="checkbox" onChange={selectAll} checked={selectedIds.length === tags.length && tags.length > 0} aria-label="Select all" /></th>
                  <th>Tag ID</th>
                  <th>Equipment</th>
                  <th>Status</th>
                  <th>Assigned zone</th>
                  <th>Current zone</th>
                  <th>Alert</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {tags.map(tag => (
                  <tr key={tag._id} className={selectedIds.includes(tag._id) ? 'tag-row--selected' : ''}>
                    <td><input type="checkbox" checked={selectedIds.includes(tag._id)} onChange={() => toggleSelect(tag._id)} aria-label={`Select ${tag.tagId}`} /></td>
                    <td>{tag.tagId}</td>
                    <td>{tag.equipment?.name}</td>
                    <td>
                      <label className="field-group compact">
                        <span className="sr-only">Status</span>
                        <select
                          value={tag.status}
                          onChange={(e) => updateTag(tag._id, { status: e.target.value })}
                          disabled={busyId === tag._id}
                        >
                          <option value="ACTIVE">ACTIVE</option>
                          <option value="TEMP_DISABLED">TEMP_DISABLED</option>
                          <option value="PERMANENT_DISABLED">PERMANENT_DISABLED</option>
                        </select>
                      </label>
                    </td>
                    <td>
                      <label className="field-group compact">
                        <span className="sr-only">Assigned zone</span>
                        <select
                          value={tag.assignedZone?._id || tag.assignedZone || ''}
                          onChange={(e) => updateTag(tag._id, { assignedZone: e.target.value })}
                          disabled={busyId === tag._id}
                        >
                          <option value="">Unassigned</option>
                          {zones.map(zone => (
                            <option key={zone._id} value={zone._id}>{zone.name}</option>
                          ))}
                        </select>
                      </label>
                    </td>
                    <td>{tag.currentZone?.name || 'Outside all zones'}</td>
                    <td>
                      <span className={`status-pill ${tag.alertStatus === 'ALARMING' ? 'danger' : tag.alertStatus === 'OVERDUE' ? 'warning' : 'neutral'}`}>
                        {tag.alertStatus}
                      </span>
                    </td>
                    <td>
                      <div className="action-stack">
                        {tag.alertStatus === 'ALARMING' && (
                          <button className="button button-secondary" onClick={() => handleSilence(tag._id)} disabled={busyId === tag._id}>
                            {busyId === tag._id ? 'Working…' : 'Silence'}
                          </button>
                        )}
                        <Link className="button button-secondary" to={`/tags/${tag._id}/history`}>History</Link>
                        {tag.status === 'TEMP_DISABLED' && (
                          <div className="inline-form-grid">
                            <label className="field-group compact">
                              <span>Until</span>
                              <input
                                type="datetime-local"
                                onChange={(e) => updateTag(tag._id, { disabledUntil: e.target.value })}
                                defaultValue={tag.disabledUntil ? new Date(tag.disabledUntil).toISOString().slice(0, 16) : ''}
                              />
                            </label>
                            <label className="field-group compact">
                              <span>Reason</span>
                              <input
                                type="text"
                                placeholder="Reason"
                                defaultValue={tag.disableReason}
                                onBlur={(e) => updateTag(tag._id, { disableReason: e.target.value })}
                              />
                            </label>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </>
        )}
      </div>
    </div>
  )
}