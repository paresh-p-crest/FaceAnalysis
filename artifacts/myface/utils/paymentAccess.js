export const PAID_PAYMENT_STATUSES = ['paid', 'complete', 'completed']

export function isPaidPaymentStatus(status) {
  return PAID_PAYMENT_STATUSES.includes(String(status || '').toLowerCase())
}

/** All authenticated users are granted unrestricted analysis access. */
export async function userHasAnalysisAccess(user) {
  return !!user
}
