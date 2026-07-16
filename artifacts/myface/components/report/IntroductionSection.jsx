'use client'

import { useTranslations } from 'next-intl'
import { INTRODUCTION_PARAGRAPH_KEYS } from '../../utils/qovesProtocolModel'
import { ReportSectionHeading } from './ReportSectionHeading'

const WHAT_TO_EXPECT_KEYS = [
  { titleKey: 'intro.expectComprehensiveTitle', bodyKey: 'intro.expectComprehensiveBody' },
  { titleKey: 'intro.expectVisualisationTitle', bodyKey: 'intro.expectVisualisationBody' },
  { titleKey: 'intro.expectPersonalisedTitle', bodyKey: 'intro.expectPersonalisedBody' },
]

export function IntroductionSection() {
  const t = useTranslations('Report')

  return (
    <div className="space-y-8">
      <ReportSectionHeading
        title={t('intro.title')}
        accent={t('intro.accent')}
        subtitle={t('intro.subtitle')}
      />

      <div className="space-y-4 text-sm text-ink-secondary leading-relaxed font-sans max-w-3xl">
        {INTRODUCTION_PARAGRAPH_KEYS.map((key) => (
          <p key={key}>{t(key)}</p>
        ))}
      </div>

      <div>
        <h3 className="font-display text-lg font-bold text-ink mb-4">{t('common.whatToExpect')}</h3>
        <div className="space-y-3">
          {WHAT_TO_EXPECT_KEYS.map((item, i) => (
            <div
              key={item.titleKey}
              className="rounded-xl border border-surface-border bg-surface-warm dark:bg-surface-raised p-4 flex gap-4"
            >
              <span className="font-display text-lg font-bold text-brand shrink-0">{i + 1}</span>
              <div>
                <p className="font-semibold text-ink text-sm mb-1">{t(item.titleKey)}</p>
                <p className="text-sm text-ink-muted leading-relaxed">{t(item.bodyKey)}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-3 text-sm text-ink-secondary leading-relaxed font-sans max-w-3xl">
        <p className="font-semibold text-ink">{t('common.dataUsage')}</p>
        <p>{t('intro.dataUsageBody')}</p>
        <p>{t('intro.journeyStart')}</p>
      </div>
    </div>
  )
}
