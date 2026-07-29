import { format, formatDistanceToNow, isToday, isYesterday, parseISO } from 'date-fns'

/**
 * Consistent date formatting utilities using date-fns.
 * Inspired by the MSIL production system's date handling patterns.
 */

/**
 * Format a date for table display: "Jan 15, 2026"
 */
export function formatDate(date) {
  if (!date) return '—'
  const d = typeof date === 'string' ? parseISO(date) : new Date(date)
  if (isNaN(d.getTime())) return '—'
  return format(d, 'MMM d, yyyy')
}

/**
 * Format a date with time: "Jan 15, 2026, 3:45 PM"
 */
export function formatDateTime(date) {
  if (!date) return '—'
  const d = typeof date === 'string' ? parseISO(date) : new Date(date)
  if (isNaN(d.getTime())) return '—'
  return format(d, 'MMM d, yyyy, h:mm a')
}

/**
 * Format just the time: "3:45:22 PM"
 */
export function formatTime(date) {
  if (!date) return '—'
  const d = typeof date === 'string' ? parseISO(date) : new Date(date)
  if (isNaN(d.getTime())) return '—'
  return format(d, 'h:mm:ss a')
}

/**
 * "5 minutes ago", "2 hours ago", etc. Updated every render.
 */
export function timeAgo(date) {
  if (!date) return ''
  const d = typeof date === 'string' ? parseISO(date) : new Date(date)
  if (isNaN(d.getTime())) return ''
  return formatDistanceToNow(d, { addSuffix: true })
}

/**
 * Smart short format: "Today 3:45 PM" / "Yesterday 3:45 PM" / "Jan 15"
 */
export function smartDate(date) {
  if (!date) return '—'
  const d = typeof date === 'string' ? parseISO(date) : new Date(date)
  if (isNaN(d.getTime())) return '—'
  if (isToday(d)) return `Today ${format(d, 'h:mm a')}`
  if (isYesterday(d)) return `Yesterday ${format(d, 'h:mm a')}`
  return formatDateTime(d)
}

/**
 * ISO string from a date value (used for input[type=datetime-local])
 */
export function toDatetimeLocal(date) {
  if (!date) return ''
  const d = typeof date === 'string' ? parseISO(date) : new Date(date)
  if (isNaN(d.getTime())) return ''
  return format(d, "yyyy-MM-dd'T'HH:mm")
}

/**
 * Duration in human-readable format
 */
export function formatDuration(seconds) {
  if (seconds === null || seconds === undefined) return '—'
  const mins = Math.floor(seconds / 60)
  const secs = Math.round(seconds % 60)
  if (mins === 0) return `${secs}s`
  if (secs === 0) return `${mins}m`
  return `${mins}m ${secs}s`
}

export default {
  formatDate,
  formatDateTime,
  formatTime,
  timeAgo,
  smartDate,
  toDatetimeLocal,
  formatDuration
}
