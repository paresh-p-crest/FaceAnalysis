/** Safe numeric formatting — never surfaces NaN/Infinity in UI or reports. */
export function safeNum(value, fallback = 0) {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

export function safeFixed(value, digits = 1, fallback = '0') {
  const n = safeNum(value, NaN)
  return Number.isFinite(n) ? n.toFixed(digits) : fallback
}

export function safeRound(value, fallback = 0) {
  return Math.round(safeNum(value, fallback))
}

export function safeDisplay(value, fallback = '—') {
  if (value == null || value === '') return fallback
  if (typeof value === 'number' && !Number.isFinite(value)) return fallback
  if (typeof value === 'string' && (value === 'NaN' || value === 'Infinity')) return fallback
  return value
}
