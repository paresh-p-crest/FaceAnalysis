'use client'

import { Calendar, Zap, RefreshCw, ScanFace } from 'lucide-react'
import { useTranslations } from 'next-intl'

/**
 * Static "analysis preparing" timeline. Live pipeline status stays admin-only.
 * Fits one viewport (no page scroll) — home variant clears the site navbar.
 */
const PREPARING_TIMELINE = [
  { id: 'cv', days: 5 },
  { id: 'assessment', days: 8 },
  { id: 'protocol', days: 4 },
  { id: 'review', days: 5 },
  { id: 'finalise', days: 6 },
]

const DEFAULT_TOTAL_DAYS = PREPARING_TIMELINE.reduce((sum, stage) => sum + stage.days, 0)

export default function AnalysisPreparing({
  photo,
  onGoToDashboard,
  createdAt = null,
  daysLeft = null,
  totalDays = DEFAULT_TOTAL_DAYS,
  variant = 'postSubmit',
  onRefresh = null,
}) {
  const t = useTranslations('Analysis.preparing')
  const isHome = variant === 'home'
  const remaining =
    typeof daysLeft === 'number' && Number.isFinite(daysLeft)
      ? Math.max(0, daysLeft)
      : totalDays

  const elapsed = Math.max(0, totalDays - remaining)
  let cursor = 0
  const stages = PREPARING_TIMELINE.map((stage) => {
    const start = cursor
    cursor += stage.days
    const done = elapsed >= cursor
    const active = !done && elapsed >= start
    return { ...stage, done, active }
  })

  return (
    <div
      className={`bg-surface overflow-hidden flex flex-col ${isHome ? '' : 'min-h-dvh'}`}
      style={
        isHome
          ? {
              height: '100dvh',
              paddingTop: 'var(--site-navbar-offset)',
            }
          : undefined
      }
    >
      <div className="flex-1 min-h-0 w-full max-w-lg mx-auto px-4 py-3 sm:py-4 flex flex-col justify-center gap-3">
        <header className="flex flex-col items-center text-center shrink-0">
          <div className="w-10 h-10 rounded-full border-2 border-brand/30 bg-brand/5 flex items-center justify-center mb-2.5">
            {photo ? (
              <img src={photo} alt="" className="w-8 h-8 rounded-full object-cover" />
            ) : (
              <ScanFace className="w-5 h-5 text-brand" />
            )}
          </div>
          <h1 className="font-display text-xl sm:text-2xl font-bold text-ink leading-tight">
            {t.rich('title', {
              highlight: (chunks) => <span className="text-brand">{chunks}</span>,
            })}
          </h1>
          <p className="mt-1.5 text-xs sm:text-sm text-ink-muted leading-snug max-w-sm">
            {isHome ? t('homeDescription') : t('description')}
          </p>
          {isHome && createdAt && (
            <p className="mt-1 text-[11px] text-ink-muted">
              {t('submittedOn', { date: new Date(createdAt).toLocaleDateString() })}
            </p>
          )}
        </header>

        <div className="rounded-2xl border border-surface-border bg-white dark:bg-surface-card shadow-soft p-3 shrink-0">
          <div className="rounded-xl bg-surface-warm dark:bg-surface-raised divide-y divide-surface-border">
            {stages.map((stage) => (
              <div key={stage.id} className="flex items-center justify-between gap-2 px-3 py-2">
                <span
                  className={`text-xs sm:text-sm font-medium truncate ${
                    stage.done
                      ? 'text-brand'
                      : stage.active
                        ? 'text-ink'
                        : 'text-ink-secondary'
                  }`}
                >
                  {t(`timeline.${stage.id}`)}
                  {stage.done ? (
                    <span className="ml-1.5 text-[9px] font-bold uppercase tracking-wide text-brand">
                      {t('stageDone')}
                    </span>
                  ) : null}
                  {stage.active ? (
                    <span className="ml-1.5 text-[9px] font-bold uppercase tracking-wide text-amber-600">
                      {t('stageActive')}
                    </span>
                  ) : null}
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wide text-ink-muted shrink-0">
                  {t('days', { count: stage.days })}
                </span>
              </div>
            ))}
          </div>

          <div className="flex justify-end mt-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-brand/10 text-brand px-2.5 py-1 text-[11px] font-bold">
              <Calendar className="w-3 h-3" />
              {remaining === 0 ? t('almostReady') : t('daysLeft', { count: remaining })}
            </span>
          </div>
        </div>

        <div className="rounded-2xl px-3.5 py-3 bg-gradient-to-br from-[#0d1e1f] via-[#0e2a29] to-[#04090a] text-white shadow-soft shrink-0">
          <div className="flex items-start gap-2.5">
            <div className="w-8 h-8 shrink-0 rounded-lg bg-brand/20 flex items-center justify-center">
              <Zap className="w-3.5 h-3.5 text-brand" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-display text-xs sm:text-sm font-semibold leading-tight">
                {t('expressTitle')}
              </p>
              <p className="text-[11px] text-white/70 leading-snug mt-0.5">
                {t('expressDescription')}
              </p>
              <button
                type="button"
                disabled
                title={t('comingSoon')}
                className="mt-2 inline-flex items-center rounded-full bg-white/10 px-3 py-1.5 text-[10px] font-semibold text-white/80 cursor-not-allowed"
              >
                {t('expressButton')}
              </button>
            </div>
          </div>
        </div>

        {isHome ? (
          onRefresh ? (
            <button
              type="button"
              onClick={onRefresh}
              className="btn-ghost w-full shrink-0 flex items-center justify-center gap-2 min-h-[40px] text-sm"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              {t('refreshStatus')}
            </button>
          ) : null
        ) : onGoToDashboard ? (
          <button
            type="button"
            onClick={onGoToDashboard}
            className="btn-primary w-full shrink-0 flex items-center justify-center gap-2 min-h-[40px] text-sm"
          >
            {t('goHome')}
          </button>
        ) : null}
      </div>
    </div>
  )
}
