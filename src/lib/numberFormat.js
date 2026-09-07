// Swiss number formatting: thousands are separated by an apostrophe.
//   1000     -> 1'000
//   10000    -> 10'000
//   1000000  -> 1'000'000
//   1234.5   -> 1'234.50   (with decimals: 2)
//
// Written by hand rather than through Intl: de-CH renders the group separator
// as a typographic right single quote (U+2019), and Vergo asks for the plain
// apostrophe.

const GROUP_SEPARATOR = "'"

function groupThousands(digits) {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, GROUP_SEPARATOR)
}

/**
 * Formats a number the Swiss way. Returns the fallback when the value is not a
 * usable number, so a missing amount still renders as "-" rather than "NaN".
 */
export function formatSwissNumber(value, { decimals = null, fallback = '-' } = {}) {
  if (value === null || value === undefined || value === '') {
    return fallback
  }

  const numeric = typeof value === 'number' ? value : Number(String(value).replace(/'/g, ''))

  if (!Number.isFinite(numeric)) {
    return fallback
  }

  const fixed = decimals === null ? String(numeric) : numeric.toFixed(decimals)
  const negative = fixed.startsWith('-')
  const [whole, fraction] = (negative ? fixed.slice(1) : fixed).split('.')
  const grouped = groupThousands(whole)

  return `${negative ? '-' : ''}${grouped}${fraction ? `.${fraction}` : ''}`
}

/** Money is always shown with two decimals. */
export function formatSwissMoney(value, { fallback = '-' } = {}) {
  return formatSwissNumber(value, { decimals: 2, fallback })
}

/**
 * Quantities keep whatever precision was entered - 25 stays 25, 25.5 stays
 * 25.5 - but still get the thousands separator.
 */
export function formatSwissQuantity(value, { fallback = '-' } = {}) {
  return formatSwissNumber(value, { decimals: null, fallback })
}

/** Turns "10'000.50" back into 10000.5 for calculations and form state. */
export function parseSwissNumber(value) {
  if (value === null || value === undefined || value === '') {
    return null
  }

  const numeric = Number(String(value).replace(/'/g, '').replace(/\s/g, ''))

  return Number.isFinite(numeric) ? numeric : null
}
