/** Local in-progress analysis questionnaire draft (answers + step). Cleared on submit / start-new / logout. */

const KEY_PREFIX = 'myface_analysis_draft_'

function storageKey(userId) {
  return `${KEY_PREFIX}${userId}`
}

export function loadAnalysisDraft(userId) {
  if (!userId || typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(storageKey(userId))
    if (!raw) return null
    const draft = JSON.parse(raw)
    if (!draft || typeof draft !== 'object' || draft.answers == null || typeof draft.answers !== 'object') {
      return null
    }
    return draft
  } catch {
    return null
  }
}

export function saveAnalysisDraft(userId, draft) {
  if (!userId || typeof window === 'undefined' || !draft?.answers) return
  try {
    localStorage.setItem(
      storageKey(userId),
      JSON.stringify({
        answers: draft.answers,
        analysisStep: draft.analysisStep || null,
        scanId: draft.scanId || null,
        updatedAt: Date.now(),
      }),
    )
  } catch {
    // quota / private mode — ignore
  }
}

export function clearAnalysisDraft(userId) {
  if (!userId || typeof window === 'undefined') return
  try {
    localStorage.removeItem(storageKey(userId))
  } catch {
    // ignore
  }
}

/** True when any questionnaire field differs from the empty template. */
export function answersHaveProgress(answers, initialAnswers) {
  if (!answers || !initialAnswers) return false
  for (const key of Object.keys(initialAnswers)) {
    const cur = answers[key]
    const init = initialAnswers[key]
    if (Array.isArray(init)) {
      if (Array.isArray(cur) && cur.length > 0) return true
      continue
    }
    if (cur != null && String(cur).trim() !== '' && cur !== init) return true
  }
  return false
}
