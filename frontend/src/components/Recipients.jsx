import { useState, useEffect } from 'react'
import axios from 'axios'

export default function Recipients() {
  const [recipients, setRecipients] = useState([])
  const [newRecipient, setNewRecipient] = useState({ email: '', name: '' })
  const [editId, setEditId] = useState(null)
  const [editForm, setEditForm] = useState({ email: '', name: '' })
  const [loading, setLoading] = useState(true)
  const [formError, setFormError] = useState('')
  const [feedback, setFeedback] = useState('')
  const [saving, setSaving] = useState(false)

  const token = localStorage.getItem('token')

  const fetchRecipients = async () => {
    setLoading(true)
    const res = await axios.get('/api/recipients', { headers: { Authorization: `Bearer ${token}` } })
    setRecipients(res.data)
    setLoading(false)
  }

  useEffect(() => { fetchRecipients() }, [])

  const handleAdd = async (e) => {
    e.preventDefault()
    if (!newRecipient.email || !newRecipient.name) {
      setFormError('Both name and email are required.')
      return
    }
    setSaving(true)
    setFormError('')
    try {
      await axios.post('/api/recipients', newRecipient, { headers: { Authorization: `Bearer ${token}` } })
      setFeedback('Recipient added successfully.')
      setNewRecipient({ email: '', name: '' })
      fetchRecipients()
    } catch (err) {
      setFormError(err.response?.data?.error || 'Unable to add recipient.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id) => {
    try {
      await axios.delete(`/api/recipients/${id}`, { headers: { Authorization: `Bearer ${token}` } })
      setFeedback('Recipient removed.')
      fetchRecipients()
    } catch (err) {
      setFormError(err.response?.data?.error || 'Unable to delete recipient.')
    }
  }

  const handleEditStart = (recipient) => {
    setEditId(recipient._id)
    setEditForm({ email: recipient.email, name: recipient.name })
  }

  const handleEditSave = async () => {
    setSaving(true)
    try {
      await axios.put(`/api/recipients/${editId}`, editForm, { headers: { Authorization: `Bearer ${token}` } })
      setEditId(null)
      setFeedback('Recipient updated successfully.')
      fetchRecipients()
    } catch (err) {
      setFormError(err.response?.data?.error || 'Unable to update recipient.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="page-shell">
      <div className="page-head">
        <div>
          <p className="eyebrow">Admin</p>
          <h2>Email recipients</h2>
          <p className="page-subtitle">Manage who receives alert emails for the RFID system.</p>
        </div>
      </div>

      <div className="content-card">
        {formError && <div className="inline-banner error">{formError}</div>}
        {feedback && <div className="inline-banner success">{feedback}</div>}
        <form onSubmit={handleAdd} className="form-grid">
          <label className="field-group">
            <span>Name</span>
            <input type="text" placeholder="Name" value={newRecipient.name} onChange={e => setNewRecipient({ ...newRecipient, name: e.target.value })} required />
          </label>
          <label className="field-group">
            <span>Email</span>
            <input type="email" placeholder="Email" value={newRecipient.email} onChange={e => setNewRecipient({ ...newRecipient, email: e.target.value })} required />
          </label>
          <div className="form-actions">
            <button className="button" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Add recipient'}</button>
          </div>
        </form>
      </div>

      <div className="content-card">
        {loading ? (
          <div className="loading-state">Loading recipients…</div>
        ) : recipients.length === 0 ? (
          <div className="empty-state">No recipients configured yet.</div>
        ) : (
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {recipients.map(r => (
                  <tr key={r._id}>
                    {editId === r._id ? (
                      <>
                        <td><input value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} /></td>
                        <td><input value={editForm.email} onChange={e => setEditForm({ ...editForm, email: e.target.value })} /></td>
                        <td>
                          <div className="button-row">
                            <button className="button button-secondary" onClick={handleEditSave}>Save</button>
                            <button className="button button-ghost" onClick={() => setEditId(null)}>Cancel</button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td>{r.name}</td>
                        <td>{r.email}</td>
                        <td>
                          <div className="button-row">
                            <button className="button button-secondary" onClick={() => handleEditStart(r)}>Edit</button>
                            <button className="button button-ghost" onClick={() => handleDelete(r._id)}>Delete</button>
                          </div>
                        </td>
                      </>
                    )}
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