'use client'

import { usePathname } from 'next/navigation'
import { hasSiteNavbar, ROUTES } from '../utils/routes'
import { SiteNavbar } from './SiteNavbar'
import Settings from './Settings'
import AuthModal from './AuthModal'
import ConfirmDialog from './ConfirmDialog'
import { ReportModal } from './report/ReportModal'
import { useApp } from './providers/AppProvider'

export function AppShell({ children, authRequired = false }) {
  const pathname = usePathname()
  const {
    user,
    authReady,
    photos,
    answers,
    analysis,
    historyId,
    primaryPhoto,
    settingsOpen,
    setSettingsOpen,
    authOpen,
    setAuthOpen,
    logoutConfirmOpen,
    setLogoutConfirmOpen,
    reportModalOpen,
    handleLogo,
    openDashboard,
    openHistory,
    openBilling,
    logout,
    handleAuthenticated,
    closeReportModal,
    startNewAnalysis,
    handleRetryLocal,
  } = useApp()

  const showNavbar = hasSiteNavbar(pathname) && authReady && !!user

  return (
    <div className="relative min-h-screen overflow-x-hidden font-sans">
      {showNavbar && (
        <SiteNavbar
          pathname={pathname}
          authReady={authReady}
          onLogo={handleLogo}
          onDashboard={openDashboard}
          onHistory={openHistory}
          onBilling={openBilling}
          onSettings={() => setSettingsOpen(true)}
          onAuth={() => setAuthOpen(true)}
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
      <AuthModal
        open={authOpen}
        required={authRequired}
        onClose={() => setAuthOpen(false)}
        onAuthenticated={handleAuthenticated}
      />
      <ReportModal
        open={reportModalOpen}
        onClose={closeReportModal}
        photo={primaryPhoto}
        photos={photos}
        answers={answers}
        analysis={analysis}
        historyId={historyId}
        user={user}
        onRestart={startNewAnalysis}
        onRetryLocal={handleRetryLocal}
      />
      {children}
    </div>
  )
}
