'use client'

import { useEffect } from 'react'
import { usePathname } from '../i18n/navigation'
import { hasSiteNavbar } from '../utils/routes'
import { normalizeReportStatus } from '../utils/reportWorkflow'
import { SiteNavbar } from './SiteNavbar'
import ConfirmDialog from './ConfirmDialog'
import { ReportModal } from './report/ReportModal'
import { useApp } from './providers/AppProvider'

export function AppShell({ children }) {
  const pathname = usePathname()
  const {
    user,
    authReady,
    accessReady,
    hasAnalysisAccess,
    photos,
    answers,
    analysis,
    historyId,
    cloudAssessment,
    setCloudAssessment,
    primaryPhoto,
    logoutConfirmOpen,
    setLogoutConfirmOpen,
    reportModalOpen,
    reportSectionId,
    setReportSectionId,
    reportToolbar,
    handleLogo,
    openAuth,
    logout,
    startNewAnalysis,
    closeReportModal,
    adminWorkspace,
    loadAdminTab,
  } = useApp()

  useEffect(() => {
    if (user?.role === 'admin') {
      loadAdminTab('overview')
    }
  }, [user?.role, loadAdminTab])

  const showNavbar = hasSiteNavbar(pathname) && authReady && !!user

  const adminNavBadges = (() => {
    if (user?.role !== 'admin') return undefined
    const pendingReview = adminWorkspace.assessments.filter(
      (item) => normalizeReportStatus(item.status) === 'pending_review',
    ).length
    const clientUsers = adminWorkspace.users.filter((item) => item.role !== 'admin').length
    return { review: pendingReview, users: clientUsers }
  })()

  return (
    <div className="relative min-h-screen overflow-x-hidden font-sans">
      {showNavbar && (
        <SiteNavbar
          pathname={pathname}
          authReady={authReady}
          accessReady={accessReady}
          hasAnalysisAccess={hasAnalysisAccess}
          onLogo={handleLogo}
          reportModalOpen={reportModalOpen}
          reportToolbar={reportToolbar}
          onAuth={openAuth}
          onLogout={() => setLogoutConfirmOpen(true)}
          user={user}
          adminNavBadges={adminNavBadges}
        />
      )}
      <ConfirmDialog
        open={logoutConfirmOpen}
        title="Sign out?"
        message="You will need to sign in again to access your reports, billing, and admin tools."
        confirmLabel="Sign out"
        danger
        onConfirm={logout}
        onCancel={() => setLogoutConfirmOpen(false)}
      />
      {children}
      <ReportModal
        open={reportModalOpen}
        onClose={closeReportModal}
        withNavbarOffset={showNavbar}
        photo={primaryPhoto}
        photos={photos}
        answers={answers}
        analysis={analysis}
        historyId={historyId}
        cloudAssessment={cloudAssessment}
        onCloudAssessmentChange={setCloudAssessment}
        sectionId={reportSectionId}
        onSectionChange={setReportSectionId}
        user={user}
        onRestart={startNewAnalysis}
      />
    </div>
  )
}
