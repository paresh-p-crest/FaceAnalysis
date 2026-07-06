import { useState, useEffect } from 'react'
import { OnboardingLayout } from './OnboardingLayout'
import {
  GOAL_OPTIONS,
  SKIN_CONCERN_OPTIONS,
  AGE_OPTIONS,
  GENDER_OPTIONS,
  ETHNICITY_OPTIONS,
  SEVERITY_OPTIONS,
  SKIN_TYPE_OPTIONS,
  SMOKING_OPTIONS,
  SLEEP_OPTIONS,
  WATER_OPTIONS,
  SUN_OPTIONS,
  SKINCARE_OPTIONS,
} from '../utils/onboarding'

/**
 * Flat page definitions for the onboarding wizard.
 * All navigation handled by OnboardingLayout footer — no internal nav.
 * Step indices map to the 7-step stepper: Welcome(0)|Goals(1)|Concerns(2)|
 * Profile(3)|Lifestyle(4)|SkinCare(5)|Upload(6)
 */
const PAGES = [
  /* 0 — Goals */
  {
    sidebarTitle: 'Define your goals',
    sidebarDesc: 'Help us tailor your facial analysis report. Select all that apply — your answers guide the depth of your insights.',
    question: 'What would you like to improve?',
    hint: 'Select up to 3 goals. This helps us prioritize your report sections.',
    type: 'goals',
    stepIndex: 1,
  },
  /* 1 — Concerns + Severity */
  {
    sidebarTitle: 'Skin Concerns',
    sidebarDesc: 'Select the areas you want us to focus on. Our AI will prioritize these in your skin quality analysis.',
    question: 'Which skin concerns affect you?',
    hint: 'Select all that apply, then rate overall severity.',
    type: 'concerns',
    stepIndex: 2,
  },
  /* 2 — Demographics */
  {
    sidebarTitle: 'About You',
    sidebarDesc: 'These help us compare your results against relevant demographic norms for more accurate insights.',
    question: 'Tell us about yourself',
    hint: 'Used for benchmarking only — never shared.',
    type: 'profile',
    stepIndex: 3,
  },
  /* 3 — Lifestyle (all compact) */
  {
    sidebarTitle: 'Lifestyle',
    sidebarDesc: 'Daily habits directly impact skin health and aging. Quick questions for better recommendations.',
    question: 'Your daily habits',
    hint: 'Select one per row.',
    type: 'lifestyle',
    stepIndex: 4,
  },
  /* 4 — Skin type + Skincare */
  {
    sidebarTitle: 'Skin Care',
    sidebarDesc: 'Your skin type and routine help us build a realistic, personalized protocol.',
    question: 'Your skin & routine',
    hint: 'Know your type? Great. Not sure? Pick the closest match.',
    type: 'skincare',
    stepIndex: 5,
  },
]

const MAX_GOALS = 3

