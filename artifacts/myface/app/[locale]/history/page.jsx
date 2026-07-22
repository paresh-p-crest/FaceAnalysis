'use client'

import { useEffect } from 'react'
import { useRouter } from '../../../i18n/navigation'
import HistoryPage from '../../../components/HistoryPage'
import { AppBootScreen } from '../../../components/AppBootScreen'
import { useApp } from '../../../components/providers/AppProvider'
import { ROUTES } from '../../../utils/routes'

export default function HistoryRoutePage() {
  const router = useRouter()
  const {
    user,
    authReady,
    accessReady,
    hasAnalysisAccess,
    viewCloudAssessment,
    openingReportId,
    openDashboard,
  } = useApp()

  useEffect(() => {
    if (!authReady) return
    if (!user) {
      router.replace(ROUTES.auth)
      return
    }
    if (!accessReady) return
    if (user.role !== 'admin' && !hasAnalysisAccess) {
      router.replace(ROUTES.dashboard)
    }
  }, [authReady, accessReady, user, hasAnalysisAccess, router])

  if (!authReady || !user || (!accessReady && user.role !== 'admin')) {
    return <AppBootScreen withNavbarOffset />
  }

  if (user.role !== 'admin' && accessReady && !hasAnalysisAccess) {
    return <AppBootScreen withNavbarOffset />
  }

  return (
    <HistoryPage
      onViewCloudItem={viewCloudAssessment}
      openingReportId={openingReportId}
      onOpenAdmin={openDashboard}
      user={user}
    />
  )
}
