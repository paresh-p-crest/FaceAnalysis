/**
 * Backend API client — used when NEXT_PUBLIC_API_URL is set.
 * Analysis runs on Python FastAPI + saves to MongoDB.
 */

import { getAwsCredentials } from './settings'
import { prepareImageForBackend, preparePhotosForBackend } from './imagePayload'

const inflightScans = new Map()

function scanCacheKey(scanId) {
  if (!scanId) return null
  const token = localStorage.getItem('myface_auth_token') || 'anon'
  return `${token}:${scanId}`
}

export function getApiBaseUrl() {
  const url = process.env.NEXT_PUBLIC_API_URL || ''
  return url.replace(/\/$/, '')
}

export function isBackendApiEnabled() {
  return Boolean(getApiBaseUrl())
}

function getAuthToken() {
  return localStorage.getItem('myface_auth_token') || ''
}

function authHeaders() {
  const token = getAuthToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

async function toBackendImagePayload(src) {
  return prepareImageForBackend(src)
}

async function normalizePhotosForBackend(photos = {}) {
  return preparePhotosForBackend(photos)
}

export async function runFaceAnalysisViaBackend(photo, answers, photos = {}, provider = 'local', scanId = null) {
  const cacheKey = scanCacheKey(scanId)
  if (cacheKey && inflightScans.has(cacheKey)) {
    return inflightScans.get(cacheKey)
  }

  const run = async () => {
    const base = getApiBaseUrl()
    const [imageBase64, normalizedPhotos] = await Promise.all([
      toBackendImagePayload(photo),
      normalizePhotosForBackend(photos),
    ])
    if (imageBase64 && !normalizedPhotos.front) {
      normalizedPhotos.front = imageBase64
    }

    const body = {
      imageBase64,
      answers: answers || {},
      photos: normalizedPhotos || {},
      provider: provider === 'aws' ? 'aws' : 'local',
      scanId: scanId || undefined,
    }

    if (provider === 'aws') {
      const creds = getAwsCredentials()
      body.awsCredentials = {
        accessKeyId: creds.accessKeyId,
        secretAccessKey: creds.secretAccessKey,
        sessionToken: creds.sessionToken || undefined,
        region: creds.region || 'us-east-1',
      }
    }

    const res = await fetch(`${base}/api/assessments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders(),
      },
      body: JSON.stringify(body),
    })

    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      throw new Error(data.detail || data.message || `Backend error ${res.status}`)
    }

    return {
      ...data.analysis,
      assessmentId: data.assessmentId,
      savedToDb: true,
      reportStatus: data.status,
      scanId,
      aiNarrative: data.aiNarrative || null,
      protocolData: data.protocolData || null,
      protocolNarrative: data.protocolNarrative || null,
      featureNarratives: data.featureNarratives || null,
      protocolStorage: data.protocolStorage || null,
    }
  }

  const promise = run()
  if (cacheKey) inflightScans.set(cacheKey, promise)
  try {
    return await promise
  } finally {
    if (cacheKey) inflightScans.delete(cacheKey)
  }
}

export async function fetchAssessment(assessmentId) {
  const base = getApiBaseUrl()
  const res = await fetch(`${base}/api/assessments/${assessmentId}`, {
    headers: authHeaders(),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.detail || 'Failed to load assessment')
  return data
}

export async function fetchMyAssessments(limit = 20) {
  const base = getApiBaseUrl()
  const res = await fetch(`${base}/api/my/assessments?limit=${limit}`, {
    headers: authHeaders(),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.detail || 'Failed to load your assessments')
  return data.items || []
}

export async function fetchAdminAssessments(limit = 50) {
  const base = getApiBaseUrl()
  const res = await fetch(`${base}/api/assessments?limit=${limit}`, {
    headers: authHeaders(),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.detail || 'Failed to load assessments')
  return data.items || []
}

export async function updateAssessmentStatus(assessmentId, status) {
  const base = getApiBaseUrl()
  const res = await fetch(`${base}/api/assessments/${assessmentId}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
    },
    body: JSON.stringify({ status }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.detail || 'Failed to update report status')
  return data
}

export async function updateAssessmentAdminReview(assessmentId, payload) {
  const base = getApiBaseUrl()
  const res = await fetch(`${base}/api/assessments/${assessmentId}/admin-review`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
    },
    body: JSON.stringify(payload),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.detail || 'Failed to save admin review')
  return data
}

export async function deleteAssessment(assessmentId) {
  const base = getApiBaseUrl()
  const res = await fetch(`${base}/api/assessments/${assessmentId}`, {
    method: 'DELETE',
    headers: authHeaders(),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.detail || 'Failed to delete assessment')
  return data
}

export async function deleteAllAssessments() {
  const base = getApiBaseUrl()
  const res = await fetch(`${base}/api/assessments`, {
    method: 'DELETE',
    headers: authHeaders(),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.detail || 'Failed to clear assessments')
  return data
}

export async function deleteAllPayments() {
  const base = getApiBaseUrl()
  const res = await fetch(`${base}/api/payments`, {
    method: 'DELETE',
    headers: authHeaders(),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.detail || 'Failed to clear payments')
  return data
}

export async function generateAssessmentNarrative(assessmentId, { force = false } = {}) {
  const base = getApiBaseUrl()
  const qs = force ? '?force=true' : ''
  const res = await fetch(`${base}/api/assessments/${assessmentId}/ai-narrative${qs}`, {
    method: 'POST',
    headers: authHeaders(),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.detail || 'Failed to generate AI narrative')
  return data
}

export async function fetchAssessmentProtocol(assessmentId) {
  const base = getApiBaseUrl()
  const res = await fetch(`${base}/api/assessments/${assessmentId}/protocol`, {
    headers: authHeaders(),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = new Error(data.detail || 'Failed to load protocol')
    err.status = res.status
    throw err
  }
  return data
}

export async function generateAssessmentProtocol(assessmentId) {
  const base = getApiBaseUrl()
  const res = await fetch(`${base}/api/assessments/${assessmentId}/ai-protocol`, {
    method: 'POST',
    headers: authHeaders(),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.detail || 'Failed to generate AI protocol')
  return data
}

/** Load stored protocol or trigger one-time backend generation when missing. */
export async function ensureAssessmentProtocol(assessmentId) {
  try {
    return await fetchAssessmentProtocol(assessmentId)
  } catch (err) {
    if (err.status !== 404) throw err
    const assessment = await generateAssessmentProtocol(assessmentId)
    return {
      protocolData: assessment?.protocolData,
      protocolNarrative: assessment?.protocolNarrative,
      featureNarratives: assessment?.featureNarratives,
      protocolStorage: assessment?.protocolStorage,
      source: 'generated',
    }
  }
}

export async function generateAssessmentVisuals(assessmentId, variants = ['hair', 'outfit', 'aging']) {
  const base = getApiBaseUrl()
  const res = await fetch(`${base}/api/assessments/${assessmentId}/ai-visuals`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
    },
    body: JSON.stringify({ variants }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.detail || 'Failed to generate AI visuals')
  return data
}

export async function fetchAssistantConversation(assessmentId) {
  const base = getApiBaseUrl()
  const res = await fetch(`${base}/api/assessments/${assessmentId}/assistant`, {
    headers: authHeaders(),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.detail || 'Failed to load assistant conversation')
  return data
}

export async function sendAssistantMessage(assessmentId, message) {
  const base = getApiBaseUrl()
  const res = await fetch(`${base}/api/assessments/${assessmentId}/assistant`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
    },
    body: JSON.stringify({ message }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const detail = data.detail
    const msg = typeof detail === 'string'
      ? detail
      : (detail?.message || 'Beauty Assistant is not working right now. Please try again later.')
    const err = new Error(msg)
    err.status = res.status
    err.code = typeof detail === 'object' ? detail?.code : undefined
    throw err
  }
  return data
}

export async function downloadAssessmentPdf(assessmentId) {
  const base = getApiBaseUrl()
  const res = await fetch(`${base}/api/assessments/${assessmentId}/pdf`, {
    headers: authHeaders(),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.detail || 'Failed to download report PDF')
  }

  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `MyFace-${assessmentId}.pdf`
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

export async function checkBackendHealth() {
  const base = getApiBaseUrl()
  if (!base) return { ok: false, mongodb: 'not_configured' }
  const res = await fetch(`${base}/api/health`)
  return res.json()
}

export async function fetchPaymentConfig() {
  const base = getApiBaseUrl()
  const res = await fetch(`${base}/api/payments/config`)
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.detail || 'Failed to load payment configuration')
  return data
}

export async function fetchMyPayments(limit = 20) {
  const base = getApiBaseUrl()
  const res = await fetch(`${base}/api/payments/my?limit=${limit}`, {
    headers: authHeaders(),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.detail || 'Failed to load payments')
  return data.items || []
}

export async function fetchAdminPayments(limit = 50) {
  const base = getApiBaseUrl()
  const res = await fetch(`${base}/api/payments?limit=${limit}`, {
    headers: authHeaders(),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.detail || 'Failed to load payments')
  return data.items || []
}

export async function fetchAdminUsers(limit = 100) {
  const base = getApiBaseUrl()
  const res = await fetch(`${base}/api/auth/users?limit=${limit}`, {
    headers: authHeaders(),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.detail || 'Failed to load users')
  return data.items || []
}

export async function createStripeCheckout(payload = {}) {
  const base = getApiBaseUrl()
  const res = await fetch(`${base}/api/payments/stripe/checkout`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
    },
    body: JSON.stringify(payload),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.detail || 'Failed to start Stripe checkout')
  return data
}

export async function confirmStripeCheckout(sessionId) {
  const base = getApiBaseUrl()
  const res = await fetch(`${base}/api/payments/stripe/confirm`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
    },
    body: JSON.stringify({ sessionId }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.detail || 'Failed to confirm Stripe checkout')
  return data
}

export async function createPayPalOrder(payload = {}) {
  const base = getApiBaseUrl()
  const res = await fetch(`${base}/api/payments/paypal/orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
    },
    body: JSON.stringify(payload),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.detail || 'Failed to start PayPal checkout')
  return data
}

export async function capturePayPalOrder(orderId) {
  const base = getApiBaseUrl()
  const res = await fetch(`${base}/api/payments/paypal/capture`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
    },
    body: JSON.stringify({ orderId }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.detail || 'Failed to capture PayPal order')
  return data
}

export async function fetchAdminPricing() {
  const base = getApiBaseUrl()
  const res = await fetch(`${base}/api/admin/pricing`, {
    headers: authHeaders(),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.detail || 'Failed to load pricing')
  return data.product
}

export async function updateAdminPricing(payload) {
  const base = getApiBaseUrl()
  const res = await fetch(`${base}/api/admin/pricing`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
    },
    body: JSON.stringify(payload),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.detail || 'Failed to update pricing')
  return data.product
}

export async function deleteAdminUser(userId) {
  const base = getApiBaseUrl()
  const res = await fetch(`${base}/api/auth/users/${userId}`, {
    method: 'DELETE',
    headers: authHeaders(),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.detail || 'Failed to delete user')
  return data
}
