'use client'

import { useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import AdminPanelPage from '../../../components/AdminPanelPage'
import { AppBootScreen } from '../../../components/AppBootScreen'
import { useApp } from '../../../components/providers/AppProvider'
import { adminTabFromPath, adminTabToPath } from '../../../utils/adminPanel'
import { ROUTES } from '../../../utils/routes'

export default function DashboardAdminSectionPage() {
  const params = useParams()
  const router = useRouter()
  const { user, authReady, setSettingsOpen, viewCloudAssessment } = useApp()
  const section = String(params.section || '')
  const tab = adminTabFromPath(`/dashboard/${section}`)

  useEffect(() => {
    if (!authReady) return
    if (!tab) {
      router.replace(user?.role === 'admin' ? adminTabToPath('overview') : ROUTES.dashboard)
      return
    }
    if (user && user.role !== 'admin') {
      router.replace(ROUTES.dashboard)
    }
  }, [authReady, tab, user, router])

  if (!authReady || !user) {
    return <AppBootScreen withNavbarOffset />
  }

  if (user.role !== 'admin' || !tab) {
    return <AppBootScreen withNavbarOffset />
  }

  return (
    <AdminPanelPage
      activeTab={tab}
      onSettings={() => setSettingsOpen(true)}
      onViewCloudItem={viewCloudAssessment}
      user={user}
    />
  )
}
