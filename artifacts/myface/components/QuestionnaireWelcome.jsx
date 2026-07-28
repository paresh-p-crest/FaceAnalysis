'use client'

import { useTranslations } from 'next-intl'
import { AnalysisFlowHeader } from './analysis/AnalysisFlowHeader'
import { BrandLogo } from './BrandLogo'
import './Questionnaire.css'

export default function QuestionnaireWelcome({ onBegin, onBackToDashboard }) {
  const t = useTranslations('Questionnaire.welcome')

  const STATS = [
    { value: '170+', label: t('statsLandmarks') },
    { value: '20+', label: t('statsDuration') },
    { value: '100 %', label: t('statsPersonalized') },
  ]

  return (
    <div className="questionnaire-welcome min-h-screen flex bg-surface-card dark:bg-surface animate-fade-up">
      {/* Left Column: Fluid Wavy Mesh Gradient (Forced Dark Background) */}
      <div className="hidden lg:flex lg:w-[60%] bg-[#071c18] fluid-gradient-mesh flex-col justify-between p-16 relative">
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

      {/* Right Column: Welcome */}
      <div className="questionnaire-welcome__main w-full lg:w-[40%] flex flex-col min-h-screen lg:min-h-0 bg-surface-card dark:bg-surface border-l border-surface-border p-6 sm:p-16">
        <AnalysisFlowHeader
          className="questionnaire-welcome__header"
          leading={<BrandLogo size="lg" className="questionnaire-welcome__mobile-logo" />}
          backLabel={onBackToDashboard ? t('backToDashboard') : null}
          onBack={onBackToDashboard}
          backClassName="questionnaire-welcome__back"
        />

        <div className="questionnaire-welcome__content analysis-split-content">
          <div className="questionnaire-welcome__body">
            <div className="questionnaire-welcome__intro">
              {onBackToDashboard && (
                <button
                  type="button"
                  onClick={onBackToDashboard}
                  className="questionnaire-welcome__mobile-back mb-7"
                >
                  {t('backToDashboard')}
                </button>
              )}
              <h1 className="questionnaire-welcome__title">
                {t('title')}
              </h1>
              <p className="questionnaire-welcome__body-text text-ink-muted">
                {t('description')}
              </p>
            </div>

            <div className="questionnaire-welcome__stats">
              {STATS.map((stat) => (
                <div key={stat.label} className="questionnaire-welcome__stat">
                  <div className="text-xl font-bold text-ink">{stat.value}</div>
                  <div className="questionnaire-welcome__stat-label text-[10px] text-ink-muted mt-1 uppercase font-medium tracking-wider">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="questionnaire-welcome__action">
            <button onClick={onBegin} className="btn-primary w-full flex items-center px-6 py-4 text-sm">
              <span className="flex-1 text-left">{t('getStarted')}</span>
              <span className="text-white/40 mr-4">|</span>
              <span>→</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
