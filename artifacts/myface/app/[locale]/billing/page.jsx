'use client'

import BillingPage from '../../../components/BillingPage'
import PaymentSuccessPage from '../../../components/PaymentSuccessPage'
import { useApp } from '../../../components/providers/AppProvider'

export default function BillingRoutePage() {
  const {
    user,
    billingMessage,
    paymentReturn,
    openAuth,
    startAnalysisAfterPayment,
    openBilling,
    refreshAnalysisAccess,
  } = useApp()

  if (paymentReturn) {
    return (
      <PaymentSuccessPage
        user={user}
        sessionId={paymentReturn?.sessionId}
        onAuth={openAuth}
        onStartAnalysis={startAnalysisAfterPayment}
        onBilling={openBilling}
        onAccessRefresh={refreshAnalysisAccess}
      />
    )
  }

  return (
    <BillingPage
      message={billingMessage}
      user={user}
    />
  )
}
