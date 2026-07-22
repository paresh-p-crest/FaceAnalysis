import { isDevAutoApproveEnabled } from './devConfig'

export const REPORT_WORKFLOW_STATUSES = [
  { value: 'pending_review', label: 'Pending Review' },
  { value: 'approved', label: 'Approved' },
]

export function normalizeReportStatus(status) {
  const normalized = String(status || 'pending_review').trim().toLowerCase().replace(/\s+/g, '_')
  if (normalized === 'approved' || normalized === 'published') return 'approved'
  if (normalized === 'draft') return 'draft'
  return 'pending_review'
}

/** True after POST …/submit — not for photo-only drafts still in upload flow. */
export function isAssessmentSubmitted(assessment) {
  if (!assessment) return false
  if (normalizeReportStatus(assessment.status) === 'draft') return false
  const pipeline = assessment?.pipeline
  return !!(pipeline && typeof pipeline === 'object' && pipeline.status)
}

export function formatReportStatusLabel(status) {
  const normalized = String(status || '').trim().toLowerCase().replace(/\s+/g, '_')
  if (normalized === 'processing') return 'Processing'
  if (normalized === 'failed') return 'Failed'
  return normalizeReportStatus(status) === 'approved' ? 'Approved' : 'Pending Review'
}

export function isAssessmentProcessing(assessment) {
  if (!assessment) return false
  if (assessment.processing) return true
  const pipeline = assessment.pipeline
  return pipeline?.status === 'queued' || pipeline?.status === 'running'
}

export function displayStatusForAssessment(assessment) {
  if (isAssessmentProcessing(assessment)) return 'processing'
  if (assessment?.pipeline?.status === 'failed') return 'failed'
  return normalizeReportStatus(assessment?.status)
}

export function isReportApproved(status) {
  return normalizeReportStatus(status) === 'approved'
}

export function canClientViewFullReport(status, isAdmin = false) {
  if (isDevAutoApproveEnabled || isAdmin) return true
  return isReportApproved(status)
}

/**
 * User-facing readiness. Live pipeline/processing/failed state is deliberately
 * hidden from end users (surfaced only to admins); a report is either "Ready"
 * (client can open it) or still "In preparation".
 */
export function userReportReady(assessment) {
  return canClientViewFullReport(assessment?.status)
}

export function userStatusLabel(assessment) {
  return userReportReady(assessment) ? 'Ready' : 'In preparation'
}

export function isReportAwaitingApproval(status) {
  if (isDevAutoApproveEnabled) return false
  return !isReportApproved(status)
}

export function clientAwaitingReviewMessage() {
  return 'Your report will be displayed once our team has reviewed it. PDF download will be enabled after approval.'
}

export function canDownloadReportPdf(status, requiresApproval = true) {
  if (isDevAutoApproveEnabled) return true
  if (!requiresApproval) return true
  return isReportApproved(status)
}

export { isDevAutoApproveEnabled }
