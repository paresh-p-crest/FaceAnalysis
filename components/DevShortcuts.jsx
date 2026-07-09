/**
 * DEV ONLY — remove before production:
 *   1. Delete this file + utils/devSampleAnswers.js
 *   2. Remove DevShortcuts import/render from App.jsx
 *   3. Unset NEXT_PUBLIC_DEV_SHORTCUTS in .env
 */
import { STAGES } from '../utils/constants'

export const isDevShortcutsEnabled = process.env.NEXT_PUBLIC_DEV_SHORTCUTS === 'true'

const VISIBLE_STAGES = new Set([STAGES.LANDING, STAGES.QUESTIONNAIRE])

export default function DevShortcuts({ stage, onSkipQuestionnaire }) {
  if (!isDevShortcutsEnabled || !VISIBLE_STAGES.has(stage)) return null

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
