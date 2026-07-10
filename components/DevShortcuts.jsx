/**
 * DEV ONLY — remove before production:
 *   1. Delete this file + utils/devConfig.js + utils/devSampleAnswers.js + backend/dev_config.py
 *   2. Remove DevShortcuts import/render from analysis layout
 *   3. Unset NEXT_PUBLIC_DEV_* and DEV_AUTO_APPROVE_REPORTS in .env
 */
import { isDevShortcutsEnabled } from '../utils/devConfig'

export { isDevShortcutsEnabled } from '../utils/devConfig'

export default function DevShortcuts({ onSkipQuestionnaire }) {
  if (!isDevShortcutsEnabled) return null

  return (
    <button
      type="button"
      onClick={onSkipQuestionnaire}
      title="Dev only: fill sample answers and jump to photo upload"
      className="fixed bottom-5 right-5 z-[9999] rounded-full border-2 border-amber-400 bg-amber-500 px-5 py-3 text-sm font-bold uppercase tracking-wide text-slate-900 shadow-lg shadow-amber-500/40 transition hover:bg-amber-400 hover:scale-[1.02] active:scale-[0.98]"
    >
      DEV: Skip → Upload
    </button>
  )
}
