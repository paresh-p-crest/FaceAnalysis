'use client'

import { Fingerprint, Clock, Scan } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { BrandLogo } from './BrandLogo'

export default function QuestionnaireWelcome({ onBegin, onBackToDashboard }) {
  const t = useTranslations('Questionnaire.welcome')

  const STATS = [
    { icon: Fingerprint, value: '468+', label: t('statsLandmarks') },
    { icon: Clock, value: '5 min', label: t('statsDuration') },
    { icon: Scan, value: '100%', label: t('statsPersonalized') },
  ]

  return (
    <div className="min-h-screen flex bg-surface-card dark:bg-surface animate-fade-up">
      {/* Left Column: Welcome */}
      <div className="w-full lg:w-[40%] flex flex-col justify-between p-6 sm:p-16 bg-surface-card dark:bg-surface border-r border-surface-border">
        <div className="flex items-center justify-between">
          {onBackToDashboard ? (
            <button
              type="button"
              onClick={onBackToDashboard}
              className="flex items-center gap-1 text-xs font-semibold text-ink-muted hover:text-ink transition-colors uppercase tracking-wider"
            >
              {t('backToDashboard')}
            </button>
          ) : (
            <span aria-hidden className="w-px h-px" />
          )}
        </div>

        {/* Content */}
        <div className="my-auto py-12 max-w-lg space-y-8">
          <div>
            <h1 className="font-display text-3xl sm:text-4xl font-bold text-ink leading-tight tracking-tight">
              {t('title')}
            </h1>
            <p className="text-ink-muted text-sm leading-relaxed mt-4">
              {t('description')}
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {STATS.map((stat) => (
              <div key={stat.label} className="p-4 rounded-xl border border-surface-border bg-surface-warm/50 dark:bg-surface-raised/50 text-center">
                <stat.icon className="w-5 h-5 text-brand mx-auto mb-2" />
                <div className="text-xl font-bold text-ink">{stat.value}</div>
                <div className="text-[10px] text-ink-muted mt-1 uppercase font-medium tracking-wider">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Start Button */}
        <div>
          <button onClick={onBegin} className="btn-primary w-full flex items-center px-6 py-4 text-sm">
            <span className="flex-1 text-left">{t('getStarted')}</span>
            <span className="text-white/40 mr-4">|</span>
            <span>→</span>
          </button>
          <p className="text-[11px] text-ink-muted text-center mt-3">
            {t('durationHint')}
          </p>
        </div>
      </div>

      {/* Right Column: Fluid Wavy Mesh Gradient (Forced Dark Background) */}
      <div className="hidden lg:flex lg:w-[60%] bg-[#0d1e1f] fluid-gradient-mesh flex-col justify-between p-16 relative">
        <div className="relative z-10">
          <BrandLogo size="xl" invert />
        </div>

        <div className="space-y-6 max-w-xl text-left relative z-10">
          <div className="inline-block px-3 py-1 rounded-full border border-white/20 text-white/80 text-[10px] uppercase tracking-wider bg-white/5 backdrop-blur-md">
            {t('sidebarBadge')}
          </div>
          <h1 className="font-display text-5xl font-bold text-white tracking-tight leading-tight whitespace-pre-line">
            {t('sidebarTitle')}
          </h1>
          <p className="text-sm text-slate-300 leading-relaxed max-w-md">
            {t('sidebarDescription')}
          </p>
        </div>
      </div>
    </div>
  )
}
