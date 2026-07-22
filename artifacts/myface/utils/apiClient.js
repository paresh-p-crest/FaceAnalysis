/**
 * Backend API client — used when NEXT_PUBLIC_API_URL is set.
 * Analysis runs on Python FastAPI + PostgreSQL.
 */

/** Stable error codes mapped to messages/Errors namespace keys. UI: translateApiError(err, tErrors). */
export const ERROR_KEYS = {
  CREATE_DRAFT_FAILED: 'createDraftFailed',
  UPLOAD_PHOTO_FAILED: 'uploadPhotoFailed',
  REMOVE_PHOTO_FAILED: 'removePhotoFailed',
  SUBMIT_ASSESSMENT_FAILED: 'submitAssessmentFailed',
  RETRY_PIPELINE_FAILED: 'retryPipelineFailed',
  LOAD_ASSESSMENT_FAILED: 'loadAssessmentFailed',
  LOAD_MY_ASSESSMENTS_FAILED: 'loadMyAssessmentsFailed',
  LOAD_ASSESSMENTS_FAILED: 'loadAssessmentsFailed',
  UPDATE_STATUS_FAILED: 'updateStatusFailed',
  SAVE_ADMIN_REVIEW_FAILED: 'saveAdminReviewFailed',
  DELETE_ASSESSMENT_FAILED: 'deleteAssessmentFailed',
  CLEAR_ASSESSMENTS_FAILED: 'clearAssessmentsFailed',
  CLEAR_PAYMENTS_FAILED: 'clearPaymentsFailed',
  GENERATE_NARRATIVE_FAILED: 'generateNarrativeFailed',
  LOAD_PROTOCOL_FAILED: 'loadProtocolFailed',
  GENERATE_PROTOCOL_FAILED: 'generateProtocolFailed',
  GENERATE_PROTOCOL_SECTION_FAILED: 'generateProtocolSectionFailed',
  GENERATE_PROJECTED_AFTER_FAILED: 'generateProjectedAfterFailed',
  GENERATE_VISUALS_FAILED: 'generateVisualsFailed',
  LOAD_ASSISTANT_FAILED: 'loadAssistantFailed',
  ASSISTANT_UNAVAILABLE: 'assistantUnavailable',
  DOWNLOAD_PDF_FAILED: 'downloadPdfFailed',
  LOAD_PAYMENT_CONFIG_FAILED: 'loadPaymentConfigFailed',
  LOAD_PAYMENTS_FAILED: 'loadPaymentsFailed',
  LOAD_USERS_FAILED: 'loadUsersFailed',
  STRIPE_CHECKOUT_FAILED: 'stripeCheckoutFailed',
  STRIPE_CONFIRM_FAILED: 'stripeConfirmFailed',
  PAYPAL_CHECKOUT_FAILED: 'paypalCheckoutFailed',
  PAYPAL_CAPTURE_FAILED: 'paypalCaptureFailed',
  DELETE_USER_FAILED: 'deleteUserFailed',
}

function apiError(code, detail = null, status = null) {
  const err = new Error(code)
  err.code = code
  err.detail = typeof detail === 'string' ? detail : detail?.message || null
  if (status != null) err.status = status
  return err
}

function throwApiError(res, data, code) {
  const detail = data?.detail
  const serverMsg = typeof detail === 'string' ? detail : detail?.message || null
  throw apiError(code, serverMsg, res.status)
}

export function getApiBaseUrl() {
  const url = process.env.NEXT_PUBLIC_API_URL || ''
  const clean = url.replace(/\/$/, '')

  // In the Replit preview, localhost/127.0.0.0 resolve to the user's browser
  // machine, not the workspace container. Fall back to relative paths so the
  // Next.js rewrite in next.config.js proxies /api/* to the Python backend.
  // A non-localhost URL (e.g. an external production API) is still respected.
  if (clean && /^https?:\/\/localhost/.test(clean)) return ''
  if (clean && /^https?:\/\/127\.\d+\.\d+\.\d+/.test(clean)) return ''
  if (clean && /^https?:\/\/0\.0\.0\.0/.test(clean)) return ''

  return clean
}

export function isBackendApiEnabled() {
  return true
}

function getAuthToken() {
  return localStorage.getItem('myface_auth_token') || ''
}

