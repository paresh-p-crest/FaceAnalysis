'use client'

import { useState } from 'react'
import { OnboardingLayout } from './OnboardingLayout'
import { Check } from 'lucide-react'
import {
  FREQUENCY_OPTIONS,
  MASCULINE_FEMININE_OPTIONS,
  YES_NO_OPTIONS,
  TREATMENT_COMFORT_OPTIONS,
  AESTHETIC_GOAL_OPTIONS,
  AESTHETIC_DISTRESS_OPTIONS,
  THINK_APPEARANCE_OPTIONS,
} from '../utils/onboarding'

const PAGES = [
  /* Page 0: Lifestyle (Occupation, Smoking, Drinking) */
  {
    sidebarTitle: 'Lifestyle Profile',
    sidebarDesc: 'Your daily habits and environment directly influence skin health and structural characteristics.',
    question: 'Tell us about your lifestyle',
    hint: 'Fill in your details to benchmark lifestyle triggers.',
    type: 'lifestyle',
    stepIndex: 1,
  },
  /* Page 1: Prior Experience (Masculine/Feminine, Prior Treatments) */
  {
    sidebarTitle: 'Aesthetic Preferences',
    sidebarDesc: 'Define your aesthetic preferences to guide our structural recommendations.',
    question: 'Aesthetic Preferences',
    hint: 'Helps us tailor structural calculations to your comfort levels.',
    type: 'prior_experience',
    stepIndex: 2,
  },
  /* Page 2: Treatment Comfort (multi-select comfort level) */
  {
    sidebarTitle: 'Aesthetic Preferences',
    sidebarDesc: 'Select the procedures you would be comfortable undergoing to customize targets.',
    question: 'Comfortable Treatment Types',
    hint: 'Select all treatment types you are comfortable undergoing.',
    type: 'treatment_comfort',
    stepIndex: 2,
  },
  /* Page 3: Medical History (Conditions, Allergies) */
  {
    sidebarTitle: 'Medical & Allergies',
    sidebarDesc: 'Declaring underlying conditions and ingredient sensitivities ensures all recommendations are safe.',
    question: 'Medical History',
    hint: 'All responses are strictly confidential.',
    type: 'medical',
    stepIndex: 3,
  },
  /* Page 4: Aesthetic Goals (Goal, Distress) */
  {
    sidebarTitle: 'Aesthetic Goals',
    sidebarDesc: 'Specify what you hope to achieve and how much your appearance impacts your day-to-day thinking.',
    question: 'What are your goals?',
    hint: 'Help us prioritize recommendations in your final narrative.',
    type: 'goals',
    stepIndex: 4,
  },
  /* Page 5: Appearance Focus (Frequency of thinking about appearance) */
  {
    sidebarTitle: 'Aesthetic Goals',
    sidebarDesc: 'Understanding how often you think about your appearance helps customize diagnostic reports.',
    question: 'How often do you think about your appearance?',
    hint: 'Select the closest frequency.',
    type: 'appearance_focus',
    stepIndex: 4,
  },
  /* Page 6: Additional Info (Free Text) */
  {
    sidebarTitle: 'Additional Context',
    sidebarDesc: 'Any additional notes or specific areas of concern help our review admin panel understand your case.',
    question: 'Anything else we should know?',
    hint: 'Feel free to add any details or specific aesthetic targets.',
    type: 'additional',
    stepIndex: 5,
  },
]

