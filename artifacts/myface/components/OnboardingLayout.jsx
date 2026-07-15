import { ChevronLeft, ChevronRight, ScanFace, CheckCircle2, Shield, Sparkles } from 'lucide-react'
import { ONBOARDING_STEPS } from '../utils/onboarding'

const TRUST_ITEMS = [
  { icon: CheckCircle2, text: 'Clinically-informed analysis' },
  { icon: Shield, text: 'Your photos are never stored' },
  { icon: Sparkles, text: 'AI-powered, dermatologist-reviewed' },
]

export function OnboardingLayout({
  stepIndex,
  sidebarTitle,
  sidebarDesc,
  onBack,
  showBack = true,
  children,
  footerHint,
  selectionLabel,
  onContinue,
  continueLabel = 'Continue',
  continueDisabled = false,
  hideFooter = false,
}) {
  const stepLabel = `STEP ${stepIndex + 1} OF ${ONBOARDING_STEPS.length}`

  return (
    <div className="min-h-screen flex animate-fade-up">
      {/* Sidebar */}
      <aside className="hidden lg:flex w-[340px] shrink-0 flex-col border-r border-surface-border bg-white dark:bg-surface-card px-10 py-10">
        <div className="flex items-center gap-2.5 mb-auto">
          <span className="font-serif font-bold text-ink text-2xl tracking-tight">MyFace</span>
        </div>

        <div className="my-auto">
          <p className="text-[11px] font-medium tracking-[0.15em] text-ink-muted uppercase mb-4">{stepLabel}</p>
          <h1 className="font-display text-3xl font-bold text-brand leading-tight mb-4">{sidebarTitle}</h1>
          <p className="text-sm text-ink-secondary leading-relaxed">{sidebarDesc}</p>
        </div>

        <div className="mt-auto space-y-4">
          {TRUST_ITEMS.map(({ icon: Icon, text }) => (
            <div key={text} className="flex items-center gap-3 text-xs text-ink-muted">
              <Icon className="w-4 h-4 text-brand shrink-0" />
              <span>{text}</span>
            </div>
          ))}
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-h-screen bg-surface">
        <div className="px-6 sm:px-10 pt-8 pb-4">
          <div className="lg:hidden mb-4">
            <p className="text-[11px] font-medium tracking-[0.15em] text-ink-muted uppercase">{stepLabel}</p>
            <p className="font-display text-lg font-semibold text-brand mt-1">{sidebarTitle}</p>
          </div>

          {showBack && onBack && (
            <button onClick={onBack} className="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink transition-colors mb-6">
              <ChevronLeft className="w-4 h-4" />
              Back
            </button>
          )}

          {/* Progress stepper */}
          <div className="flex items-center justify-between max-w-3xl">
            {ONBOARDING_STEPS.map((step, i) => {
              const done = i < stepIndex
              const active = i === stepIndex
              return (
                <div key={step.id} className="flex items-center flex-1 last:flex-none">
                  <div className="flex flex-col items-center gap-2 min-w-[72px]">
                    <div
                      className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold transition-all ${
                        active
                          ? 'onboarding-step-active'
                          : done
                            ? 'onboarding-step-done'
                            : 'bg-surface-warm text-ink-muted border border-surface-border'
                      }`}
                    >
                      {done ? '✓' : i + 1}
                    </div>
                    <span
                      className={`text-[10px] text-center leading-tight hidden sm:block ${
                        active ? 'text-brand font-medium' : done ? 'text-ink-secondary' : 'text-ink-muted'
                      }`}
                    >
                      {step.label}
                    </span>
                  </div>
                  {i < ONBOARDING_STEPS.length - 1 && (
                    <div className={`flex-1 h-px mx-1 mb-6 ${done ? 'bg-brand/30' : 'bg-surface-border'}`} />
                  )}
                </div>
              )
            })}
          </div>
        </div>

        <div className="flex-1 px-6 sm:px-10 pb-8">{children}</div>

        {!hideFooter && (
          <div className="px-6 sm:px-10 py-6 border-t border-surface-border bg-white dark:bg-surface-card flex items-center justify-between gap-4">
            <div className="text-sm text-ink-muted min-h-[20px]">
              {selectionLabel && <span className="text-brand">{selectionLabel}</span>}
              {footerHint && <p className="text-xs text-ink-faint mt-1">{footerHint}</p>}
            </div>
            <button
              onClick={onContinue}
              disabled={continueDisabled}
              className="btn-primary text-sm disabled:opacity-40 disabled:pointer-events-none shrink-0"
            >
              {continueLabel}
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