function authHeaders() {
  const token = getAuthToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

/**
 * Create (or reuse) a draft assessment so validated poses can be uploaded to the
 * media backend before the user submits. Idempotent by (user, scanId).
 */
export async function createAssessmentDraft(scanId = null) {
  const base = getApiBaseUrl()
  const res = await fetch(`${base}/api/assessments/draft`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
    },
    body: JSON.stringify({ scanId: scanId || undefined }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throwApiError(res, data, ERROR_KEYS.CREATE_DRAFT_FAILED)
  return data
}

/**
 * Upload one original-quality pose image (the raw File/Blob, no re-encode) to a
 * draft via multipart/form-data. Returns the stored photo metadata (incl. publicUrl).
 */
export async function uploadAssessmentPhoto(assessmentId, poseId, file) {
  const base = getApiBaseUrl()
  const form = new FormData()
  const filename = (file && file.name) || `${poseId}.jpg`
  form.append('file', file, filename)
  const res = await fetch(`${base}/api/assessments/${assessmentId}/photos/${poseId}`, {
    method: 'PUT',
    headers: authHeaders(),
    body: form,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throwApiError(res, data, ERROR_KEYS.UPLOAD_PHOTO_FAILED)
  return data
}

export async function deleteAssessmentPhoto(assessmentId, poseId) {
  const base = getApiBaseUrl()
  const res = await fetch(`${base}/api/assessments/${assessmentId}/photos/${poseId}`, {
    method: 'DELETE',
    headers: authHeaders(),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throwApiError(res, data, ERROR_KEYS.REMOVE_PHOTO_FAILED)
  return data
}

/** Finalize a draft: persist answers + enqueue the async pipeline. */
export async function submitAssessment(assessmentId, { answers = {}, provider = 'local' } = {}) {
  const base = getApiBaseUrl()
  const res = await fetch(`${base}/api/assessments/${assessmentId}/submit`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
    },
    body: JSON.stringify({ answers: answers || {}, provider }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throwApiError(res, data, ERROR_KEYS.SUBMIT_ASSESSMENT_FAILED)
  return data
}

/** Admin/owner: re-enqueue a failed pipeline job. */
export async function retryAssessmentPipeline(assessmentId) {
  const base = getApiBaseUrl()
  const res = await fetch(`${base}/api/assessments/${assessmentId}/retry-pipeline`, {
    method: 'POST',
    headers: authHeaders(),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throwApiError(res, data, ERROR_KEYS.RETRY_PIPELINE_FAILED)
  return data
}

export async function fetchAssessment(assessmentId) {
  const base = getApiBaseUrl()
  const res = await fetch(`${base}/api/assessments/${assessmentId}`, {
    headers: authHeaders(),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throwApiError(res, data, ERROR_KEYS.LOAD_ASSESSMENT_FAILED)
  return data
}

/** True when doc is a full GET payload (not a list summary). */
export function isFullCloudAssessment(assessment) {
  if (!assessment?.id) return false
  if (assessment.answers != null || assessment.photos != null) return true
  if (
    assessment.protocolNarrative != null
    || assessment.featureNarratives != null
    || assessment.aiNarrative != null
    || assessment.featureParsing != null
    || assessment.projectedAfter != null
    || assessment.projectedAnalysis != null
  ) {
    return true
  }
  const cv = assessment.analysis?.cvReport
  return !!(cv?.faceShape || cv?.nose || cv?.eyes || cv?.features || cv?.symmetry?.summary)
}

export async function fetchMyAssessments(limit = 20) {
  const base = getApiBaseUrl()
  const res = await fetch(`${base}/api/my/assessments?limit=${limit}`, {
    headers: authHeaders(),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throwApiError(res, data, ERROR_KEYS.LOAD_MY_ASSESSMENTS_FAILED)
  return data.items || []
}

/** Latest in-progress draft (uploads without submit). Not in fetchMyAssessments list. */
export async function fetchMyAssessmentDraft() {
  const base = getApiBaseUrl()
  const res = await fetch(`${base}/api/my/assessments/draft`, {
    headers: authHeaders(),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throwApiError(res, data, ERROR_KEYS.LOAD_MY_ASSESSMENTS_FAILED)
  return data.item || null
}

export async function fetchAdminAssessments(limit = 50) {
  const base = getApiBaseUrl()
  const res = await fetch(`${base}/api/assessments?limit=${limit}`, {
    headers: authHeaders(),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throwApiError(res, data, ERROR_KEYS.LOAD_ASSESSMENTS_FAILED)
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
  if (!res.ok) throwApiError(res, data, ERROR_KEYS.UPDATE_STATUS_FAILED)
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
  if (!res.ok) throwApiError(res, data, ERROR_KEYS.SAVE_ADMIN_REVIEW_FAILED)
  return data
}

export async function deleteAssessment(assessmentId) {
  const base = getApiBaseUrl()
  const res = await fetch(`${base}/api/assessments/${assessmentId}`, {
    method: 'DELETE',
    headers: authHeaders(),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throwApiError(res, data, ERROR_KEYS.DELETE_ASSESSMENT_FAILED)
  return data
}

export async function deleteAllAssessments() {
  const base = getApiBaseUrl()
  const res = await fetch(`${base}/api/assessments`, {
    method: 'DELETE',
    headers: authHeaders(),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throwApiError(res, data, ERROR_KEYS.CLEAR_ASSESSMENTS_FAILED)
  return data
}

export async function deleteAllPayments() {
  const base = getApiBaseUrl()
  const res = await fetch(`${base}/api/payments`, {
    method: 'DELETE',
    headers: authHeaders(),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throwApiError(res, data, ERROR_KEYS.CLEAR_PAYMENTS_FAILED)
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
  if (!res.ok) throwApiError(res, data, ERROR_KEYS.GENERATE_NARRATIVE_FAILED)
  return data
}

export async function fetchAssessmentProtocol(assessmentId) {
  const base = getApiBaseUrl()
  const res = await fetch(`${base}/api/assessments/${assessmentId}/protocol`, {
    headers: authHeaders(),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw apiError(ERROR_KEYS.LOAD_PROTOCOL_FAILED, data?.detail, res.status)
  return data
}

export async function generateAssessmentProtocol(assessmentId, { force = false } = {}) {
  const base = getApiBaseUrl()
  const qs = force ? '?force=true' : ''
  const res = await fetch(`${base}/api/assessments/${assessmentId}/ai-protocol${qs}`, {
    method: 'POST',
    headers: authHeaders(),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throwApiError(res, data, ERROR_KEYS.GENERATE_PROTOCOL_FAILED)
  return data
}

export async function generateAssessmentProtocolSection(assessmentId, sectionId) {
  const base = getApiBaseUrl()
  const res = await fetch(`${base}/api/assessments/${assessmentId}/ai-protocol/section`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
    },
    body: JSON.stringify({ sectionId }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throwApiError(res, data, ERROR_KEYS.GENERATE_PROTOCOL_SECTION_FAILED)
  return data
}

export async function generateProjectedAfter(assessmentId) {
  const base = getApiBaseUrl()
  const res = await fetch(`${base}/api/assessments/${assessmentId}/projected-after`, {
    method: 'POST',
    headers: authHeaders(),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throwApiError(res, data, ERROR_KEYS.GENERATE_PROJECTED_AFTER_FAILED)
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
  if (!res.ok) throwApiError(res, data, ERROR_KEYS.GENERATE_VISUALS_FAILED)
  return data
}

export async function fetchAssistantConversation(assessmentId) {
  const base = getApiBaseUrl()
  const res = await fetch(`${base}/api/assessments/${assessmentId}/assistant`, {
    headers: authHeaders(),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throwApiError(res, data, ERROR_KEYS.LOAD_ASSISTANT_FAILED)
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
    const serverMsg = typeof detail === 'string' ? detail : detail?.message || null
    const code = typeof detail === 'object' && detail?.code ? detail.code : ERROR_KEYS.ASSISTANT_UNAVAILABLE
    throw apiError(code, serverMsg, res.status)
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
    throwApiError(res, data, ERROR_KEYS.DOWNLOAD_PDF_FAILED)
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
  // base may be empty (relative paths) and still be reachable via the Next.js rewrite
  const res = await fetch(`${base || ''}/api/health`)
  return res.json()
}

export async function fetchPaymentConfig() {
  const base = getApiBaseUrl()
  const res = await fetch(`${base}/api/payments/config`)
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throwApiError(res, data, ERROR_KEYS.LOAD_PAYMENT_CONFIG_FAILED)
  return data
}

export async function fetchMyPayments(limit = 20) {
  const base = getApiBaseUrl()
  const res = await fetch(`${base}/api/payments/my?limit=${limit}`, {
    headers: authHeaders(),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throwApiError(res, data, ERROR_KEYS.LOAD_PAYMENTS_FAILED)
  return data.items || []
}

export async function fetchAdminPayments(limit = 50) {
  const base = getApiBaseUrl()
  const res = await fetch(`${base}/api/payments?limit=${limit}`, {
    headers: authHeaders(),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throwApiError(res, data, ERROR_KEYS.LOAD_PAYMENTS_FAILED)
  return data.items || []
}

export async function fetchAdminUsers(limit = 100) {
  const base = getApiBaseUrl()
  const res = await fetch(`${base}/api/auth/users?limit=${limit}`, {
    headers: authHeaders(),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throwApiError(res, data, ERROR_KEYS.LOAD_USERS_FAILED)
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
  if (!res.ok) throwApiError(res, data, ERROR_KEYS.STRIPE_CHECKOUT_FAILED)
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
  if (!res.ok) throwApiError(res, data, ERROR_KEYS.STRIPE_CONFIRM_FAILED)
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
  if (!res.ok) throwApiError(res, data, ERROR_KEYS.PAYPAL_CHECKOUT_FAILED)
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
  if (!res.ok) throwApiError(res, data, ERROR_KEYS.PAYPAL_CAPTURE_FAILED)
  return data
}

export async function deleteAdminUser(userId) {
  const base = getApiBaseUrl()
  const res = await fetch(`${base}/api/auth/users/${userId}`, {
    method: 'DELETE',
    headers: authHeaders(),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throwApiError(res, data, ERROR_KEYS.DELETE_USER_FAILED)
  return data
}
