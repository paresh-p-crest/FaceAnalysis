import { fetchMyAssessments, fetchMyPayments, isBackendApiEnabled } from './apiClient'
import { isAssessmentSubmitted } from './reportWorkflow'

export const PAID_PAYMENT_STATUSES = ['paid', 'complete', 'completed']

export function isPaidPaymentStatus(status) {
  return PAID_PAYMENT_STATUSES.includes(String(status || '').toLowerCase())
}

/** One-time payment unlocks up to two facial analyses per account. */
export async function userHasAnalysisAccess(user) {
  if (!user) return false
  if (user.role === 'admin') return true
  if (!isBackendApiEnabled()) return false

  const payments = await fetchMyPayments(50)
  if (payments.some((payment) => isPaidPaymentStatus(payment.status))) {
    return true
  }

  const assessments = await fetchMyAssessments(20)
  return assessments.some((item) => isAssessmentSubmitted(item))
}
