import { INTRODUCTION_PARAGRAPHS } from '../../utils/qovesProtocolModel'
import { ReportSectionHeading } from './ReportSectionHeading'

const WHAT_TO_EXPECT = [
  {
    title: 'Comprehensive Insights',
    body: 'Understand your facial features and how they impact your overall appearance.',
  },
  {
    title: 'Visualisation',
    body: 'See how subtle, measurement-guided changes could impact your overall appearance.',
  },
  {
    title: 'As Personalised As It Gets',
    body: 'Every assessment accounts for your personal demographics for the most relevant insights.',
  },
]

export function IntroductionSection() {
  return (
    <div className="space-y-8">
      <ReportSectionHeading
        title="Every Glow-Up Starts By"
        accent="Understanding One's Face"
        subtitle="This aesthetic assessment uses technology and expert analysis to help you understand your features and explore non-surgical appearance improvements."
      />

      <div className="space-y-4 text-sm text-ink-secondary leading-relaxed font-sans max-w-3xl">
        {INTRODUCTION_PARAGRAPHS.map((para, i) => (
          <p key={i}>{para}</p>
        ))}
      </div>

      <div>
        <h3 className="font-display text-lg font-bold text-ink mb-4">What to Expect</h3>
        <div className="space-y-3">
          {WHAT_TO_EXPECT.map((item, i) => (
            <div
              key={item.title}
              className="rounded-xl border border-surface-border bg-surface-warm dark:bg-surface-raised p-4 flex gap-4"
            >
              <span className="font-display text-lg font-bold text-brand shrink-0">{i + 1}</span>
              <div>
                <p className="font-semibold text-ink text-sm mb-1">{item.title}</p>
                <p className="text-sm text-ink-muted leading-relaxed">{item.body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-3 text-sm text-ink-secondary leading-relaxed font-sans max-w-3xl">
        <p className="font-semibold text-ink">Data Usage:</p>
        <p>
          Your images are used only to deliver this assessment. Analysis is confidential and stored securely.
          Please refer to the Disclaimer section for full terms.
        </p>
        <p>We aim to empower you with knowledge you can trust. Let&apos;s begin your journey.</p>
      </div>
    </div>
  )
}
