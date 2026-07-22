'use client'

import { useEffect } from 'react'
import { useRouter } from '../../../i18n/navigation'
import SettingsPage from '../../../components/SettingsPage'
import { AppBootScreen } from '../../../components/AppBootScreen'
import { useApp } from '../../../components/providers/AppProvider'
import { ROUTES } from '../../../utils/routes'

export default function SettingsRoutePage() {
  const router = useRouter()
  const { user, authReady, updateSessionUser } = useApp()

  useEffect(() => {
    if (!authReady) return
    if (!user) router.replace(ROUTES.auth)
  }, [authReady, user, router])

  if (!authReady || !user) {
    return <AppBootScreen withNavbarOffset />
  }

  return <SettingsPage user={user} onUserUpdated={updateSessionUser} />
}
