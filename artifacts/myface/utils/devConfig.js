/**
 * DEV ONLY — remove before production:
 *   1. Delete this file
 *   2. Remove imports from reportWorkflow.js, Report.jsx, DevShortcuts.jsx, PhotoUpload.jsx
 *   3. Unset NEXT_PUBLIC_DEV_* vars in .env
 */

export const isDevShortcutsEnabled = process.env.NEXT_PUBLIC_DEV_SHORTCUTS === 'true'

/** Skips admin review gate — full report + PDF available immediately */
export const isDevAutoApproveEnabled = process.env.NEXT_PUBLIC_DEV_AUTO_APPROVE === 'true'
