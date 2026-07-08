function normalizeDateParts(value) {
  if (!value) {
    return null
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return {
      day: String(value.getDate()).padStart(2, '0'),
      month: String(value.getMonth() + 1).padStart(2, '0'),
      year: String(value.getFullYear()),
    }
  }

  const stringValue = String(value).trim()

  if (!stringValue) {
    return null
  }

  const isoMatch = stringValue.match(/^(\d{4})-(\d{2})-(\d{2})/)

  if (isoMatch) {
    return {
      year: isoMatch[1],
      month: isoMatch[2],
      day: isoMatch[3],
    }
  }

  const parsedDate = new Date(stringValue)

  if (Number.isNaN(parsedDate.getTime())) {
    return null
  }

  return {
    day: String(parsedDate.getDate()).padStart(2, '0'),
    month: String(parsedDate.getMonth() + 1).padStart(2, '0'),
    year: String(parsedDate.getFullYear()),
  }
}

export function formatDateDisplay(value) {
  const parts = normalizeDateParts(value)

  if (!parts) {
    return value || '-'
  }

  return `${parts.day}.${parts.month}.${parts.year}`
}

export function formatTimeDisplay(value) {
  if (!value) {
    return '-'
  }

  const stringValue = String(value).trim()
  const timeMatch = stringValue.match(/(\d{2}:\d{2})/)

  if (timeMatch) {
    return timeMatch[1]
  }

  const parsedDate = new Date(stringValue)

  if (Number.isNaN(parsedDate.getTime())) {
    return stringValue || '-'
  }

  return `${String(parsedDate.getHours()).padStart(2, '0')}:${String(parsedDate.getMinutes()).padStart(2, '0')}`
}

export function formatDateTimeDisplay(value) {
  if (!value) {
    return '-'
  }

  return `${formatDateDisplay(value)} ${formatTimeDisplay(value)}`
}
