'use client'

import { usePathname } from '../i18n/navigation'
import { hasSiteNavbar } from '../utils/routes'
import { SiteNavbar } from './SiteNavbar'
import Settings from './Settings'
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
    settingsOpen,
    setSettingsOpen,
    logoutConfirmOpen,
    setLogoutConfirmOpen,
    reportModalOpen,
    handleLogo,
    openDashboard,
    openHistory,
    openBilling,
    openAuth,
    logout,
    startNewAnalysis,
    closeReportModal,
  } = useApp()

  const showNavbar = hasSiteNavbar(pathname) && authReady && !!user

  return (
    <div className="relative min-h-screen overflow-x-hidden font-sans">
      {showNavbar && (
        <SiteNavbar
          pathname={pathname}
          authReady={authReady}
          accessReady={accessReady}
          hasAnalysisAccess={hasAnalysisAccess}
          onLogo={handleLogo}
          onDashboard={openDashboard}
          onHistory={openHistory}
          onBilling={openBilling}
          onSettings={() => setSettingsOpen(true)}
          onAuth={openAuth}
          onLogout={() => setLogoutConfirmOpen(true)}
          user={user}
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
      <Settings open={settingsOpen} onClose={() => setSettingsOpen(false)} />
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
        user={user}
        onRestart={startNewAnalysis}
      />
      {children}
    </div>
  )
}
