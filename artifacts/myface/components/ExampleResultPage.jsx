'use client'

import { useTranslations } from 'next-intl'
import { ArrowRight, Check, ChevronRight, Sparkles } from 'lucide-react'
import { useRouter } from '../i18n/navigation'
import { ROUTES } from '../utils/routes'
import { BrandLogo } from './BrandLogo'

const METRICS = [
  { key: 'symmetry', score: 87 },
  { key: 'proportions', score: 82 },
  { key: 'skin', score: 78 },
]

export default function ExampleResultPage() {
  const t = useTranslations('ExampleResult')
  const router = useRouter()

  return (
    <main className="example-result min-h-screen bg-surface text-ink">
      <header className="example-result__header">
        <BrandLogo size="lg" />
        <span className="example-result__badge">{t('badge')}</span>
      </header>

      <div className="example-result__shell">
        <section className="example-result__hero">
          <div className="example-result__eyebrow">
            <Sparkles aria-hidden className="h-4 w-4" />
            {t('eyebrow')}
          </div>
          <h1>{t('title')}</h1>
          <p>{t('description')}</p>
        </section>

        <section className="example-result__score-card" aria-label={t('scoreLabel')}>
          <div className="example-result__score-ring">
            <svg viewBox="0 0 120 120" aria-hidden>
              <circle className="example-result__ring-track" cx="60" cy="60" r="50" />
              <circle className="example-result__ring-value" cx="60" cy="60" r="50" />
            </svg>
            <div>
              <strong>82</strong>
              <span>/ 100</span>
            </div>
          </div>
          <div className="example-result__score-copy">
            <span className="example-result__mono">{t('scoreLabel')}</span>
            <h2>{t('scoreTitle')}</h2>
            <p>{t('scoreDescription')}</p>
            <div className="example-result__status">
              <Check aria-hidden className="h-4 w-4" />
              {t('reviewed')}
            </div>
          </div>
        </section>

        <section className="example-result__metrics">
          <div className="example-result__section-heading">
            <div>
              <span className="example-result__mono">{t('metricsEyebrow')}</span>
              <h2>{t('metricsTitle')}</h2>
            </div>
            <span className="example-result__page-count">01 / 04</span>
          </div>
          <div className="example-result__metric-grid">
            {METRICS.map(({ key, score }) => (
              <article className="example-result__metric" key={key}>
                <div className="example-result__metric-top">
                  <span>{t(`metrics.${key}`)}</span>
                  <strong>{score}</strong>
                </div>
                <div className="example-result__bar">
                  <span style={{ width: `${score}%` }} />
                </div>
                <p>{t(`metricDescriptions.${key}`)}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="example-result__detail">
          <div>
            <span className="example-result__mono">{t('detailEyebrow')}</span>
            <h2>{t('detailTitle')}</h2>
            <p>{t('detailDescription')}</p>
          </div>
          <ul>
            {['balance', 'structure', 'skin'].map((key) => (
              <li key={key}>
                <Check aria-hidden className="h-4 w-4" />
                <span>{t(`highlights.${key}`)}</span>
              </li>
            ))}
          </ul>
        </section>

        <button className="example-result__cta" type="button" onClick={() => router.push(ROUTES.auth)}>
          <span>{t('cta')}</span>
          <ArrowRight aria-hidden className="h-5 w-5" />
        </button>

        <button className="example-result__back" type="button" onClick={() => router.push(ROUTES.auth)}>
          {t('backToStart')} <ChevronRight aria-hidden className="h-4 w-4" />
        </button>
      </div>
    </main>
  )
}