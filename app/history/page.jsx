'use client'

import HistoryPage from '../../components/HistoryPage'
import { useApp } from '../../components/providers/AppProvider'

export default function HistoryRoutePage() {
  const {
    user,
    viewHistoryItem,
    viewCloudAssessment,
    openDashboard,
  } = useApp()

  return (
    <HistoryPage
      onViewItem={viewHistoryItem}
      onViewCloudItem={viewCloudAssessment}
      onOpenAdmin={openDashboard}
      user={user}
    />
  )
}
