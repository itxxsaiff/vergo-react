export function formatStatusLabel(status) {
  if (!status) {
    return 'Unknown'
  }

  return status
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

export function getStatusBadgeClass(status) {
  const normalizedStatus = String(status || '').toLowerCase()

  if (['active', 'approved', 'ready', 'paid', 'analyzed', 'fair'].includes(normalizedStatus)) {
    return 'badge bg-light-success text-success fw-semibold fs-2 rounded-3 py-2 px-3'
  }

  if (['pending', 'processing', 'draft', 'review', 'offline', 'queued', 'too_low', 'unknown'].includes(normalizedStatus)) {
    return 'badge bg-light-warning text-warning fw-semibold fs-2 rounded-3 py-2 px-3'
  }

  if (['submitted', 'shortlisted', 'in_review', 'open', 'awaiting_owner_approval'].includes(normalizedStatus)) {
    return 'badge bg-light-primary text-primary fw-semibold fs-2 rounded-3 py-2 px-3'
  }

  if (['completed', 'archived', 'closed', 'refunded'].includes(normalizedStatus)) {
    return 'badge bg-light-primary text-primary fw-semibold fs-2 rounded-3 py-2 px-3'
  }

  if (['cancel', 'cancelled', 'inactive', 'rejected', 'failed', 'too_high'].includes(normalizedStatus)) {
    return 'badge bg-light-danger text-danger fw-semibold fs-2 rounded-3 py-2 px-3'
  }

  return 'badge bg-light-secondary text-secondary fw-semibold fs-2 rounded-3 py-2 px-3'
}
