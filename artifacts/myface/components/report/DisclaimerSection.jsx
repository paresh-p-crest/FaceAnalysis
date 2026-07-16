'use client'

import { useTranslations } from 'next-intl'
import { DISCLAIMER_PARAGRAPH_KEYS, PRIVACY_PARAGRAPH_KEYS } from '../../utils/qovesProtocolModel'
import { ReportSectionHeading } from './ReportSectionHeading'
import { ExternalLink } from 'lucide-react'

export function DisclaimerSection() {
  const t = useTranslations('Report')

  return (
    <div className="space-y-8">
      <ReportSectionHeading title={t('disclaimer.title')} />

      <div className="space-y-4 text-sm text-ink-secondary leading-relaxed font-sans max-w-3xl">
        {DISCLAIMER_PARAGRAPH_KEYS.map((key) => (
          <p key={key}>{t(key)}</p>
        ))}
      </div>

      <div>
        <h3 className="font-display text-lg font-bold text-ink mb-4">{t('common.privacyPolicy')}</h3>
        <div className="space-y-4 text-sm text-ink-secondary leading-relaxed font-sans max-w-3xl">
          {PRIVACY_PARAGRAPH_KEYS.map((key) => (
            <p key={key}>{t(key)}</p>
          ))}
        </div>
      </div>

      <a
        href="https://myface.club"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand hover:text-brand-dark transition-colors"
      >
        {t('common.readFull')}
        <ExternalLink className="w-3.5 h-3.5" />
      </a>
    </div>
  )
}
