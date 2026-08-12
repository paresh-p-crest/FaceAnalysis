'use client'

/**
 * Head-direction hint for the active pose.
 * Arrow = direction the subject should turn (their left/right, not camera left/right).
 */
export function PoseDirectionGuide({ poseId, className = '' }) {
  const turn = POSE_TURN[poseId] ?? 'front'

  return (
    <div
      className={`inline-flex items-center justify-center w-14 h-14 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 ${className}`}
      aria-hidden
    >
      <svg viewBox="0 0 48 48" className="w-10 h-10 text-slate-500 dark:text-slate-400">
        <circle cx="24" cy="22" r="10" fill="none" stroke="currentColor" strokeWidth="1.75" />
        <circle cx="24" cy="22" r="1.25" fill="currentColor" />
        {turn === 'front' && (
          <path d="M24 8v4M24 36v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.35" />
        )}
        {turn === 'left' && (
          <path
            d="M10 22h6M12 22l3-3M12 22l3 3"
            stroke="#5e9f8b"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        )}
        {turn === 'right' && (
          <path
            d="M38 22h-6M36 22l-3-3M36 22l-3 3"
            stroke="#5e9f8b"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        )}
        {turn === 'down' && (
          <path
            d="M24 34v6M21 37l3 3 3-3"
            stroke="#5e9f8b"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        )}
        {turn === 'smile' && (
          <path
            d="M18 26q6 5 12 0"
            stroke="#5e9f8b"
            strokeWidth="1.75"
            strokeLinecap="round"
            fill="none"
          />
        )}
      </svg>
    </div>
  )
}

const POSE_TURN = {
  front: 'front',
  smile: 'smile',
  leftProfile: 'left',
  left45: 'left',
  rightProfile: 'right',
  right45: 'right',
  topHead: 'down',
}
