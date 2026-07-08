export const REPORT_WORKFLOW_STATUSES = [

  { value: 'pending_review', label: 'Pending review' },

  { value: 'approved', label: 'Approved' },

]



export function normalizeReportStatus(status) {

  const normalized = String(status || 'pending_review').toLowerCase()

  if (normalized === 'approved' || normalized === 'published') return 'approved'

  return 'pending_review'

}



export function isReportApproved(status) {

  return normalizeReportStatus(status) === 'approved'

}



export function canClientViewFullReport(status, isAdmin = false) {

  if (isAdmin) return true

  return isReportApproved(status)

}



export function isReportAwaitingApproval(status) {

  return !isReportApproved(status)

}



export function clientAwaitingReviewMessage() {

  return 'Your report will be displayed once our team has reviewed it. PDF download will be enabled after approval.'

}



export function canDownloadReportPdf(status, requiresApproval = true) {

  if (!requiresApproval) return true

  return isReportApproved(status)

}

