import { ERROR_KEYS } from './apiClient'

const ERROR_KEY_VALUES = new Set(Object.values(ERROR_KEYS))

/** True when message is an Errors namespace key (not server detail text). */
export function isApiErrorKey(message) {
  return typeof message === 'string' && ERROR_KEY_VALUES.has(message)
}

/**
 * Resolve a thrown apiClient error for UI display.
 * Prefers Errors namespace translation when err.code is set; falls back to server detail.
 */
export function translateApiError(err, tErrors) {
  const code = err?.code
  if (code && typeof tErrors === 'function') {
    try {
      return tErrors(code)
    } catch {
      /* missing key — fall through */
    }
  }
  const detail = err?.detail
  if (typeof detail === 'string' && detail.trim()) return detail
  const message = err?.message
  if (typeof message === 'string' && message.trim() && !isApiErrorKey(message)) return message
  if (typeof message === 'string' && isApiErrorKey(message) && typeof tErrors === 'function') {
    try {
      return tErrors(message)
    } catch {
      /* fall through */
    }
  }
  return typeof tErrors === 'function' ? tErrors('unknown') : 'Something went wrong'
}
