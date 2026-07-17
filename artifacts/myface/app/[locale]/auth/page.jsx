'use client'

import { useEffect } from 'react'
import { useRouter } from '../../../i18n/navigation'
import AuthForm from '../../../components/AuthForm'
import { AppBootScreen } from '../../../components/AppBootScreen'
import { useApp } from '../../../components/providers/AppProvider'
import { dashboardPathForUser } from '../../../utils/routes'

export default function AuthPage() {
  const router = useRouter()
  const { user, authReady, handleAuthenticated } = useApp()

  useEffect(() => {
    if (!authReady || !user) return
    router.replace(dashboardPathForUser(user))
  }, [authReady, user, router])

  if (!authReady) {
    return <AppBootScreen withNavbarOffset={false} />
  }

  if (user) {
    return <AppBootScreen withNavbarOffset={false} />
  }

  return <AuthForm onAuthenticated={handleAuthenticated} />
}
