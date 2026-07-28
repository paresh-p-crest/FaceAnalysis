'use client'

import { useEffect } from 'react'
import { useLocale } from 'next-intl'
import { useRouter } from '../../i18n/navigation'
import { dashboardPathForUser, ROUTES } from '../../utils/routes'
import { useApp } from '../../components/providers/AppProvider'
import { AppBootScreen } from '../../components/AppBootScreen'

export default function HomePage() {
  const router = useRouter()
  const locale = useLocale()
  const { user, authReady } = useApp()

  useEffect(() => {
    if (!authReady) return
    router.replace(user ? dashboardPathForUser(user) : ROUTES.auth, { locale })
  }, [authReady, user, router, locale])

  return <AppBootScreen withNavbarOffset={false} />
}