function CompactRow({ label, options, value, onChange }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 py-3 border-b border-surface-border last:border-0">
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

function SectionLabel({ children }) {
  return (
    <h3 className="text-xs font-semibold text-ink-muted uppercase tracking-wider mb-2">{children}</h3>
  )
}

export default function Questionnaire({ answers, setAnswers, onComplete, onBack, initialPage = 0 }) {
  const [page, setPage] = useState(initialPage)
  const current = PAGES[page]

  const set = (key, value) => {
    setAnswers((prev) => ({ ...prev, [key]: value }))
  }

  const toggleComfortableTreatment = (value) => {
    setAnswers((prev) => {
      const arr = prev.comfortableTreatments || []
      if (value === 'none') {
        return { ...prev, comfortableTreatments: arr.includes('none') ? [] : ['none'] }
      }
      const filtered = arr.filter((v) => v !== 'none')
      if (filtered.includes(value)) {
        return { ...prev, comfortableTreatments: filtered.filter((v) => v !== value) }
      }
      return { ...prev, comfortableTreatments: [...filtered, value] }
    })
  }

  const isPageComplete = () => {
    switch (current.type) {
      case 'lifestyle':
        return !!answers.occupation.trim() && !!answers.smoking && !!answers.drinking
      case 'prior_experience':
        return !!answers.masculineFeminine && !!answers.priorTreatments
      case 'treatment_comfort':
        return (answers.comfortableTreatments || []).length > 0
      case 'medical':
        return !!answers.medicalConditions && !!answers.allergies
      case 'goals':
        return !!answers.aestheticGoal && !!answers.aestheticDistress
      case 'appearance_focus':
        return !!answers.thinkAppearance
      case 'additional':
        return true // free text optional
      default:
        return false
    }
  }

  const isLast = page === PAGES.length - 1

  const handleContinue = () => {
    if (isLast) onComplete()
    else setPage((p) => p + 1)
  }

  const handleBack = () => {
    if (page > 0) setPage((p) => p - 1)
    else onBack()
  }

  const selectionLabel = (() => {
    switch (current.type) {
      case 'lifestyle': {
        const count = [answers.occupation.trim(), answers.smoking, answers.drinking].filter(Boolean).length
        return `${count}/3 completed`
      }
      case 'prior_experience': {
        const count = [answers.masculineFeminine, answers.priorTreatments].filter(Boolean).length
        return `${count}/2 completed`
      }
      case 'treatment_comfort':
        return (answers.comfortableTreatments || []).length > 0 ? 'Selection complete' : 'Choose at least one option'
      case 'medical': {
        const count = [answers.medicalConditions, answers.allergies].filter(Boolean).length
        return `${count}/2 completed`
      }
      case 'goals': {
        const count = [answers.aestheticGoal, answers.aestheticDistress].filter(Boolean).length
        return `${count}/2 completed`
      }
      case 'appearance_focus':
        return answers.thinkAppearance ? 'Complete' : ''
      case 'additional':
        return 'Optional'
      default:
        return ''
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

        {/* ── PAGE 0: Lifestyle ── */}
        {current.type === 'lifestyle' && (
          <div className="space-y-6">
            <div>
              <SectionLabel>What is your occupation?</SectionLabel>
              <input
                type="text"
                value={answers.occupation || ''}
                onChange={(e) => set('occupation', e.target.value)}
                placeholder="e.g. Software Engineer, Sales Manager"
                className="w-full px-4 py-3 rounded-xl border border-surface-border bg-white dark:bg-surface-card text-ink focus:outline-none focus:border-brand transition-colors text-sm"
              />
            </div>

            <div className="bg-white dark:bg-surface-card rounded-xl border border-surface-border px-5 py-1">
              <CompactRow
                label="Smoking frequency"
                options={FREQUENCY_OPTIONS}
                value={answers.smoking}
                onChange={(v) => set('smoking', v)}
              />
              <CompactRow
                label="Drinking frequency"
                options={FREQUENCY_OPTIONS}
                value={answers.drinking}
                onChange={(v) => set('drinking', v)}
              />
            </div>
          </div>
        )}

        {/* ── PAGE 1: Prior Experience ── */}
        {current.type === 'prior_experience' && (
          <div className="space-y-6">
            <div>
              <SectionLabel>Would you rather look more masculine or more feminine?</SectionLabel>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {MASCULINE_FEMININE_OPTIONS.map((opt) => {
                  const selected = answers.masculineFeminine === opt.value
                  return (
                    <button
                      key={opt.value}
                      onClick={() => set('masculineFeminine', opt.value)}
                      className={`option-card p-3 sm:p-4 text-center text-xs font-semibold ${
                        selected ? 'option-card-selected text-brand' : 'text-ink-secondary'
                      }`}
                    >
                      {opt.label}
                    </button>
                  )
                })}
              </div>
            </div>

            <div>
              <SectionLabel>Have you had any non-surgical aesthetic treatments before?</SectionLabel>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {YES_NO_OPTIONS.map((opt) => {
                  const selected = answers.priorTreatments === opt.value
                  return (
                    <button
                      key={opt.value}
                      onClick={() => set('priorTreatments', opt.value)}
                      className={`option-card p-3 sm:p-4 text-center text-xs font-semibold ${
                        selected ? 'option-card-selected text-brand' : 'text-ink-secondary'
                      }`}
                    >
                      {opt.label}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {/* ── PAGE 2: Treatment Comfort ── */}
        {current.type === 'treatment_comfort' && (
          <div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {TREATMENT_COMFORT_OPTIONS.map((opt) => {
                const selected = (answers.comfortableTreatments || []).includes(opt.value)
                return (
                  <button
                    key={opt.value}
                    onClick={() => toggleComfortableTreatment(opt.value)}
                    className={`option-card flex items-start gap-3 p-4 ${
                      selected ? 'option-card-selected' : ''
                    }`}
                  >
                    <div
                      className={`mt-0.5 w-4 h-4 rounded border-2 shrink-0 transition-colors flex items-center justify-center ${
                        selected ? 'border-brand bg-brand animate-scale-in' : 'border-ink-faint'
                      }`}
                    >
                      {selected && <Check className="w-3 h-3 text-white" />}
                    </div>
                    <div className="text-left text-xs font-medium text-ink">
                      {opt.label}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* ── PAGE 3: Medical ── */}
        {current.type === 'medical' && (
          <div className="space-y-6">
            <div>
              <SectionLabel>Do you have any medical conditions?</SectionLabel>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {YES_NO_OPTIONS.map((opt) => {
                  const selected = answers.medicalConditions === opt.value
                  return (
                    <button
                      key={opt.value}
                      onClick={() => set('medicalConditions', opt.value)}
                      className={`option-card p-3 sm:p-4 text-center text-xs font-semibold ${
                        selected ? 'option-card-selected text-brand' : 'text-ink-secondary'
                      }`}
                    >
                      {opt.label}
                    </button>
                  )
                })}
              </div>
            </div>

            <div>
              <SectionLabel>Do you have any allergies?</SectionLabel>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {YES_NO_OPTIONS.map((opt) => {
                  const selected = answers.allergies === opt.value
                  return (
                    <button
                      key={opt.value}
                      onClick={() => set('allergies', opt.value)}
                      className={`option-card p-3 sm:p-4 text-center text-xs font-semibold ${
                        selected ? 'option-card-selected text-brand' : 'text-ink-secondary'
                      }`}
                    >
                      {opt.label}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {/* ── PAGE 4: Goals ── */}
        {current.type === 'goals' && (
          <div className="space-y-6">
            <div>
              <SectionLabel>What is your aesthetic goal?</SectionLabel>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {AESTHETIC_GOAL_OPTIONS.map((opt) => {
                  const selected = answers.aestheticGoal === opt.value
                  return (
                    <button
                      key={opt.value}
                      onClick={() => set('aestheticGoal', opt.value)}
                      className={`option-card p-3.5 text-left ${
                        selected ? 'option-card-selected' : ''
                      }`}
                    >
                      <div className="text-xs font-medium text-ink leading-normal">
                        {opt.label}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            <div>
              <SectionLabel>How much distress does your facial aesthetic cause you?</SectionLabel>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {AESTHETIC_DISTRESS_OPTIONS.map((opt) => {
                  const selected = answers.aestheticDistress === opt.value
                  return (
                    <button
                      key={opt.value}
                      onClick={() => set('aestheticDistress', opt.value)}
                      className={`option-card p-3.5 text-left ${
                        selected ? 'option-card-selected' : ''
                      }`}
                    >
                      <div className="text-xs font-medium text-ink leading-normal">
                        {opt.label}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {/* ── PAGE 5: Appearance Focus ── */}
        {current.type === 'appearance_focus' && (
          <div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {THINK_APPEARANCE_OPTIONS.map((opt) => {
                const selected = answers.thinkAppearance === opt.value
                return (
                  <button
                    key={opt.value}
                    onClick={() => set('thinkAppearance', opt.value)}
                    className={`option-card p-3.5 text-left ${
                      selected ? 'option-card-selected' : ''
                    }`}
                  >
                    <div className="text-xs font-medium text-ink leading-normal">
                      {opt.label}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* ── PAGE 6: Additional Info ── */}
        {current.type === 'additional' && (
          <div className="space-y-4">
            <SectionLabel>Anything else you think we should know?</SectionLabel>
            <textarea
              value={answers.additionalInfo || ''}
              onChange={(e) => set('additionalInfo', e.target.value)}
              placeholder="e.g. Prior surgeries, specific aesthetic expectations, or other concerns..."
              className="w-full h-44 px-4 py-3 rounded-xl border border-surface-border bg-white dark:bg-surface-card text-ink focus:outline-none focus:border-brand transition-colors text-sm resize-none"
            />
          </div>
        )}
      </div>
    </OnboardingLayout>
  )
}
