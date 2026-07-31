'use client'

import { useEffect } from 'react'
import { useRouter } from '../../../i18n/navigation'
import { AppBootScreen } from '../../../components/AppBootScreen'
import { useApp } from '../../../components/providers/AppProvider'
import { ROUTES } from '../../../utils/routes'

export default function PaymentSuccessRoutePage() {
  const router = useRouter()
  const { user, authReady } = useApp()

  useEffect(() => {
    if (!authReady) return
    if (!user) {
      router.replace(ROUTES.auth)
      return
    }
    router.replace(ROUTES.dashboard)
  }, [authReady, user, router])

  return <AppBootScreen withNavbarOffset />
}