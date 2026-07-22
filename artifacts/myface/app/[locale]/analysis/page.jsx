'use client'

import { useEffect } from 'react'
import { useRouter } from '../../../i18n/navigation'
import { AnalysisFlow } from '../../../components/analysis/AnalysisFlow'
import { AppBootScreen } from '../../../components/AppBootScreen'
import { useApp } from '../../../components/providers/AppProvider'
import { ROUTES } from '../../../utils/routes'

export default function AnalysisPage() {
  const router = useRouter()
  const { user, authReady } = useApp()

  useEffect(() => {
    if (!authReady) return
    if (!user) {
      router.replace(ROUTES.auth)
    }
  }, [authReady, user, router])

  if (!authReady || !user) {
    return <AppBootScreen withNavbarOffset />
  }

  return <AnalysisFlow />
}
