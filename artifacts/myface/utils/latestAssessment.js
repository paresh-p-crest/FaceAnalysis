import { fetchAssessment, fetchMyAssessments, isBackendApiEnabled } from './apiClient'
import { isAssessmentSubmitted, userReportReady } from './reportWorkflow'

/**
 * Latest submitted assessment only (newest-first list).
 * Returns full assessment when that latest item is user-report-ready; otherwise null.
 * Does not fall back to an older ready report.
 */
export async function fetchLatestSubmittedAssessment({ limit = 20 } = {}) {
  if (!isBackendApiEnabled()) return null
  const items = await fetchMyAssessments(limit)
  const submitted = (Array.isArray(items) ? items : []).filter(isAssessmentSubmitted)
  const latest = submitted[0]
  if (!latest?.id || !userReportReady(latest)) return null
  return fetchAssessment(latest.id)
}
