import { DISCLAIMER_PARAGRAPHS, PRIVACY_PARAGRAPHS } from '../../utils/qovesProtocolModel'
import { ReportSectionHeading } from './ReportSectionHeading'
import { ExternalLink } from 'lucide-react'

export function DisclaimerSection() {
  return (
    <div className="space-y-8">
      <ReportSectionHeading title="Disclaimer" />

      <div className="space-y-4 text-sm text-ink-secondary leading-relaxed font-sans max-w-3xl">
        {DISCLAIMER_PARAGRAPHS.map((para, i) => (
          <p key={i}>{para}</p>
        ))}
      </div>

      <div>
        <h3 className="font-display text-lg font-bold text-ink mb-4">Privacy Policy</h3>
        <div className="space-y-4 text-sm text-ink-secondary leading-relaxed font-sans max-w-3xl">
          {PRIVACY_PARAGRAPHS.map((para, i) => (
            <p key={i}>{para}</p>
          ))}
        </div>
      </div>

      <a
        href="https://myface.club"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand hover:text-brand-dark transition-colors"
      >
        READ FULL
        <ExternalLink className="w-3.5 h-3.5" />
      </a>
    </div>
  )
}
