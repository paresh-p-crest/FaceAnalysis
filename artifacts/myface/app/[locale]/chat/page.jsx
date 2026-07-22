'use client'

import { useEffect } from 'react'
import { useRouter } from '../../../i18n/navigation'
import ChatAssistantPage from '../../../components/ChatAssistantPage'
import { AppBootScreen } from '../../../components/AppBootScreen'
import { useApp } from '../../../components/providers/AppProvider'
import { adminTabToPath } from '../../../utils/adminPanel'
import { ROUTES } from '../../../utils/routes'

export default function ChatRoutePage() {
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
    if (user.role === 'admin') {
      router.replace(adminTabToPath('overview'))
      return
    }
    if (accessReady && !hasAnalysisAccess) {
      router.replace(ROUTES.dashboard)
    }
  }, [authReady, accessReady, user, hasAnalysisAccess, router])

  if (!authReady || !user) {
    return <AppBootScreen withNavbarOffset />
  }

  if (user.role === 'admin') {
    return <AppBootScreen withNavbarOffset />
  }

  if (!accessReady) {
    return <AppBootScreen withNavbarOffset />
  }

  if (!hasAnalysisAccess) {
    return <AppBootScreen withNavbarOffset />
  }

  return <ChatAssistantPage onStartAssessment={startNewAnalysis} />
}
