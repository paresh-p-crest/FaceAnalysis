import { fetchMyAssessments, fetchMyPayments, isBackendApiEnabled } from './apiClient'

export const PAID_PAYMENT_STATUSES = ['paid', 'complete', 'completed']

export function isPaidPaymentStatus(status) {
  return PAID_PAYMENT_STATUSES.includes(String(status || '').toLowerCase())
}

/** One-time payment unlocks repeat facial analysis for this account. */
export async function userHasAnalysisAccess(user) {
  if (!user) return false
  if (user.role === 'admin') return true
  if (!isBackendApiEnabled()) return false

  const payments = await fetchMyPayments(50)
  if (payments.some((payment) => isPaidPaymentStatus(payment.status))) {
    return true
  }

  const assessments = await fetchMyAssessments(1)
  return assessments.length > 0
}
