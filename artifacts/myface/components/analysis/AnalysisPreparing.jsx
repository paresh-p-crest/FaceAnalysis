'use client'

import { Calendar, Zap, LayoutDashboard, ScanFace } from 'lucide-react'
import { useTranslations } from 'next-intl'

/**
 * Static "analysis preparing" timeline shown right after submit. The live pipeline
 * status is intentionally hidden from users (surfaced only on the admin side); this
 * page communicates a friendly, fixed set of stage estimates instead.
 */
const PREPARING_TIMELINE = [
  { id: 'cv', days: 5 },
  { id: 'assessment', days: 8 },
  { id: 'protocol', days: 4 },
  { id: 'review', days: 5 },
  { id: 'finalise', days: 6 },
]

const TOTAL_DAYS = PREPARING_TIMELINE.reduce((sum, stage) => sum + stage.days, 0)

export default function AnalysisPreparing({ photo, onGoToDashboard }) {
  const t = useTranslations('Analysis.preparing')

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-surface">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-14 h-14 rounded-full border-2 border-brand/30 bg-brand/5 flex items-center justify-center mb-5">
            {photo ? (
              <img src={photo} alt="" className="w-12 h-12 rounded-full object-cover" />
            ) : (
              <ScanFace className="w-6 h-6 text-brand" />
            )}
          </div>
          <h1 className="font-display text-2xl font-bold text-ink mb-2">
            {t.rich('title', {
              highlight: () => <span className="text-brand">{t('titleHighlight')}</span>,
            })}
          </h1>
          <p className="text-sm text-ink-muted leading-relaxed max-w-sm">
            {t('description')}
          </p>
        </div>

        {/* Timeline card */}
        <div className="rounded-3xl border border-surface-border bg-white dark:bg-surface-card shadow-elevated p-4 sm:p-5">
          <div className="rounded-2xl bg-surface-warm dark:bg-surface-raised divide-y divide-surface-border">
            {PREPARING_TIMELINE.map((stage) => (
              <div key={stage.id} className="flex items-center justify-between px-4 py-3.5">
                <span className="text-sm font-medium text-ink-secondary">{t(`timeline.${stage.id}`)}</span>
                <span className="text-[11px] font-bold uppercase tracking-wide text-ink-muted">
                  {t('days', { count: stage.days })}
                </span>
              </div>
            ))}
          </div>

          <div className="flex justify-end mt-3">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-brand/10 text-brand px-3 py-1.5 text-xs font-bold">
              <Calendar className="w-3.5 h-3.5" />
              {t('daysLeft', { count: TOTAL_DAYS })}
            </span>
          </div>
        </div>

        {/* Non-functional upsell placeholder */}
        <div className="mt-5 rounded-3xl p-5 bg-gradient-to-br from-[#0d1e1f] via-[#0e2a29] to-[#04090a] text-white shadow-elevated">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 shrink-0 rounded-xl bg-brand/20 flex items-center justify-center">
              <Zap className="w-4 h-4 text-brand" />
            </div>
            <div className="min-w-0">
              <p className="font-display text-sm font-semibold">{t('expressTitle')}</p>
              <p className="text-xs text-white/70 leading-relaxed mt-0.5">
                {t('expressDescription')}
              </p>
              <button
                type="button"
                disabled
                title={t('comingSoon')}
                className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-4 py-2 text-xs font-semibold text-white/80 cursor-not-allowed"
              >
                {t('expressButton')}
              </button>
            </div>
          </div>
        </div>

        {/* CTA */}
        <button
          type="button"
          onClick={onGoToDashboard}
          className="btn-primary w-full mt-6 flex items-center justify-center gap-2"
        >
          <LayoutDashboard className="w-4 h-4" />
          {t('goToDashboard')}
        </button>
      </div>
    </div>
  )
}
