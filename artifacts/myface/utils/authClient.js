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

export async function fetchCurrentUser() {
  const base = getApiBaseUrl()
  const token = getAuthToken()
  if (!token) return null

  const res = await fetch(`${base}/api/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) {
    clearSession()
    return null
  }
  const data = await res.json()
  saveSession({ token, user: data.user })
  return data.user
}
