'use client'

import { useEffect } from 'react'
import { useRouter } from '../../../i18n/navigation'
import CustomerHome from '../../../components/CustomerHome'
import { AppBootScreen } from '../../../components/AppBootScreen'
import { useApp } from '../../../components/providers/AppProvider'
import { adminTabToPath } from '../../../utils/adminPanel'
import { ROUTES } from '../../../utils/routes'

/**
 * Full protocol report — `/report` opens the report modal (all sections).
 */
export default function ReportHomePage() {
  const router = useRouter()
  const {
    user,
    authReady,
    hasAnalysisAccess,
    accessReady,
    startNewAnalysis,
    resumeDraftAnalysis,
    startStripeCheckout,
    billingMessage,
    viewCloudAssessment,
    openingReportId,
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

  return (
    <CustomerHome
      user={user}
      hasAnalysisAccess={hasAnalysisAccess}
      accessReady={accessReady}
      onStartAssessment={startNewAnalysis}
      onResumeDraft={resumeDraftAnalysis}
      onStartCheckout={startStripeCheckout}
      billingMessage={billingMessage}
      onViewCloudItem={viewCloudAssessment}
      openingReportId={openingReportId}
    />
  )
}
