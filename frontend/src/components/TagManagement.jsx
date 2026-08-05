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
    } catch {
      // silently fail bulk action — user sees no change
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
    try {
      const res = await axios.get('/api/zones', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      })
      setZones(res.data)
    } catch { /* ignore */ }
  }

  const fetchEquipments = async () => {
    try {
      const res = await axios.get('/api/equipment', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      })
      setEquipments(res.data)
    } catch { /* ignore */ }
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
    <div className="cc-dashboard">
      {/* Page Header */}
      <div className="cc-page-header cc-animate-in">
        <div>
          <p className="cc-eyebrow">Tag control</p>
          <h2 className="cc-page-title">Tag management</h2>
          <p className="cc-page-subtitle">Adjust tag state and resolve active alarms without changing backend behavior.</p>
        </div>
        <button className="cc-btn-accent cc-magnetic" onClick={() => setShowAdd(prev => !prev)}>
          {showAdd ? '✕ Cancel' : '+ Add tag'}
        </button>
      </div>

      {/* Add Tag Form */}
      {showAdd && (
        <div className="cc-content-card cc-animate-in">
          <div className="cc-card-header">
            <h3 className="cc-card-title">New tag</h3>
          </div>
          <div className="cc-form-grid">
            <label className="cc-field-group">
              <span>Tag ID</span>
              <input
                className="cc-input"
                value={newTagId}
                onChange={(e) => setNewTagId(e.target.value)}
                placeholder="TAG-004"
              />
            </label>
            <label className="cc-field-group">
              <span>Equipment</span>
              <select className="cc-input" value={newEquipment} onChange={(e) => setNewEquipment(e.target.value)}>
                <option value="">Select equipment</option>
                {equipments.map(item => (
                  <option key={item._id} value={item._id}>{item.name}</option>
                ))}
              </select>
            </label>
            <label className="cc-field-group">
              <span>Assigned zone</span>
              <select className="cc-input" value={newZone} onChange={(e) => setNewZone(e.target.value)}>
                <option value="">Unassigned</option>
                {zones.map(zone => (
                  <option key={zone._id} value={zone._id}>{zone.name}</option>
                ))}
              </select>
            </label>
            <label className="cc-field-group">
              <span>Status</span>
              <select className="cc-input" value={newStatus} onChange={(e) => setNewStatus(e.target.value)}>
                <option value="ACTIVE">ACTIVE</option>
                <option value="TEMP_DISABLED">TEMP_DISABLED</option>
                <option value="PERMANENT_DISABLED">PERMANENT_DISABLED</option>
              </select>
            </label>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginTop: '1rem' }}>
            <button className="cc-btn-accent cc-magnetic" onClick={createTag} disabled={busyId === 'new'}>
              {busyId === 'new' ? 'Creating…' : 'Create tag'}
            </button>
            {newError && <span style={{ color: '#fca5a5', fontSize: '0.88rem' }}>{newError}</span>}
          </div>
        </div>
      )}

      {/* Tags Table */}
      <div className="cc-content-card cc-animate-in" style={{ animationDelay: '0.1s' }}>
        <div className="cc-card-header">
          <div>
            <h3 className="cc-card-title">All tags</h3>
            <p className="cc-card-subtitle">Adjust tag state, silence alarms, and manage assignments.</p>
          </div>
          <span className="cc-pill cc-pill--neutral">{tags.length} total</span>
        </div>

        {loading ? (
          <div className="cc-loading-state">Loading tags…</div>
        ) : tags.length === 0 ? (
          <div className="cc-empty-state">No tags are available to manage.</div>
        ) : (
          <>
            {/* Bulk actions toolbar */}
            {selectedIds.length > 0 && (
              <div className="cc-bulk-bar">
                <span className="cc-bulk-bar__count">{selectedIds.length} tag{selectedIds.length !== 1 ? 's' : ''} selected</span>
                <select
                  value={bulkAction}
                  onChange={e => setBulkAction(e.target.value)}
                  className="cc-bulk-select"
                >
                  <option value="">Bulk action…</option>
                  <option value="ACTIVE">Set Active</option>
                  <option value="TEMP_DISABLED">Temp Disable</option>
                  <option value="PERMANENT_DISABLED">Perm Disable</option>
                </select>
                <button className="cc-btn-accent cc-magnetic" onClick={handleBulkAction} disabled={!bulkAction || bulkBusy}
                  style={{ fontSize: '0.82rem', padding: '0.4rem 0.75rem' }}>
                  {bulkBusy ? 'Applying…' : 'Apply'}
                </button>
                <button className="cc-btn-ghost cc-magnetic" onClick={() => setSelectedIds([])}
                  style={{ fontSize: '0.82rem', padding: '0.4rem 0.75rem' }}>
                  Clear
                </button>
              </div>
            )}

            <div className="cc-table-wrapper">
              <table className="cc-data-table">
                <thead>
                  <tr>
                    <th style={{ width: '36px' }}>
                      <input
                        type="checkbox"
                        onChange={selectAll}
                        checked={selectedIds.length === tags.length && tags.length > 0}
                        aria-label="Select all"
                        style={{ accentColor: '#2f67f6' }}
                      />
                    </th>
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
                    <tr key={tag._id}
                      className={`${tag.alertStatus === 'ALARMING' ? 'cc-tag-row--alarming' : tag.alertStatus === 'OVERDUE' ? 'cc-tag-row--overdue' : ''} ${selectedIds.includes(tag._id) ? 'cc-tag-row--selected' : ''}`}
                    >
                      <td>
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(tag._id)}
                          onChange={() => toggleSelect(tag._id)}
                          aria-label={`Select ${tag.tagId}`}
                          style={{ accentColor: '#2f67f6' }}
                        />
                      </td>
                      <td>
                        <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{tag.tagId}</span>
                      </td>
                      <td>{tag.equipment?.name || '—'}</td>
                      <td>
                        <select
                          className="cc-inline-select"
                          value={tag.status}
                          onChange={(e) => updateTag(tag._id, { status: e.target.value })}
                          disabled={busyId === tag._id}
                          aria-label="Status"
                        >
                          <option value="ACTIVE">ACTIVE</option>
                          <option value="TEMP_DISABLED">TEMP_DISABLED</option>
                          <option value="PERMANENT_DISABLED">PERMANENT_DISABLED</option>
                        </select>
                      </td>
                      <td>
                        <select
                          className="cc-inline-select"
                          value={tag.assignedZone?._id || tag.assignedZone || ''}
                          onChange={(e) => updateTag(tag._id, { assignedZone: e.target.value })}
                          disabled={busyId === tag._id}
                          aria-label="Assigned zone"
                        >
                          <option value="">Unassigned</option>
                          {zones.map(zone => (
                            <option key={zone._id} value={zone._id}>{zone.name}</option>
                          ))}
                        </select>
                      </td>
                      <td style={{ color: 'var(--cc-text-secondary)', fontSize: '0.88rem' }}>
                        {tag.currentZone?.name || 'Outside all zones'}
                      </td>
                      <td>
                        <span className={`cc-status-pill ${tag.alertStatus === 'ALARMING' ? 'cc-status-pill--danger' : tag.alertStatus === 'OVERDUE' ? 'cc-status-pill--warning' : 'cc-status-pill--neutral'}`}>
                          {tag.alertStatus === 'ALARMING' ? '🚨 ALARMING' : tag.alertStatus === 'OVERDUE' ? '⏱ OVERDUE' : 'NO ALERT'}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                          {tag.alertStatus === 'ALARMING' && (
                            <button
                              className="cc-btn-ghost cc-magnetic"
                              style={{ fontSize: '0.78rem', padding: '0.3rem 0.6rem' }}
                              onClick={() => handleSilence(tag._id)}
                              disabled={busyId === tag._id}
                            >
                              {busyId === tag._id ? 'Working…' : '🔇 Silence'}
                            </button>
                          )}
                          <Link
                            className="cc-btn-ghost"
                            style={{ fontSize: '0.78rem', padding: '0.3rem 0.6rem', textAlign: 'center' }}
                            to={`/tags/${tag._id}/history`}
                          >
                            📋 History
                          </Link>
                          {tag.status === 'TEMP_DISABLED' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                              <label className="cc-field-group" style={{ gap: '0.2rem' }}>
                                <span style={{ fontSize: '0.75rem' }}>Until</span>
                                <input
                                  className="cc-input"
                                  style={{ fontSize: '0.8rem', padding: '0.35rem 0.5rem' }}
                                  type="datetime-local"
                                  onChange={(e) => updateTag(tag._id, { disabledUntil: e.target.value })}
                                  defaultValue={tag.disabledUntil ? new Date(tag.disabledUntil).toISOString().slice(0, 16) : ''}
                                />
                              </label>
                              <label className="cc-field-group" style={{ gap: '0.2rem' }}>
                                <span style={{ fontSize: '0.75rem' }}>Reason</span>
                                <input
                                  className="cc-input"
                                  style={{ fontSize: '0.8rem', padding: '0.35rem 0.5rem' }}
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

      <style>{`
        /* TagManagement scoped styles */
        .cc-eyebrow {
          margin: 0 0 0.35rem;
          text-transform: uppercase;
          letter-spacing: 0.2em;
          font-size: 0.76rem;
          color: #1d4ed8;
          font-weight: 700;
        }
        .cc-page-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          padding: 1.25rem 1.5rem;
          background: var(--cc-glass-bg);
          backdrop-filter: blur(var(--cc-glass-blur));
          -webkit-backdrop-filter: blur(var(--cc-glass-blur));
          border: 1px solid var(--cc-glass-border);
          border-radius: var(--cc-radius-lg);
          gap: 1rem;
        }
        .cc-page-title {
          margin: 0;
          font-size: 1.75rem;
          font-weight: 700;
          color: var(--cc-text-primary);
        }
        .cc-page-subtitle {
          margin: 0.3rem 0 0;
          color: var(--cc-text-secondary);
          font-size: 0.92rem;
        }
        .cc-form-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 1rem;
        }
        .cc-field-group {
          display: flex;
          flex-direction: column;
          gap: 0.35rem;
        }
        .cc-field-group span {
          font-size: 0.85rem;
          font-weight: 600;
          color: var(--cc-text-secondary);
        }
        .cc-input {
          background: #ffffff;
          border: 1px solid var(--cc-glass-border);
          border-radius: var(--cc-radius-sm);
          padding: 0.65rem 0.85rem;
          color: var(--cc-text-primary);
          font-size: 0.88rem;
          transition: border-color 200ms ease, box-shadow 200ms ease;
        }
        .cc-input:focus {
          outline: none;
          border-color: #2f67f6;
          box-shadow: 0 0 0 3px rgba(47, 103, 246, 0.12);
        }
        .cc-input option {
          background: #ffffff;
          color: #0f172a;
        }
        .cc-inline-select {
          background: #ffffff;
          border: 1px solid rgba(0, 0, 0, 0.12);
          border-radius: 6px;
          padding: 0.35rem 0.5rem;
          color: var(--cc-text-primary);
          font-size: 0.82rem;
          cursor: pointer;
          max-width: 160px;
        }
        .cc-inline-select option {
          background: #ffffff;
          color: #0f172a;
        }
        .cc-bulk-bar {
          display: flex;
          align-items: center;
          gap: 0.6rem;
          padding: 0.75rem 1rem;
          margin-bottom: 0.75rem;
          background: rgba(47, 103, 246, 0.06);
          border: 1px solid rgba(47, 103, 246, 0.2);
          border-radius: 10px;
          animation: cc-slideUp 200ms ease;
          flex-wrap: wrap;
        }
        .cc-bulk-bar__count {
          font-weight: 700;
          font-size: 0.88rem;
          color: #1a1a1a;
          margin-right: auto;
        }
        .cc-bulk-select {
          background: #ffffff;
          border: 1px solid rgba(0, 0, 0, 0.14);
          border-radius: 8px;
          padding: 0.4rem 0.6rem;
          font-size: 0.85rem;
          color: #1a1a1a;
        }
        .cc-bulk-select option {
          background: #ffffff;
          color: #0f172a;
        }
        .cc-tag-row--selected {
          background: rgba(47, 103, 246, 0.07) !important;
          outline: 1px solid rgba(47, 103, 246, 0.25);
        }
        .cc-tag-row--alarming {
          background: rgba(239, 68, 68, 0.05);
        }
        .cc-tag-row--overdue {
          background: rgba(245, 158, 11, 0.05);
        }
        /* Reuse dashboard card/table styles when not defined globally */
        .cc-content-card {
          background: var(--cc-glass-bg);
          backdrop-filter: blur(var(--cc-glass-blur));
          -webkit-backdrop-filter: blur(var(--cc-glass-blur));
          border: 1px solid var(--cc-glass-border);
          border-radius: var(--cc-radius-lg);
          padding: 1.25rem 1.5rem;
        }
        .cc-card-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1rem;
          gap: 1rem;
        }
        .cc-card-title {
          margin: 0;
          font-size: 1.1rem;
          font-weight: 600;
          color: var(--cc-text-primary);
        }
        .cc-card-subtitle {
          margin: 0.25rem 0 0;
          color: var(--cc-text-secondary);
          font-size: 0.88rem;
        }
        .cc-table-wrapper {
          overflow-x: auto;
          margin: 0 -0.5rem;
          padding: 0 0.5rem;
        }
        .cc-data-table {
          width: 100%;
          border-collapse: collapse;
        }
        .cc-data-table th,
        .cc-data-table td {
          padding: 0.85rem 0.75rem;
          text-align: left;
          border-bottom: 1px solid var(--cc-glass-border);
          transition: background 150ms ease;
        }
        .cc-data-table th {
          color: var(--cc-text-muted);
          font-size: 0.76rem;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          font-weight: 700;
        }
        .cc-data-table tbody tr:hover {
          background: rgba(47, 103, 246, 0.05);
        }
        .cc-status-pill {
          display: inline-flex;
          align-items: center;
          border-radius: 999px;
          padding: 0.3rem 0.6rem;
          font-size: 0.72rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          white-space: nowrap;
        }
        .cc-status-pill--danger {
          background: rgba(239, 68, 68, 0.10);
          color: #b91c1c;
        }
        .cc-status-pill--warning {
          background: rgba(245, 158, 11, 0.10);
          color: #92400e;
        }
        .cc-status-pill--neutral {
          background: rgba(0, 0, 0, 0.06);
          color: #475569;
        }
        .cc-empty-state,
        .cc-loading-state {
          padding: 2rem;
          border-radius: 12px;
          background: rgba(0, 0, 0, 0.03);
          color: var(--cc-text-secondary);
          text-align: center;
          font-size: 0.92rem;
        }
        .cc-loading-state::before {
          content: '';
          display: block;
          width: 20px;
          height: 20px;
          border: 2.5px solid rgba(0, 0, 0, 0.12);
          border-top-color: #2f67f6;
          border-radius: 50%;
          animation: spin 700ms linear infinite;
          margin: 0 auto 0.6rem;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        .cc-pill {
          display: inline-flex;
          align-items: center;
          gap: 0.4rem;
          padding: 0.4rem 0.75rem;
          border-radius: 999px;
          font-size: 0.82rem;
          font-weight: 600;
        }
        .cc-pill--neutral {
          background: rgba(0, 0, 0, 0.04);
          color: var(--cc-text-secondary);
          border: 1px solid var(--cc-glass-border);
        }
        .cc-btn-accent {
          background: linear-gradient(135deg, #2f67f6, #1a4ad4);
          color: #ffffff;
          font-weight: 600;
          border: none;
          border-radius: 999px;
          padding: 0.65rem 1.25rem;
          cursor: pointer;
          font-size: 0.88rem;
          box-shadow: 0 6px 18px rgba(47, 103, 246, 0.25);
          transition: transform 200ms ease, box-shadow 200ms ease, filter 200ms ease;
          text-decoration: none;
          display: inline-flex;
          align-items: center;
        }
        .cc-btn-accent:hover {
          filter: brightness(1.1);
          box-shadow: 0 8px 22px rgba(47, 103, 246, 0.35);
          transform: translateY(-2px);
        }
        .cc-btn-ghost {
          background: transparent;
          color: #1a1a1a;
          font-weight: 600;
          border: 1px solid rgba(0, 0, 0, 0.16);
          border-radius: 10px;
          padding: 0.5rem 0.9rem;
          cursor: pointer;
          font-size: 0.85rem;
          transition: all 200ms ease;
          text-decoration: none;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }
        .cc-btn-ghost:hover {
          border-color: rgba(47, 103, 246, 0.5);
          background: rgba(47, 103, 246, 0.07);
          color: #1d4ed8;
        }
        .cc-dashboard {
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
        }
        @media (max-width: 640px) {
          .cc-form-grid {
            grid-template-columns: 1fr;
          }
          .cc-page-header {
            flex-direction: column;
          }
        }
      `}</style>
    </div>
  )
}
