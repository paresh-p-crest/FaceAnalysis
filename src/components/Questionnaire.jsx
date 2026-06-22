import { useState } from 'react'
import { OnboardingLayout } from './OnboardingLayout'
import {
  GOAL_OPTIONS,
  SKIN_CONCERN_OPTIONS,
  SEVERITY_OPTIONS,
  OCCUPATION_OPTIONS,
  SMOKING_OPTIONS,
  MEDICAL_CONDITION_OPTIONS,
  AGE_OPTIONS,
  GENDER_OPTIONS,
} from '../utils/onboarding'

const STEPS = [
  {
    sidebarTitle: 'Define your goals',
    sidebarDesc: 'Help us tailor your facial analysis report. Select all that apply — your answers guide the depth of your insights.',
    question: 'What are you hoping to achieve?',
    hint: 'Select up to 3 goals. This helps us prioritize your report sections.',
    footerHint: 'You can always update this later in settings.',
    type: 'goals',
  },
  {
    sidebarTitle: 'Your skin concerns',
    sidebarDesc: 'Select the areas you want us to focus on. Our AI will prioritize these in your skin quality analysis.',
    question: 'Which skin concerns affect you most?',
    hint: 'Select all that apply — we will weight these in your report.',
    type: 'concerns',
  },
  {
    sidebarTitle: 'Lifestyle & health',
    sidebarDesc: 'Occupation, smoking, and medical history affect skin aging, barrier health, and how we tailor your protocol.',
    question: 'A few lifestyle questions',
    hint: 'Helps us account for environmental and health factors in your analysis.',
    footerHint: 'Medical info is used for report context only — not a diagnosis.',
    type: 'lifestyle',
  },
  {
    sidebarTitle: 'About you',
    sidebarDesc: 'Age and gender help us compare your results against relevant demographic norms for more accurate insights.',
    question: 'Tell us a bit about yourself',
    hint: 'Used for demographic benchmarking only — never shared.',
    type: 'profile',
  },
]

const MAX_GOALS = 3

