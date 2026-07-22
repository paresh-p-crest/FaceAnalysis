'use client'

import { useEffect } from 'react'
import { useRouter } from '../../../i18n/navigation'
import { AppBootScreen } from '../../../components/AppBootScreen'
import { useApp } from '../../../components/providers/AppProvider'
import { ROUTES } from '../../../utils/routes'

/**
 * `/billing` is deprecated for customers.
 * Stripe return is handled on `/report`; this route always forwards there
 * (session id kept in localStorage so success UI can restore).
 */
export default function BillingRoutePage() {
  const router = useRouter()
  const { authReady, user, paymentReturn } = useApp()

  useEffect(() => {
    if (!authReady) return
    if (!user) {
      router.replace(ROUTES.auth)
      return
    }
    router.replace(ROUTES.dashboard)
  }, [authReady, user, paymentReturn, router])

  return <AppBootScreen withNavbarOffset />
}
