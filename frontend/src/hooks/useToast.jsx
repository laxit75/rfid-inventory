import { useState, useCallback, useRef } from 'react'

let toastIdCounter = 0

/**
 * A centered toast notification system inspired by the sw attendance management project.
 *
 * Usage:
 *   const { toast, Toaster } = useToast()
 *   toast({ title: 'Saved', description: 'Settings updated.', variant: 'success' })
 *   // Render <Toaster /> near page root
 */
export function useToast() {
  const [toasts, setToasts] = useState([])
  const timersRef = useRef({})

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
    if (timersRef.current[id]) {
      clearTimeout(timersRef.current[id])
      delete timersRef.current[id]
    }
  }, [])

  const toast = useCallback(({ title, description, variant = 'info', duration = 4000, action }) => {
    const id = ++toastIdCounter
    const toastItem = { id, title, description, variant, action }

    setToasts((prev) => [...prev, toastItem])

    if (duration > 0) {
      timersRef.current[id] = setTimeout(() => {
        dismiss(id)
      }, duration)
    }

    return id
  }, [dismiss])

  function Toaster() {
    if (toasts.length === 0) return null

    return (
      <div className="toast-stack">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`toast ${t.variant === 'error' ? 'toast-error' : t.variant === 'success' ? 'toast-success' : t.variant === 'warning' ? 'toast-warning' : ''}`}
            role="alert"
          >
            <div className="toast-content">
              {t.title && <div className="toast-title">{t.title}</div>}
              {t.description && <div className="toast-description">{t.description}</div>}
            </div>
            {t.action && <div className="toast-action">{t.action}</div>}
            <button className="toast-close" onClick={() => dismiss(t.id)} aria-label="Dismiss">×</button>
          </div>
        ))}
      </div>
    )
  }

  return { toast, Toaster, dismiss }
}

export default useToast
