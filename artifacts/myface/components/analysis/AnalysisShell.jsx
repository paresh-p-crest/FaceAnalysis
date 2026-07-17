'use client'

import DevShortcuts, { isDevShortcutsEnabled } from '../DevShortcuts'
import { LocaleSwitcher } from '../LocaleSwitcher'
import { useApp } from '../providers/AppProvider'
import { ANALYSIS_STEPS } from '../../utils/routes'

export function AnalysisShell({ children }) {
  const {
    skipQuestionnaireWithSampleData,
    analysisStep,
  } = useApp()

  const showDevShortcuts = isDevShortcutsEnabled && (
    analysisStep === ANALYSIS_STEPS.WELCOME || analysisStep === ANALYSIS_STEPS.QUESTIONNAIRE
  )

  return (
    <div className="relative min-h-screen overflow-x-hidden font-sans">
      <div className="fixed top-3 right-3 z-40">
        <LocaleSwitcher />
      </div>
      {showDevShortcuts && (
        <DevShortcuts onSkipQuestionnaire={skipQuestionnaireWithSampleData} />
      )}
      {children}
    </div>
  )
}
