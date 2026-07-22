import { isAssessmentSubmitted } from './reportWorkflow'

export const MAX_SUBMITTED_ASSESSMENTS_PER_PACKAGE = 2

export function countSubmittedAssessments(assessments) {
  const list = Array.isArray(assessments) ? assessments : []
  return list.filter(isAssessmentSubmitted).length
}

/** Customer analysis flow only — admins use admin tooling, not /analysis. */
export function canStartNewAssessment({ user, submittedCount }) {
  if (!user || user.role === 'admin') return false
  return submittedCount < MAX_SUBMITTED_ASSESSMENTS_PER_PACKAGE
}

export function isAnalysisLimitReached({ user, submittedCount }) {
  if (!user || user.role === 'admin') return false
  return submittedCount >= MAX_SUBMITTED_ASSESSMENTS_PER_PACKAGE
}
