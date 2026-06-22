import { ChevronLeft, ChevronRight, ScanFace, CheckCircle2, Lock, Sparkles } from 'lucide-react'
import { ONBOARDING_STEPS } from '../utils/onboarding'

const TRUST_ITEMS = [
  { icon: CheckCircle2, text: 'Clinically-informed analysis' },
  { icon: Lock, text: 'Your photos are never stored' },
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
      <aside className="hidden lg:flex w-[340px] shrink-0 flex-col border-r border-white/[0.06] bg-surface-raised/50 px-10 py-10">
        <div className="flex items-center gap-3 mb-auto">
          <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center">
            <ScanFace className="w-5 h-5 text-surface" />
          </div>
          <span className="font-display font-semibold text-white text-lg tracking-tight">AuraScan</span>
        </div>

        <div className="my-auto">
          <p className="text-[11px] font-medium tracking-[0.15em] text-slate-500 uppercase mb-4">{stepLabel}</p>
          <h1 className="font-display text-3xl font-bold text-accent leading-tight mb-4">{sidebarTitle}</h1>
          <p className="text-sm text-slate-400 leading-relaxed">{sidebarDesc}</p>
        </div>

        <div className="mt-auto space-y-4">
          {TRUST_ITEMS.map(({ icon: Icon, text }) => (
            <div key={text} className="flex items-center gap-3 text-xs text-slate-500">
              <Icon className="w-4 h-4 text-accent/70 shrink-0" />
              <span>{text}</span>
            </div>
          ))}
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-h-screen">
        <div className="px-6 sm:px-10 pt-8 pb-4">
          <div className="lg:hidden mb-4">
            <p className="text-[11px] font-medium tracking-[0.15em] text-slate-500 uppercase">{stepLabel}</p>
            <p className="font-display text-lg font-semibold text-accent mt-1">{sidebarTitle}</p>
          </div>

          {showBack && onBack && (
            <button onClick={onBack} className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-white transition-colors mb-6">
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
                            : 'bg-white/[0.04] text-slate-600 border border-white/[0.08]'
                      }`}
                    >
                      {done ? '✓' : i + 1}
                    </div>
                    <span
                      className={`text-[10px] text-center leading-tight hidden sm:block ${
                        active ? 'text-accent font-medium' : done ? 'text-slate-400' : 'text-slate-600'
                      }`}
                    >
                      {step.label}
                    </span>
                  </div>
                  {i < ONBOARDING_STEPS.length - 1 && (
                    <div className={`flex-1 h-px mx-1 mb-6 ${done ? 'bg-accent/40' : 'bg-white/[0.08]'}`} />
                  )}
                </div>
              )
            })}
          </div>
        </div>

        <div className="flex-1 px-6 sm:px-10 pb-8">{children}</div>

        {!hideFooter && (
          <div className="px-6 sm:px-10 py-6 border-t border-white/[0.06] flex items-center justify-between gap-4">
            <div className="text-sm text-slate-500 min-h-[20px]">
              {selectionLabel && <span className="text-accent/90">{selectionLabel}</span>}
              {footerHint && <p className="text-xs text-slate-600 mt-1">{footerHint}</p>}
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