/* ── Compact single-select row (for lifestyle) ── */
function CompactRow({ label, options, value, onChange }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 py-2.5 border-b border-surface-border last:border-0">
      <span className="text-sm font-medium text-ink min-w-[160px] shrink-0">{label}</span>
      <div className="flex flex-wrap gap-1.5">
        {options.map((opt) => {
          const selected = value === opt.value
          return (
            <button
              key={opt.value}
              onClick={() => onChange(opt.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                selected
                  ? 'bg-brand text-white border-brand shadow-sm'
                  : 'bg-white dark:bg-surface-card text-ink-secondary border-surface-border hover:border-brand/40 hover:text-ink'
              }`}
            >
              {opt.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

/* ── Section heading for multi-question pages ── */
function SectionLabel({ children }) {
  return (
    <h3 className="text-xs font-semibold text-ink-muted uppercase tracking-wider mb-2">{children}</h3>
  )
}

export default function Questionnaire({ answers, setAnswers, onComplete, onBack }) {
  const [page, setPage] = useState(0)
  const current = PAGES[page]

  /* ── Helpers ── */
  const toggleGoal = (value) => {
    if (value === 'none') {
      setAnswers((prev) => ({ ...prev, goals: prev.goals.includes('none') ? [] : ['none'] }))
      return
    }
    setAnswers((prev) => {
      const arr = prev.goals.filter((v) => v !== 'none')
      if (arr.includes(value)) return { ...prev, goals: arr.filter((v) => v !== value) }
      if (arr.length >= MAX_GOALS) return prev
      return { ...prev, goals: [...arr, value] }
    })
  }

  const toggleConcern = (value) => {
    if (value === 'none') {
      setAnswers((prev) => ({ ...prev, skinConcerns: prev.skinConcerns.includes('none') ? [] : ['none'] }))
      return
    }
    setAnswers((prev) => {
      const arr = prev.skinConcerns.filter((v) => v !== 'none')
      return {
        ...prev,
        skinConcerns: arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value],
      }
    })
  }

  const set = (key, value) => {
    setAnswers((prev) => {
      const next = { ...prev, [key]: value }
      // Auto-fill lifestyle defaults for male users if not already set
      if (next.gender === 'male') {
        if (!next.smoking) next.smoking = 'never'
        if (!next.sleepQuality) next.sleepQuality = 'good'
        if (!next.waterIntake) next.waterIntake = 'moderate'
        if (!next.sunExposure) next.sunExposure = 'moderate'
        if (!next.skinType) next.skinType = 'combination'
        if (!next.skincareRoutine) next.skincareRoutine = 'minimal'
        if (!next.environment) next.environment = 'urban'
        if (!next.concernSeverity) next.concernSeverity = 'mild'
      }
      return next
    })
  }

  // Auto-fill male defaults when navigating to lifestyle or skincare pages
  useEffect(() => {
    if (answers.gender !== 'male') return
    if (current.type === 'lifestyle' || current.type === 'skincare') {
      setAnswers((prev) => {
        const filled = { ...prev }
        let changed = false
        if (current.type === 'lifestyle') {
          if (!filled.smoking) { filled.smoking = 'never'; changed = true }
          if (!filled.sleepQuality) { filled.sleepQuality = 'good'; changed = true }
          if (!filled.waterIntake) { filled.waterIntake = 'moderate'; changed = true }
          if (!filled.sunExposure) { filled.sunExposure = 'moderate'; changed = true }
          if (!filled.environment) { filled.environment = 'urban'; changed = true }
        }
        if (current.type === 'skincare') {
          if (!filled.skinType) { filled.skinType = 'combination'; changed = true }
          if (!filled.skincareRoutine) { filled.skincareRoutine = 'minimal'; changed = true }
        }
        return changed ? filled : prev
      })
    }
  }, [current.type, answers.gender])

  /* ── Per-page validation ── */
  const isPageComplete = () => {
    switch (current.type) {
      case 'goals': return answers.goals.length > 0
      case 'concerns': return answers.skinConcerns.length > 0
      case 'profile': return !!answers.ageRange && !!answers.gender
      case 'lifestyle': return !!(answers.smoking && answers.sleepQuality && answers.waterIntake && answers.sunExposure)
      case 'skincare': return !!(answers.skinType && answers.skincareRoutine)
      default: return false
    }
  }

  /* ── Navigation ── */
  const isLast = page === PAGES.length - 1

  const handleContinue = () => {
    if (isLast) onComplete()
    else setPage((p) => p + 1)
  }

  const handleBack = () => {
    if (page > 0) setPage((p) => p - 1)
    else onBack()
  }

  /* ── Selection label ── */
  const selectionLabel = (() => {
    switch (current.type) {
      case 'goals':
        return `${answers.goals.length} of ${MAX_GOALS} goals selected`
      case 'concerns':
        return `${answers.skinConcerns.length} concern${answers.skinConcerns.length !== 1 ? 's' : ''} selected`
      case 'profile':
        return answers.ageRange && answers.gender ? 'Profile complete' : ''
      case 'lifestyle': {
        const count = [answers.smoking, answers.sleepQuality, answers.waterIntake, answers.sunExposure].filter(Boolean).length
        return count === 4 ? 'Complete' : count > 0 ? `${count}/4 answered` : ''
      }
      case 'skincare':
        return answers.skinType && answers.skincareRoutine ? 'Complete' : ''
      default: return ''
    }
  })()

  return (
    <OnboardingLayout
      stepIndex={current.stepIndex}
      sidebarTitle={current.sidebarTitle}
      sidebarDesc={current.sidebarDesc}
      onBack={handleBack}
      selectionLabel={selectionLabel}
      onContinue={handleContinue}
      continueLabel={isLast ? 'Proceed to Upload' : 'Continue'}
      continueDisabled={!isPageComplete()}
    >
      <div className="max-w-3xl pt-2">
        <h2 className="font-display text-xl sm:text-2xl font-semibold text-ink mb-0.5">{current.question}</h2>
        <p className="text-sm text-ink-muted mb-6">{current.hint}</p>

        {/* ── PAGE: Goals ── */}
        {current.type === 'goals' && (
          <div className="grid sm:grid-cols-2 gap-2.5">
            {GOAL_OPTIONS.map((opt) => {
              const selected = answers.goals.includes(opt.value)
              const atMax = answers.goals.length >= MAX_GOALS && !selected
              return (
                <button
                  key={opt.value}
                  onClick={() => toggleGoal(opt.value)}
                  disabled={atMax}
                  className={`option-card flex items-start gap-3 p-4 ${selected ? 'option-card-selected' : ''} ${atMax ? 'opacity-40 cursor-not-allowed' : ''}`}
                >
                  <div className={`mt-0.5 w-4 h-4 rounded-full border-2 shrink-0 transition-colors ${selected ? 'border-brand bg-brand' : 'border-ink-faint'}`} />
                  <div className="text-left">
                    <div className="font-medium text-ink text-sm">{opt.label}</div>
                    <div className="text-xs text-ink-muted mt-0.5">{opt.desc}</div>
                  </div>
                </button>
              )
            })}
          </div>
        )}

        {/* ── PAGE: Concerns + Severity ── */}
        {current.type === 'concerns' && (
          <div className="space-y-5">
            <div>
              <div className="flex flex-wrap gap-2">
                {SKIN_CONCERN_OPTIONS.map((opt) => {
                  const selected = answers.skinConcerns.includes(opt.value)
                  return (
                    <button
                      key={opt.value}
                      onClick={() => toggleConcern(opt.value)}
                      className={`chip-option ${selected ? 'chip-option-selected' : ''}`}
                    >
                      {opt.label}
                    </button>
                  )
                })}
              </div>
            </div>
            {answers.skinConcerns.length > 0 && !answers.skinConcerns.includes('none') && (
              <div>
                <SectionLabel>Overall severity</SectionLabel>
                <div className="flex gap-2">
                  {SEVERITY_OPTIONS.map((opt) => {
                    const selected = answers.concernSeverity === opt.value
                    return (
                      <button
                        key={opt.value}
                        onClick={() => set('concernSeverity', opt.value)}
                        className={`flex-1 option-card p-3 text-center ${selected ? 'option-card-selected' : ''}`}
                      >
                        <div className={`font-medium text-sm ${selected ? 'text-brand' : 'text-ink'}`}>{opt.label}</div>
                        <div className="text-xs text-ink-muted mt-0.5">{opt.desc}</div>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── PAGE: Profile (age + gender + ethnicity) ── */}
        {current.type === 'profile' && (
          <div className="space-y-5">
            <div>
              <SectionLabel>Age range</SectionLabel>
              <div className="flex flex-wrap gap-2">
                {AGE_OPTIONS.map((opt) => {
                  const selected = answers.ageRange === opt.value
                  return (
                    <button
                      key={opt.value}
                      onClick={() => set('ageRange', opt.value)}
                      className={`chip-option min-w-[68px] text-center ${selected ? 'chip-option-selected' : ''}`}
                    >
                      {opt.label}
                    </button>
                  )
                })}
              </div>
            </div>

            <div>
              <SectionLabel>Gender</SectionLabel>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {GENDER_OPTIONS.map((opt) => {
                  const selected = answers.gender === opt.value
                  return (
                    <button
                      key={opt.value}
                      onClick={() => set('gender', opt.value)}
                      className={`option-card p-3 text-center text-sm font-medium ${selected ? 'option-card-selected text-brand' : 'text-ink-secondary'}`}
                    >
                      {opt.label}
                    </button>
                  )
                })}
              </div>
            </div>

            <div>
              <SectionLabel>Ethnic heritage</SectionLabel>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {ETHNICITY_OPTIONS.map((opt) => {
                  const selected = answers.ethnicity === opt.value
                  return (
                    <button
                      key={opt.value}
                      onClick={() => set('ethnicity', opt.value)}
                      className={`option-card p-3 text-center text-sm font-medium ${selected ? 'option-card-selected text-brand' : 'text-ink-secondary'}`}
                    >
                      {opt.label}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {/* ── PAGE: Lifestyle (compact single-select rows) ── */}
        {current.type === 'lifestyle' && (
          <div className="bg-white dark:bg-surface-card rounded-xl border border-surface-border px-5 py-1">
            <CompactRow label="Smoking" options={SMOKING_OPTIONS} value={answers.smoking} onChange={(v) => set('smoking', v)} />
            <CompactRow label="Sleep quality" options={SLEEP_OPTIONS} value={answers.sleepQuality} onChange={(v) => set('sleepQuality', v)} />
            <CompactRow label="Daily water" options={WATER_OPTIONS} value={answers.waterIntake} onChange={(v) => set('waterIntake', v)} />
            <CompactRow label="Sun exposure" options={SUN_OPTIONS} value={answers.sunExposure} onChange={(v) => set('sunExposure', v)} />
            <CompactRow
              label="Environment"
              options={[
                { value: 'indoor', label: 'Indoor' },
                { value: 'mixed', label: 'Mixed' },
                { value: 'outdoor', label: 'Outdoor' },
              ]}
              value={answers.environment}
              onChange={(v) => set('environment', v)}
            />
          </div>
        )}

        {/* ── PAGE: Skincare (skin type + routine) ── */}
        {current.type === 'skincare' && (
          <div className="space-y-5">
            <div>
              <SectionLabel>Skin type</SectionLabel>
              <div className="grid sm:grid-cols-3 gap-2">
                {SKIN_TYPE_OPTIONS.map((opt) => {
                  const selected = answers.skinType === opt.value
                  return (
                    <button
                      key={opt.value}
                      onClick={() => set('skinType', opt.value)}
                      className={`option-card p-3 text-left ${selected ? 'option-card-selected' : ''}`}
                    >
                      <div className={`font-medium text-sm ${selected ? 'text-brand' : 'text-ink'}`}>{opt.label}</div>
                      <div className="text-xs text-ink-muted mt-0.5">{opt.desc}</div>
                    </button>
                  )
                })}
              </div>
            </div>

            <div>
              <SectionLabel>Current skincare routine</SectionLabel>
              <div className="grid sm:grid-cols-2 gap-2">
                {SKINCARE_OPTIONS.map((opt) => {
                  const selected = answers.skincareRoutine === opt.value
                  return (
                    <button
                      key={opt.value}
                      onClick={() => set('skincareRoutine', opt.value)}
                      className={`option-card p-3 text-left ${selected ? 'option-card-selected' : ''}`}
                    >
                      <div className={`font-medium text-sm ${selected ? 'text-brand' : 'text-ink'}`}>{opt.label}</div>
                      <div className="text-xs text-ink-muted mt-0.5">{opt.desc}</div>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </OnboardingLayout>
  )
}
