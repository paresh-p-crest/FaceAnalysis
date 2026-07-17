import { getApiBaseUrl } from './apiClient'

const TOKEN_KEY = 'myface_auth_token'
const USER_KEY = 'myface_auth_user'

export function getAuthToken() {
  return localStorage.getItem(TOKEN_KEY) || ''
}

export function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY) || 'null')
  } catch {
    return null
  }
}

export function saveSession({ token, user }) {
  localStorage.setItem(TOKEN_KEY, token)
  localStorage.setItem(USER_KEY, JSON.stringify(user))
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
}

async function authRequest(path, body) {
  const base = getApiBaseUrl() // relative base now, empty string is fine

  const res = await fetch(`${base}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.detail || 'Authentication failed')
  saveSession(data)
  return data.user
}

export function register({ firstName, lastName, email, password }) {
  return authRequest('/api/auth/register', { firstName, lastName, email, password })
}

export function login(email, password) {
  return authRequest('/api/auth/login', { email, password })
}

export async function fetchCurrentUser({ timeoutMs = 12000, retries = 4 } = {}) {
  const base = getApiBaseUrl()
  const token = getAuthToken()
  if (!token) return null

  let lastError = null
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const res = await fetch(`${base}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal,
      })
      if (res.ok) {
        const data = await res.json()
        saveSession({ token, user: data.user })
        return data.user
      }
      // Only drop the session for real auth failures. Transient server/proxy
      // errors (5xx, cold start) must NOT log the user out.
      if (res.status === 401 || res.status === 403) {
        clearSession()
        return null
      }
      lastError = new Error(`auth/me ${res.status}`)
    } catch (err) {
      lastError = err
    } finally {
      clearTimeout(timer)
    }
    // Backend often binds a few seconds after Next on Replit Autoscale.
    if (attempt < retries) {
      await new Promise((r) => setTimeout(r, 500 * (attempt + 1)))
    }
  }
  if (lastError) throw lastError
  return null
}
