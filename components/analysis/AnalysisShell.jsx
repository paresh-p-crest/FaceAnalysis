'use client'

import AuthModal from '../AuthModal'
import DevShortcuts, { isDevShortcutsEnabled } from '../DevShortcuts'
import { useApp } from '../providers/AppProvider'
import { ANALYSIS_STEPS } from '../../utils/routes'

export function AnalysisShell({ children, authRequired = false }) {
  const {
    authOpen,
    setAuthOpen,
    handleAuthenticated,
    skipQuestionnaireWithSampleData,
    analysisStep,
  } = useApp()

  const showDevShortcuts = isDevShortcutsEnabled && (
    analysisStep === ANALYSIS_STEPS.WELCOME || analysisStep === ANALYSIS_STEPS.QUESTIONNAIRE
  )

  return (
    <div className="relative min-h-screen overflow-x-hidden font-sans">
      <AuthModal
        open={authOpen}
        required={authRequired}
        onClose={() => setAuthOpen(false)}
        onAuthenticated={handleAuthenticated}
      />
      {showDevShortcuts && (
        <DevShortcuts onSkipQuestionnaire={skipQuestionnaireWithSampleData} />
      )}
      {children}
    </div>
  )
}
