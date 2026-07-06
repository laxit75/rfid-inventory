import { useState, useEffect } from 'react'
import axios from 'axios'

export default function TagManagement() {
  const [tags, setTags] = useState([])
  const [zones, setZones] = useState([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState(null)

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

  useEffect(() => {
    fetchTags(true)
    fetchZones()
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
        {loading ? (
          <div className="loading-state">Loading tags…</div>
        ) : tags.length === 0 ? (
          <div className="empty-state">No tags are available to manage.</div>
        ) : (
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
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
                  <tr key={tag._id}>
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
        )}
      </div>
    </div>
  )
}