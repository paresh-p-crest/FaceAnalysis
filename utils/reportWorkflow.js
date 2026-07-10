import { isDevAutoApproveEnabled } from './devConfig'

export const REPORT_WORKFLOW_STATUSES = [
  { value: 'pending_review', label: 'Pending Review' },
  { value: 'approved', label: 'Approved' },
]

export function normalizeReportStatus(status) {
  const normalized = String(status || 'pending_review').trim().toLowerCase().replace(/\s+/g, '_')
  if (normalized === 'approved' || normalized === 'published') return 'approved'
  return 'pending_review'
}

export function formatReportStatusLabel(status) {
  return normalizeReportStatus(status) === 'approved' ? 'Approved' : 'Pending Review'
}

export function isReportApproved(status) {
  return normalizeReportStatus(status) === 'approved'
}

export function canClientViewFullReport(status, isAdmin = false) {
  if (isDevAutoApproveEnabled || isAdmin) return true
  return isReportApproved(status)
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
