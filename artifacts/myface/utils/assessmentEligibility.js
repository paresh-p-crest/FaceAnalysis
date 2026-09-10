import { isAssessmentSubmitted } from './reportWorkflow'
import { userMaxAnalysisSlots } from './entitlements'

/** @deprecated Prefer analysisLimitForUser(user). Historical global fallback was 2. */
export const MAX_SUBMITTED_ASSESSMENTS_PER_PACKAGE = 2

export function countSubmittedAssessments(assessments) {
  const list = Array.isArray(assessments) ? assessments : []
  return list.filter(isAssessmentSubmitted).length
}

export function analysisLimitForUser(user) {
  return userMaxAnalysisSlots(user)
}

/** Customer analysis flow only — admins use admin tooling, not /analysis. */
export function canStartNewAssessment({ user, submittedCount }) {
  if (!user || user.role === 'admin') return false
  return submittedCount < userMaxAnalysisSlots(user)
}

export function isAnalysisLimitReached({ user, submittedCount }) {
  if (!user || user.role === 'admin') return false
  return submittedCount >= userMaxAnalysisSlots(user)
}
