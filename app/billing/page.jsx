'use client'

import BillingPage from '../../components/BillingPage'
import PaymentSuccessPage from '../../components/PaymentSuccessPage'
import { useApp } from '../../components/providers/AppProvider'

export default function BillingRoutePage() {
  const {
    user,
    billingMessage,
    paymentReturn,
    setAuthOpen,
    startAnalysisAfterPayment,
    openBilling,
  } = useApp()

  if (paymentReturn) {
    return (
      <PaymentSuccessPage
        user={user}
        sessionId={paymentReturn?.sessionId}
        onAuth={() => setAuthOpen(true)}
        onStartAnalysis={startAnalysisAfterPayment}
        onBilling={openBilling}
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
