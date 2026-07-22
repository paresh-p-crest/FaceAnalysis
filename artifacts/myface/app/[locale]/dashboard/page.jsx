'use client'

import { useEffect } from 'react'
import { useRouter } from '../../../i18n/navigation'
import CustomerOverviewDashboard from '../../../components/CustomerOverviewDashboard'
import PaymentSuccessPage from '../../../components/PaymentSuccessPage'
import { AppBootScreen } from '../../../components/AppBootScreen'
import { useApp } from '../../../components/providers/AppProvider'
import { adminTabToPath } from '../../../utils/adminPanel'
import { ROUTES } from '../../../utils/routes'

/**
 * Customer home — `/dashboard` (protocol overview).
 * Admins redirect to `/dashboard/admin-overview`. Stripe return lands here too.
 */
export default function DashboardRoutePage() {
  const router = useRouter()
  const {
    user,
    authReady,
    hasAnalysisAccess,
    accessReady,
    startNewAnalysis,
    resumeDraftAnalysis,
    startStripeCheckout,
    startAnalysisAfterPayment,
    billingMessage,
    paymentReturn,
    grantPaidAccess,
    refreshAnalysisAccess,
    openAuth,
  } = useApp()

  useEffect(() => {
    if (!authReady) return
    if (!user) {
      router.replace(ROUTES.auth)
      return
    }
    if (user.role === 'admin') {
      router.replace(adminTabToPath('overview'))
    }
  }, [authReady, user, router])

  if (!authReady || !user) {
    return <AppBootScreen withNavbarOffset />
  }

  if (user.role === 'admin') {
    return <AppBootScreen withNavbarOffset />
  }

  if (paymentReturn) {
    return (
      <PaymentSuccessPage
        user={user}
        sessionId={paymentReturn?.sessionId}
        onAuth={openAuth}
        onStartAnalysis={startAnalysisAfterPayment}
        onRetryCheckout={startStripeCheckout}
        onAccessRefresh={refreshAnalysisAccess}
        onPaymentConfirmed={grantPaidAccess}
      />
    )
  }

  if (!accessReady) {
    return <AppBootScreen withNavbarOffset />
  }

  return (
    <CustomerOverviewDashboard
      user={user}
      hasAnalysisAccess={hasAnalysisAccess}
      accessReady={accessReady}
      onStartAssessment={startNewAnalysis}
      onResumeDraft={resumeDraftAnalysis}
      onStartCheckout={startStripeCheckout}
      billingMessage={billingMessage}
    />
  )
}
