import { OnboardingLayout } from './OnboardingLayout'
import { Scan, Clock, Fingerprint } from 'lucide-react'

const STATS = [
  { icon: Fingerprint, value: '468+', label: 'Facial landmarks' },
  { icon: Clock, value: '5 min', label: 'Full assessment' },
  { icon: Scan, value: '100%', label: 'Personalized' },
]

export default function Landing({ onBegin }) {
  return (
    <OnboardingLayout
      stepIndex={0}
      sidebarTitle="Welcome to AuraScan"
      sidebarDesc="Science-backed facial analysis mapping 468+ landmark points — delivering personalized skin and structure insights in minutes."
      showBack={false}
      onContinue={onBegin}
      continueLabel="Get Started"
      footerHint="Takes about 3 minutes · No account required"
    >
      <div className="max-w-2xl pt-4">
        <h2 className="font-display text-2xl sm:text-3xl font-semibold text-ink mb-3">
          Your personalized facial analysis starts here
        </h2>
        <p className="text-ink-secondary text-sm leading-relaxed mb-10 max-w-lg">
          Answer a few quick questions so we can tailor your report to your goals, skin concerns, and demographics.
          Then upload a photo for AI-powered analysis.
        </p>

        <div className="grid sm:grid-cols-3 gap-4">
          {STATS.map((stat) => (
            <div key={stat.label} className="glass rounded-2xl p-5 text-center">
              <stat.icon className="w-5 h-5 text-brand mx-auto mb-2" />
              <div className="text-2xl font-display font-bold text-ink">{stat.value}</div>
              <div className="text-xs text-ink-muted mt-1">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>
    </OnboardingLayout>
  )
}
