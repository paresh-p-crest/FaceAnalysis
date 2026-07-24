import { fetchAssessment, fetchMyAssessments, isBackendApiEnabled } from './apiClient'
import { isAssessmentSubmitted, userReportReady } from './reportWorkflow'

/**
 * Newest-first submitted list: return the first user-report-ready assessment (full GET).
 * Falls back past a newer not-ready row so Chat / AI Visuals keep working after soft-delete.
 */
export async function fetchLatestSubmittedAssessment({ limit = 20 } = {}) {
  if (!isBackendApiEnabled()) return null
  const items = await fetchMyAssessments(limit)
  const submitted = (Array.isArray(items) ? items : []).filter(isAssessmentSubmitted)
  const ready = submitted.find((item) => userReportReady(item))
  if (!ready?.id) return null
  return fetchAssessment(ready.id)
}
