'use client'

import { useEffect } from 'react'
import { useRouter } from '../../../i18n/navigation'
import PaymentSuccessPage from '../../../components/PaymentSuccessPage'
import { AppBootScreen } from '../../../components/AppBootScreen'
import { useApp } from '../../../components/providers/AppProvider'
import { adminTabToPath } from '../../../utils/adminPanel'
import { ROUTES } from '../../../utils/routes'

export default function PaymentSuccessRoutePage() {
  const router = useRouter()
  const {
    user,
    authReady,
    paymentReturn,
    startAnalysisAfterPayment,
    startStripeCheckout,
    refreshAnalysisAccess,
    grantPaidAccess,
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

  if (!authReady || !user || user.role === 'admin') {
    return <AppBootScreen withNavbarOffset />
  }

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