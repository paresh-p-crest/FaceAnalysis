/** Reject when `promise` does not settle within `ms` (industry-standard request bound). */
export function withTimeout(promise, ms, message = 'Request timed out') {
  let timer
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms)
  })
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer))
}

export const DEFAULT_FETCH_TIMEOUT_MS = 15000