export default function Questionnaire({ answers, setAnswers, onComplete, onBack }) {
  const [step, setStep] = useState(0)
  const current = STEPS[step]

  const toggleGoal = (value) => {
    setAnswers((prev) => {
      const arr = prev.goals
      if (arr.includes(value)) return { ...prev, goals: arr.filter((v) => v !== value) }
      if (arr.length >= MAX_GOALS) return prev
      return { ...prev, goals: [...arr, value] }
    })
  }

  const toggleConcern = (value) => {
    setAnswers((prev) => {
      const arr = prev.skinConcerns
      return {
        ...prev,
        skinConcerns: arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value],
      }
    })
  }

  const toggleMedical = (value) => {
    setAnswers((prev) => {
      if (value === 'none') return { ...prev, medicalConditions: ['none'] }
      const withoutNone = prev.medicalConditions.filter((v) => v !== 'none')
      const arr = withoutNone.includes(value)
        ? withoutNone.filter((v) => v !== value)
        : [...withoutNone, value]
      return { ...prev, medicalConditions: arr }
    })
  }

  const isAnswered = () => {
    if (current.type === 'goals') return answers.goals.length > 0
    if (current.type === 'concerns') return answers.skinConcerns.length > 0 && !!answers.concernSeverity
    if (current.type === 'lifestyle') {
      return !!answers.occupation && !!answers.smoking && answers.medicalConditions.length > 0
    }
    if (current.type === 'profile') return !!answers.ageRange && !!answers.gender
    return false
  }

  const handleContinue = () => {
    if (step < STEPS.length - 1) setStep(step + 1)
    else onComplete()
  }

  const handleBack = () => {
    if (step > 0) setStep(step - 1)
    else onBack()
  }

  const selectionLabel =
    current.type === 'goals'
      ? `${answers.goals.length} of ${MAX_GOALS} goals selected`
      : current.type === 'concerns'
        ? `${answers.skinConcerns.length} concern${answers.skinConcerns.length !== 1 ? 's' : ''} selected`
        : current.type === 'lifestyle'
          ? answers.occupation && answers.smoking && answers.medicalConditions.length > 0
            ? 'Lifestyle profile complete'
            : ''
          : answers.ageRange && answers.gender
          ? 'Profile complete'
          : ''

  return (
    <OnboardingLayout
      stepIndex={step + 1}
      sidebarTitle={current.sidebarTitle}
      sidebarDesc={current.sidebarDesc}
      onBack={handleBack}
      selectionLabel={selectionLabel}
      footerHint={current.footerHint}
      onContinue={handleContinue}
      continueLabel={step < STEPS.length - 1 ? 'Continue' : 'Proceed to Upload'}
      continueDisabled={!isAnswered()}
    >
      <div className="max-w-3xl pt-2">
        <h2 className="font-display text-xl sm:text-2xl font-semibold text-white mb-1">{current.question}</h2>
        <p className="text-sm text-slate-500 mb-8">{current.hint}</p>

        {current.type === 'goals' && (
          <div className="grid sm:grid-cols-2 gap-3">
            {GOAL_OPTIONS.map((opt) => {
              const selected = answers.goals.includes(opt.value)
              const atMax = answers.goals.length >= MAX_GOALS && !selected
              return (
                <button
                  key={opt.value}
                  onClick={() => toggleGoal(opt.value)}
                  disabled={atMax}
                  className={`option-card flex items-start gap-3 p-5 ${selected ? 'option-card-selected' : ''} ${atMax ? 'opacity-40 cursor-not-allowed' : ''}`}
                >
                  <div
                    className={`mt-1 w-5 h-5 rounded-full border-2 shrink-0 transition-colors ${
                      selected ? 'border-accent bg-accent' : 'border-white/20'
                    }`}
                  />
                  <div className="text-left">
                    <div className="font-medium text-white text-sm">{opt.label}</div>
                    <div className="text-xs text-slate-500 mt-1">{opt.desc}</div>
                  </div>
                </button>
              )
            })}
          </div>
        )}

        {current.type === 'concerns' && (
          <>
            <div className="flex flex-wrap gap-2.5 mb-10">
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

            <h3 className="font-display text-base font-semibold text-white mb-1">
              How would you describe the overall severity of your skin concerns?
            </h3>
            <p className="text-xs text-slate-500 mb-5">Select one</p>
            <div className="flex flex-col sm:flex-row gap-3">
              {SEVERITY_OPTIONS.map((opt) => {
                const selected = answers.concernSeverity === opt.value
                return (
                  <button
                    key={opt.value}
                    onClick={() => setAnswers((prev) => ({ ...prev, concernSeverity: opt.value }))}
                    className={`severity-card ${selected ? 'severity-card-selected' : ''}`}
                  >
                    <div className={`font-semibold text-sm ${selected ? 'text-accent' : 'text-white'}`}>{opt.label}</div>
                    <div className="text-xs text-slate-500 mt-1">{opt.desc}</div>
                  </button>
                )
              })}
            </div>
          </>
        )}

        {current.type === 'lifestyle' && (
          <div className="space-y-8">
            <div>
              <h3 className="font-display text-base font-semibold text-white mb-1">What is your occupation?</h3>
              <p className="text-xs text-slate-500 mb-4">Select one</p>
              <div className="grid sm:grid-cols-2 gap-3">
                {OCCUPATION_OPTIONS.map((opt) => {
                  const selected = answers.occupation === opt.value
                  return (
                    <button
                      key={opt.value}
                      onClick={() => setAnswers((prev) => ({ ...prev, occupation: opt.value }))}
                      className={`option-card flex items-start gap-3 p-4 text-left ${selected ? 'option-card-selected' : ''}`}
                    >
                      <div
                        className={`mt-0.5 w-4 h-4 rounded-full border-2 shrink-0 ${
                          selected ? 'border-accent bg-accent' : 'border-white/20'
                        }`}
                      />
                      <div>
                        <div className="font-medium text-white text-sm">{opt.label}</div>
                        <div className="text-xs text-slate-500 mt-0.5">{opt.desc}</div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            <div>
              <h3 className="font-display text-base font-semibold text-white mb-1">How often do you smoke?</h3>
              <p className="text-xs text-slate-500 mb-4">Select one</p>
              <div className="flex flex-col sm:flex-row gap-3">
                {SMOKING_OPTIONS.map((opt) => {
                  const selected = answers.smoking === opt.value
                  return (
                    <button
                      key={opt.value}
                      onClick={() => setAnswers((prev) => ({ ...prev, smoking: opt.value }))}
                      className={`severity-card ${selected ? 'severity-card-selected' : ''}`}
                    >
                      <div className={`font-semibold text-sm ${selected ? 'text-accent' : 'text-white'}`}>{opt.label}</div>
                      <div className="text-xs text-slate-500 mt-1">{opt.desc}</div>
                    </button>
                  )
                })}
              </div>
            </div>

            <div>
              <h3 className="font-display text-base font-semibold text-white mb-1">Do you have any medical conditions?</h3>
              <p className="text-xs text-slate-500 mb-4">Select all that apply</p>
              <div className="flex flex-wrap gap-2.5">
                {MEDICAL_CONDITION_OPTIONS.map((opt) => {
                  const selected = answers.medicalConditions.includes(opt.value)
                  return (
                    <button
                      key={opt.value}
                      onClick={() => toggleMedical(opt.value)}
                      className={`chip-option ${selected ? 'chip-option-selected' : ''}`}
                    >
                      {opt.label}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {current.type === 'profile' && (
          <div className="space-y-8">
            <div>
              <h3 className="font-display text-base font-semibold text-white mb-1">What is your age range?</h3>
              <p className="text-xs text-slate-500 mb-4">Select one</p>
              <div className="flex flex-wrap gap-2.5">
                {AGE_OPTIONS.map((opt) => {
                  const selected = answers.ageRange === opt.value
                  return (
                    <button
                      key={opt.value}
                      onClick={() => setAnswers((prev) => ({ ...prev, ageRange: opt.value }))}
                      className={`chip-option min-w-[72px] text-center ${selected ? 'chip-option-selected' : ''}`}
                    >
                      {opt.label}
                    </button>
                  )
                })}
              </div>
            </div>

            <div>
              <h3 className="font-display text-base font-semibold text-white mb-1">How do you identify?</h3>
              <p className="text-xs text-slate-500 mb-4">Select one</p>
              <div className="grid sm:grid-cols-2 gap-3">
                {GENDER_OPTIONS.map((opt) => {
                  const selected = answers.gender === opt.value
                  return (
                    <button
                      key={opt.value}
                      onClick={() => setAnswers((prev) => ({ ...prev, gender: opt.value }))}
                      className={`option-card p-4 text-center text-sm font-medium ${selected ? 'option-card-selected text-accent' : 'text-slate-300'}`}
                    >
                      {opt.label}
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
