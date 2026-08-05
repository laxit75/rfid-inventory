import { useState, useEffect } from 'react'
import axios from 'axios'
import { connectRealtime, disconnectRealtime } from '../realtime'

export default function Simulator() {
  const [tags, setTags] = useState([])
  const [selectedTagId, setSelectedTagId] = useState('')
  const [selectedReader, setSelectedReader] = useState('Shutter-1')
  const [feedbackMessage, setFeedbackMessage] = useState('')
  const [statusTone, setStatusTone] = useState('info')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

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

  useEffect(() => {
    fetchTags(true)
    const interval = setInterval(() => fetchTags(false), 2000)
    const sock = connectRealtime()
    const mergeTag = (incoming) => {
      if (!incoming) return
      const tag = incoming.tag || incoming
      setTags(prev => {
        const idx = prev.findIndex(t => t.tagId === tag.tagId)
        if (idx === -1) return [tag, ...prev]
        const copy = [...prev]
        copy[idx] = { ...copy[idx], ...tag }
        return copy
      })
    }
    sock.on('tag:movement', (payload) => mergeTag(payload.tag || payload))
    sock.on('tag:alarm', (payload) => mergeTag(payload.tag || payload))
    return () => {
      clearInterval(interval)
      try { sock.off('tag:movement') } catch (e) {}
      try { sock.off('tag:alarm') } catch (e) {}
      disconnectRealtime()
    }
  }, [])

  useEffect(() => {
    if (!selectedTagId && tags.length > 0) {
      setSelectedTagId(tags[0].tagId)
      return
    }

    if (selectedTagId && !tags.some(tag => tag.tagId === selectedTagId)) {
      setSelectedTagId('')
      setStatusTone('info')
      setFeedbackMessage('The previously selected tag is no longer available. Please choose another one.')
    }
  }, [selectedTagId, tags])

  const simulate = async (direction) => {
    setBusy(true)
    try {
      const endpoint = direction === 'exit' ? '/api/simulate/exit' : '/api/simulate/return'
      const res = await axios.post(endpoint, {
        tagId: selectedTagId,
        readerId: selectedReader
      })
      setStatusTone('success')
      setFeedbackMessage(`Event processed: ${res.data.movement || 'OK'}`)
      fetchTags(false)
    } catch (err) {
      setStatusTone('error')
      setFeedbackMessage(`Error: ${err.response?.data?.error || err.message}`)
    } finally {
      setBusy(false)
    }
  }

  const selectedTag = tags.find(t => t.tagId === selectedTagId)

  return (
    <div className="page-shell">
      <div className="page-head">
        <div>
          <p className="eyebrow">Simulation</p>
          <h2>RFID simulator</h2>
          <p className="page-subtitle">Send movement events to the live tag state machine and see the outcome immediately.</p>
        </div>
      </div>

      <div className="content-card">
        <div className="card-header">
          <div>
            <h3>Event controls</h3>
            <p className="card-copy">Choose a tag and reader, then simulate entry or exit.</p>
          </div>
        </div>

        <div className="simulator-controls">
          <label className="field-group">
            <span>Tag</span>
            <select value={selectedTagId} onChange={e => setSelectedTagId(e.target.value)}>
              {tags.map(t => (
                <option key={t._id} value={t.tagId}>
                  {t.tagId} - {t.equipment?.name} ({t.status}, {t.currentZone?.name || 'Outside'})
                </option>
              ))}
            </select>
          </label>
          <label className="field-group">
            <span>Reader</span>
            <select value={selectedReader} onChange={e => setSelectedReader(e.target.value)}>
              <option value="Shutter-1">Shutter-1 — Zone A exit (Test Bay north gate)</option>
              <option value="Shutter-1-Entry">Shutter-1-Entry — Zone A entry (Test Bay north gate)</option>
              <option value="Shutter-3">Shutter-3 — Zone A exit (Test Bay east gate)</option>
              <option value="Shutter-3-Entry">Shutter-3-Entry — Zone A entry (Test Bay east gate)</option>
              <option value="Shutter-2">Shutter-2 — Zone B exit (Paint Shop south gate)</option>
              <option value="Shutter-2-Entry">Shutter-2-Entry — Zone B entry (Paint Shop south gate)</option>
              <option value="Reader-C1">Reader-C1 — Zone C exit (Assembly line)</option>
              <option value="Reader-C2">Reader-C2 — Zone C entry (Assembly line)</option>
              <option value="Tool-Crib-Exit">Tool-Crib-Exit — Zone D exit (Tool crib)</option>
              <option value="Tool-Crib-Entry">Tool-Crib-Entry — Zone D entry (Tool crib)</option>
            </select>
          </label>
          <div className="button-row">
            <button className="button" onClick={() => simulate('exit')} disabled={busy || !selectedTagId}>
              {busy ? 'Working…' : 'Simulate EXIT'}
            </button>
            <button className="button button-secondary" onClick={() => simulate('return')} disabled={busy || !selectedTagId}>
              {busy ? 'Working…' : 'Simulate RETURN'}
            </button>
          </div>
        </div>

        {feedbackMessage && (
          <div className={`inline-banner ${statusTone === 'success' ? 'success' : 'error'}`}>
            {feedbackMessage}
          </div>
        )}

        <div className="zone-map">
          <div className="zone-card active">
            <strong>Zone A — Test Bay</strong>
            <span>Shutter-1 (N gate) · Shutter-3 (E gate)</span>
            <span style={{fontSize:'0.75rem',color:'#64748b'}}>2 speakers, 4 readers</span>
          </div>
          <div className="zone-card">
            <strong>Zone B — Paint Shop</strong>
            <span>Shutter-2 (S gate)</span>
            <span style={{fontSize:'0.75rem',color:'#64748b'}}>1 speaker, 2 readers</span>
          </div>
          <div className="zone-card">
            <strong>Zone C — Assembly Line</strong>
            <span>Reader-C1 (exit) · Reader-C2 (entry)</span>
            <span style={{fontSize:'0.75rem',color:'#64748b'}}>1 speaker, 2 readers</span>
          </div>
          <div className="zone-card">
            <strong>Zone D — Tool Crib</strong>
            <span>Tool-Crib-Exit · Tool-Crib-Entry</span>
            <span style={{fontSize:'0.75rem',color:'#64748b'}}>1 speaker, 2 readers</span>
          </div>
        </div>

        {loading ? (
          <div className="loading-state">Loading simulator data…</div>
        ) : selectedTag ? (
          <div className="tag-detail">
            <h3>Current tag state</h3>
            <div className="detail-grid">
              <div><strong>Tag ID</strong><p>{selectedTag.tagId}</p></div>
              <div><strong>Equipment</strong><p>{selectedTag.equipment?.name}</p></div>
              <div><strong>Status</strong><p>{selectedTag.status}</p></div>
              <div><strong>Assigned zone</strong><p>{selectedTag.assignedZone?.name || 'Unassigned'}</p></div>
              <div><strong>Current zone</strong><p>{selectedTag.currentZone?.name || 'Outside all zones'}</p></div>
              <div><strong>Alert</strong><p>{selectedTag.alertStatus}</p></div>
              <div><strong>Silenced</strong><p>{selectedTag.silenced ? 'Yes' : 'No'}</p></div>
            </div>
            {selectedTag.disabledUntil && <p className="card-copy">Disabled until {new Date(selectedTag.disabledUntil).toLocaleString()}</p>}
          </div>
        ) : (
          <div className="empty-state">No tags available for simulation.</div>
        )}
      </div>
    </div>
  )
}
