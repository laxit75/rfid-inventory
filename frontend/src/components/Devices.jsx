import { useEffect, useState } from 'react'
import api from '../api'

const emptyDevice = { readerId: '', name: '', description: '', zone: '', antennaPort: '', direction: '', status: 'ONLINE' }

export default function Devices() {
  const [readers, setReaders] = useState([])
  const [zones, setZones] = useState([])
  const [form, setForm] = useState(emptyDevice)
  const [editingId, setEditingId] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  const load = async () => {
    setLoading(true)
    try {
      const [readerResponse, zoneResponse] = await Promise.all([api.get('/api/readers'), api.get('/api/zones')])
      setReaders(readerResponse.data)
      setZones(zoneResponse.data)
    } catch (err) {
      setMessage(err.response?.data?.error || 'Unable to load devices.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const save = async (event) => {
    event.preventDefault()
    setSaving(true)
    setMessage('')
    const payload = {
      ...form,
      zone: form.zone || null,
      antennaPort: form.antennaPort === '' ? null : Number(form.antennaPort),
      direction: form.direction || null
    }
    try {
      if (editingId) await api.put(`/api/readers/${editingId}`, payload)
      else await api.post('/api/readers', payload)
      setMessage(editingId ? 'Device updated.' : 'Device added.')
      setForm(emptyDevice)
      setEditingId('')
      load()
    } catch (err) {
      setMessage(err.response?.data?.error || 'Unable to save device.')
    } finally {
      setSaving(false)
    }
  }

  const edit = (reader) => {
    setEditingId(reader._id)
    setForm({
      readerId: reader.readerId,
      name: reader.name,
      description: reader.description || '',
      zone: reader.zone?._id || reader.zone || '',
      antennaPort: reader.antennaPort ?? '',
      direction: reader.direction || '',
      status: reader.status || 'ONLINE'
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return <div className="page-shell">
    <div className="page-head"><div><p className="eyebrow">Device control</p><h2>RFID devices</h2><p className="page-subtitle">Configure readers, antenna ports, directions, and zone assignments.</p></div></div>
    <section className="content-card">
      <div className="card-header"><div><h3>{editingId ? 'Edit device' : 'Add device'}</h3><p className="card-copy">One physical gate normally has an ENTRY and EXIT antenna.</p></div></div>
      {message && <div className="inline-banner info">{message}</div>}
      <form onSubmit={save} className="form-grid">
        <label className="field-group"><span>Reader ID</span><input required value={form.readerId} onChange={e => setForm({ ...form, readerId: e.target.value })} placeholder="Gate-A-Exit" /></label>
        <label className="field-group"><span>Display name</span><input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="North gate exit" /></label>
        <label className="field-group"><span>Assigned zone</span><select value={form.zone} onChange={e => setForm({ ...form, zone: e.target.value })}><option value="">Unassigned</option>{zones.map(zone => <option key={zone._id} value={zone._id}>{zone.name}</option>)}</select></label>
        <label className="field-group"><span>Antenna port</span><input type="number" min="1" value={form.antennaPort} onChange={e => setForm({ ...form, antennaPort: e.target.value })} placeholder="1" /></label>
        <label className="field-group"><span>Direction</span><select value={form.direction} onChange={e => setForm({ ...form, direction: e.target.value })}><option value="">Not configured</option><option value="ENTRY">ENTRY</option><option value="EXIT">EXIT</option></select></label>
        <label className="field-group"><span>Connectivity</span><select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}><option value="ONLINE">ONLINE</option><option value="OFFLINE">OFFLINE</option><option value="UNKNOWN">UNKNOWN</option></select></label>
        <label className="field-group"><span>Description</span><input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Optional installation note" /></label>
        <div className="form-actions button-row"><button className="button" disabled={saving}>{saving ? 'Saving…' : editingId ? 'Save device' : 'Add device'}</button>{editingId && <button className="button button-ghost" type="button" onClick={() => { setEditingId(''); setForm(emptyDevice) }}>Cancel</button>}</div>
      </form>
    </section>
    <section className="content-card"><div className="card-header"><div><h3>Device listing</h3><p className="card-copy">Reader configuration used by the RFID webhook.</p></div><span className="chip">{readers.length} devices</span></div>
      {loading ? <div className="loading-state">Loading devices…</div> : readers.length === 0 ? <div className="empty-state">No RFID devices configured yet.</div> : <div className="table-wrapper"><table className="data-table"><thead><tr><th>Device</th><th>Zone</th><th>Port</th><th>Direction</th><th>Status</th><th>Last seen</th><th>Action</th></tr></thead><tbody>{readers.map(reader => <tr key={reader._id}><td><div className="table-main">{reader.name}</div><div className="table-meta">{reader.readerId}</div></td><td>{reader.zone?.name || 'Unassigned'}</td><td>{reader.antennaPort ?? '—'}</td><td><span className="status-pill neutral">{reader.direction || 'UNSET'}</span></td><td><span className={`status-pill ${reader.status === 'ONLINE' ? 'success' : 'neutral'}`}>{reader.status}</span></td><td>{reader.lastSeenAt ? new Date(reader.lastSeenAt).toLocaleString() : 'Never'}</td><td><button className="button button-secondary" onClick={() => edit(reader)}>Edit</button></td></tr>)}</tbody></table></div>}
    </section>
  </div>
}
