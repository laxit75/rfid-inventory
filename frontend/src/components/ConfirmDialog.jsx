import { useState, useEffect, useRef } from 'react'

/**
 * A reusable confirmation dialog for destructive actions.
 *
 * Usage:
 *   const [confirmDelete, setConfirmDelete] = useState(null)
 *   <ConfirmDialog
 *     open={!!confirmDelete}
 *     title="Delete recipient"
 *     message={`Remove ${confirmDelete?.name} from alert recipients?`}
 *     confirmLabel="Delete"
 *     destructive
 *     onConfirm={() => setConfirmDelete(null)}
 *     onCancel={() => setConfirmDelete(null)}
 *   />
 */
export default function ConfirmDialog({
  open,
  title = 'Confirm action',
  message = 'Are you sure you want to proceed?',
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  onConfirm,
  onCancel,
  loading = false
}) {
  const dialogRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const handleKey = (e) => {
      if (e.key === 'Escape') onCancel?.()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [open])

  if (!open) return null

  return (
    <div
      className="confirm-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel?.()
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
    >
      <div className="confirm-dialog" ref={dialogRef}>
        <div className="confirm-header">
          <h3 id="confirm-title">{title}</h3>
        </div>
        <p className="confirm-message">{message}</p>
        <div className="confirm-actions">
          <button
            className="button button-ghost"
            onClick={onCancel}
            disabled={loading}
          >
            {cancelLabel}
          </button>
          <button
            className={`button ${destructive ? 'button-danger' : 'button-secondary'}`}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? 'Processing…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
