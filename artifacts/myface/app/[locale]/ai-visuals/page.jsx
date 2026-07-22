'use client'

import { useEffect } from 'react'
import { useRouter } from '../../../i18n/navigation'
import AiVisualsPage from '../../../components/AiVisualsPage'
import { AppBootScreen } from '../../../components/AppBootScreen'
import { useApp } from '../../../components/providers/AppProvider'
import { ROUTES } from '../../../utils/routes'

export default function AiVisualsRoutePage() {
  const router = useRouter()
  const {
    user,
    authReady,
    accessReady,
    hasAnalysisAccess,
    startNewAnalysis,
    closeReportModal,
  } = useApp()

  useEffect(() => {
    closeReportModal?.()
  }, [closeReportModal])

  useEffect(() => {
    if (!authReady) return
    if (!user) {
      router.replace(ROUTES.auth)
      return
    }
    if (user.role !== 'admin' && accessReady && !hasAnalysisAccess) {
      router.replace(ROUTES.dashboard)
    }
  }, [authReady, accessReady, user, hasAnalysisAccess, router])

  if (!authReady || !user) {
    return <AppBootScreen withNavbarOffset />
  }

  if (!accessReady && user.role !== 'admin') {
    return <AppBootScreen withNavbarOffset />
  }

  if (user.role !== 'admin' && accessReady && !hasAnalysisAccess) {
    return <AppBootScreen withNavbarOffset />
  }

  return <AiVisualsPage onStartAssessment={startNewAnalysis} user={user} />
}
