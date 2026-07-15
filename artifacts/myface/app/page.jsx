'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { dashboardPathForUser, ROUTES } from '../utils/routes'
import { useApp } from '../components/providers/AppProvider'
import { AppBootScreen } from '../components/AppBootScreen'

export default function HomePage() {
  const router = useRouter()
  const { user, authReady } = useApp()

  useEffect(() => {
    if (!authReady) return
    router.replace(user ? dashboardPathForUser(user) : ROUTES.analysis)
  }, [authReady, user, router])

  return <AppBootScreen withNavbarOffset={false} />
}
