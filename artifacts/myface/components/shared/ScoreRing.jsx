'use client'

import { useTranslations } from 'next-intl'

export default function ScoreRing({ value, max = 100, size = 120, strokeWidth = 8, label, color }) {
  const t = useTranslations('Shared.scoreRing')
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const pct = Math.min(100, Math.max(0, (value / max) * 100))
  const offset = circumference - (pct / 100) * circumference
  const colorClass = color || (pct >= 70 ? 'text-brand' : pct >= 40 ? 'text-amber-500' : 'text-red-400')

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            className="text-surface-border"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className={`${colorClass} transition-all duration-700 ease-out`}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`text-2xl font-display font-bold ${colorClass}`}>{value}</span>
          <span className="text-[10px] text-ink-muted">{t('outOf', { max })}</span>
        </div>
      </div>
      {label && <span className="text-xs font-medium text-ink-secondary">{label}</span>}
    </div>
  )
}
