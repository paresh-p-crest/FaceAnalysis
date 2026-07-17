'use client'

import { useEffect } from 'react'
import { useRouter } from '../../../i18n/navigation'
import DashboardPage from '../../../components/DashboardPage'
import { AppBootScreen } from '../../../components/AppBootScreen'
import { useApp } from '../../../components/providers/AppProvider'
import { adminTabToPath } from '../../../utils/adminPanel'

export default function DashboardRoutePage() {
  const router = useRouter()
  const {
    user,
    authReady,
    hasAnalysisAccess,
    accessReady,
    startNewAnalysis,
    openHistory,
    openBilling,
    viewCloudAssessment,
    openingReportId,
  } = useApp()

  useEffect(() => {
    if (!authReady || !user) return
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
    <DashboardPage
      user={user}
      hasAnalysisAccess={hasAnalysisAccess}
      accessReady={accessReady}
      onStartAssessment={startNewAnalysis}
      onHistory={openHistory}
      onBilling={openBilling}
      onViewCloudItem={viewCloudAssessment}
      openingReportId={openingReportId}
    />
  )
}
