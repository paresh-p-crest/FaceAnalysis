import { useState, useEffect, useMemo } from 'react'
import {
  DRINKING_OPTIONS,
  GENDER_PREFERENCE_OPTIONS,
  TREATMENT_COMFORT_OPTIONS,
  GOAL_AESTHETIC_OPTIONS,
  AESTHETIC_DISTRESS_OPTIONS,
  APPEARANCE_FREQUENCY_OPTIONS,
  SMOKING_OPTIONS,
} from '../utils/onboarding'
import './Questionnaire.css'

export default function Questionnaire({ answers, setAnswers, onComplete, onBack, startAtEnd = false }) {
  const [currentIdx, setCurrentIdx] = useState(0)
  const [transitionKey, setTransitionKey] = useState(0)

  // Flat configuration of all questions (exactly QOVES reference flow)
  const QUESTIONS = useMemo(() => [
    {
      key: 'occupation',
      question: 'What is your occupation?',
      type: 'text',
      placeholder: 'Answer here',
    },
    {
      key: 'smoking',
      question: 'How often do you smoke?',
      type: 'select',
      options: SMOKING_OPTIONS,
    },
    {
      key: 'drinking',
      question: 'How often do you drink?',
      type: 'select',
      options: DRINKING_OPTIONS,
    },
    {
      key: 'genderPreference',
      question: 'Would you rather look more masculine or more feminine?',
      type: 'select',
      options: GENDER_PREFERENCE_OPTIONS,
    },
    {
      key: 'hadNonSurgical',
      question: 'Have you had any non-surgical aesthetic treatments before?',
      type: 'yes_no',
    },
    {
      key: 'hadSurgery',
      question: "We're strictly non-surgical, but for accuracy, have you ever undergone facial cosmetic surgery?",
      type: 'yes_no',
    },
    {
      key: 'comfortableTreatments',
      question: 'Please select all treatment types you are comfortable undergoing:',
      type: 'multi_select',
      options: TREATMENT_COMFORT_OPTIONS,
    },
    {
      key: 'medicalConditions',
      question: 'Do you have any medical conditions (e.g. autoimmune disorders, diabetes)?',
      type: 'details',
    },
    {
      key: 'medications',
      question: 'Are you taking any medications (prescription or over-the-counter)?',
      type: 'details',
    },
    {
      key: 'usedRetinoids',
      question: 'Have you used retinoids (e.g. Isotretinoin / Accutane) in the past 6-12 months?',
      type: 'yes_no',
    },
    {
      key: 'allergies',
      question: 'Do you have any allergies (especially to skincare ingredients, lidocaine, latex, dyes)?',
      type: 'details',
    },
    {
      key: 'activeInfections',
      question: 'Any active infections, cold sores, or skin conditions (e.g. Rosacea, Eczema, Psoriasis)?',
      type: 'details',
    },
    {
      key: 'proneToHyperpigmentation',
      question: 'Are you prone to hyperpigmentation?',
      type: 'yes_no',
    },
    {
      key: 'featureLike',
      question: 'What feature do you like the most about your face?',
      type: 'text',
      placeholder: 'Please list',
    },
    {
      key: 'featureDislike',
      question: 'What feature do you dislike the most about your face?',
      type: 'text',
      placeholder: 'Please list',
    },
    {
      key: 'celebrityMatch',
      question: "Are there any celebrities' facial aesthetics that you'd like to look like?",
      type: 'text',
      placeholder: 'Please list',
    },
    {
      key: 'comfortableWeightLoss',
      question: 'Are you comfortable with weight loss recommendations?',
      type: 'yes_no',
    },
    {
      key: 'goalAesthetic',
      question: 'What is your goal?',
      type: 'select',
      options: GOAL_AESTHETIC_OPTIONS,
    },
    {
      key: 'growBeard',
      question: 'Can you grow a full beard?',
      type: 'yes_no',
      condition: (ans) => ans.genderPreference === 'masculine',
    },
    {
      key: 'aestheticDistress',
      question: 'How much distress does your current facial aesthetic cause you?',
      type: 'select',
      options: AESTHETIC_DISTRESS_OPTIONS,
    },
    {
      key: 'appearanceFrequency',
      question: 'How often do you think about your appearance?',
      type: 'select',
      options: APPEARANCE_FREQUENCY_OPTIONS,
    },
    {
      key: 'motivation',
      question: 'What motivated you to sign up for QOVES?',
      type: 'textarea',
      placeholder: 'Answer here',
    },
    {
      key: 'additionalNotes',
      question: 'Anything else you think we should know?',
      type: 'textarea',
      placeholder: 'Answer here',
    },
  ], [])

  // Filter list of active questions dynamically based on branching
  const activeQuestions = useMemo(() => {
    return QUESTIONS.filter((q) => {
      if (q.condition) return q.condition(answers)
      return true
    })
  }, [QUESTIONS, answers])

  useEffect(() => {
    if (startAtEnd && activeQuestions.length > 0) {
      setCurrentIdx(activeQuestions.length - 1)
    }
  }, [startAtEnd, activeQuestions])

  const currentQuestion = activeQuestions[currentIdx]

  // Increment key to trigger css slide transitions
  useEffect(() => {
    setTransitionKey((prev) => prev + 1)
  }, [currentIdx])

  /* ── State Setter Helpers ── */
  const set = (key, value) => {
    setAnswers((prev) => {
      const next = { ...prev, [key]: value }
      if (key === 'genderPreference' && value !== 'masculine') {
        next.growBeard = 'no'
      }
      return next
    })
  }

  const setDetailsYesNo = (key, yesOrNo) => {
    setAnswers((prev) => ({
      ...prev,
      [key]: yesOrNo,
      [`${key}Details`]: yesOrNo === 'no' ? '' : (prev[`${key}Details`] || ''),
    }))
  }

  const setDetailsText = (key, text) => {
    setAnswers((prev) => ({
      ...prev,
      [`${key}Details`]: text,
    }))
  }

  const toggleMultiSelect = (key, val) => {
    setAnswers((prev) => {
      const arr = prev[key] || []
      const nextArr = arr.includes(val)
        ? arr.filter((x) => x !== val)
        : [...arr, val]
      return { ...prev, [key]: nextArr }
    })
  }

  /* ── Validation for current page ── */
  const isQuestionComplete = () => {
    if (!currentQuestion) return false
    const val = answers[currentQuestion.key]
    switch (currentQuestion.type) {
      case 'select':
      case 'yes_no':
        return !!val
      case 'multi_select':
        return val && val.length > 0
      case 'text':
        return val !== undefined && val !== null && val.trim().length > 0
      case 'textarea':
        if (currentQuestion.key === 'additionalNotes') return true
        return val !== undefined && val !== null && val.trim().length > 0
      case 'details': {
        const yesNo = answers[currentQuestion.key]
        if (!yesNo) return false
        if (yesNo === 'no') return true
        // yes selected — require at least 3 chars of detail
        const detailsText = (answers[`${currentQuestion.key}Details`] || '').trim()
        return detailsText.length >= 3
      }
      default:
        return false
    }
  }

  /* ── Nav Actions ── */
  const isLast = currentIdx === activeQuestions.length - 1

  const handleNext = () => {
    if (isLast) {
      onComplete()
    } else {
      setCurrentIdx((prev) => prev + 1)
    }
  }

  const handlePrev = () => {
    if (currentIdx > 0) {
      setCurrentIdx((prev) => prev - 1)
    } else {
      onBack()
    }
  }

  const handleInputFocus = (e) => {
    if (e.target.value === 'No') {
      e.target.select()
    }
  }

  if (!currentQuestion) return null

  return (
    <div className="min-h-screen flex bg-white dark:bg-slate-900 animate-fade-up">
      
      {/* ── Left Column: Questionnaire Wizard ── */}
      <div className="w-full lg:w-[40%] flex flex-col justify-between p-6 sm:p-16 bg-white dark:bg-slate-950 border-r border-surface-border">
        
        {/* Top Header */}
        <div className="flex items-center justify-between">
          <button
            onClick={handlePrev}
            className="flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors uppercase tracking-wider"
          >
            ← Back
          </button>
          
          {/* Boxed Counter */}
          <div className="flex items-center gap-1.5 text-xs font-bold font-mono">
            <span className="px-2.5 py-1 rounded bg-[#5e9f8b] text-white">
              {currentIdx + 1}
            </span>
            <span className="text-slate-400">/</span>
            <span className="px-2.5 py-1 rounded border border-slate-200 dark:border-slate-800 text-slate-500 bg-slate-50 dark:bg-slate-900">
              {activeQuestions.length}
            </span>
          </div>
        </div>

        {/* Question Panel */}
        <div key={transitionKey} className="my-auto py-12 max-w-lg fade-in-slide space-y-8">
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white leading-tight tracking-tight">
            {currentQuestion.question}
          </h1>

          {/* Render inputs based on type */}
          <div className="space-y-3">
            
            {/* Type: select */}
            {currentQuestion.type === 'select' && currentQuestion.options && (
              <div className="space-y-2">
                {currentQuestion.options.map((opt) => {
                  const selected = answers[currentQuestion.key] === opt.value
                  return (
                    <button
                      key={opt.value}
                      onClick={() => set(currentQuestion.key, opt.value)}
                      className={`w-full flex items-center justify-between p-4 rounded-xl border text-left transition-all ${
                        selected
                          ? 'border-[#5e9f8b] bg-[#5e9f8b]/10 dark:bg-[#5e9f8b]/10 text-[#5e9f8b] dark:text-[#5e9f8b] font-medium'
                          : 'border-slate-200 dark:border-slate-800 hover:border-slate-400 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <div className="pr-4">
                        <span className="text-sm">{opt.label}</span>
                        {opt.desc && <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{opt.desc}</p>}
                      </div>
                      <div className={`w-4 h-4 rounded-full border shrink-0 transition-all flex items-center justify-center ${
                        selected ? 'border-[#5e9f8b] dark:border-[#5e9f8b]' : 'border-slate-300 dark:border-slate-700'
                      }`}>
                        {selected && <div className="w-2 h-2 rounded-full bg-[#5e9f8b] dark:bg-[#5e9f8b]" />}
                      </div>
                    </button>
                  )
                })}
              </div>
            )}

            {/* Type: yes_no */}
            {currentQuestion.type === 'yes_no' && (
              <div className="space-y-2">
                {[
                  { value: 'yes', label: 'Yes' },
                  { value: 'no', label: 'No' },
                ].map((opt) => {
                  const selected = answers[currentQuestion.key] === opt.value
                  return (
                    <button
                      key={opt.value}
                      onClick={() => set(currentQuestion.key, opt.value)}
                      className={`w-full flex items-center justify-between p-4 rounded-xl border text-left transition-all ${
                        selected
                          ? 'border-[#5e9f8b] bg-[#5e9f8b]/10 dark:bg-[#5e9f8b]/10 text-[#5e9f8b] dark:text-[#5e9f8b] font-medium'
                          : 'border-slate-200 dark:border-slate-800 hover:border-slate-400 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <span className="text-sm">{opt.label}</span>
                      <div className={`w-4 h-4 rounded-full border shrink-0 transition-all flex items-center justify-center ${
                        selected ? 'border-[#5e9f8b] dark:border-[#5e9f8b]' : 'border-slate-300 dark:border-slate-700'
                      }`}>
                        {selected && <div className="w-2 h-2 rounded-full bg-[#5e9f8b] dark:bg-[#5e9f8b]" />}
                      </div>
                    </button>
                  )
                })}
              </div>
            )}

            {/* Type: multi_select */}
            {currentQuestion.type === 'multi_select' && currentQuestion.options && (
              <div className="space-y-2">
                {currentQuestion.options.map((opt) => {
                  const selected = (answers[currentQuestion.key] || []).includes(opt.value)
                  return (
                    <button
                      key={opt.value}
                      onClick={() => toggleMultiSelect(currentQuestion.key, opt.value)}
                      className={`w-full flex items-center justify-between p-4 rounded-xl border text-left transition-all ${
                        selected
                          ? 'border-[#5e9f8b] bg-[#5e9f8b]/10 dark:bg-[#5e9f8b]/10 text-[#5e9f8b] dark:text-[#5e9f8b] font-medium'
                          : 'border-slate-200 dark:border-slate-800 hover:border-slate-400 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <div className="pr-4">
                        <span className="text-sm">{opt.label}</span>
                        {opt.desc && <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{opt.desc}</p>}
                      </div>
                      <div className={`w-4 h-4 rounded border shrink-0 transition-all flex items-center justify-center ${
                        selected ? 'border-[#5e9f8b] dark:border-[#5e9f8b] bg-[#5e9f8b] dark:bg-[#5e9f8b] text-white' : 'border-slate-300 dark:border-slate-700'
                      }`}>
                        {selected && <span className="text-[10px] font-bold">✓</span>}
                      </div>
                    </button>
                  )
                })}
              </div>
            )}

            {/* Type: text */}
            {currentQuestion.type === 'text' && (
              <input
                type="text"
                value={answers[currentQuestion.key] || ''}
                onChange={(e) => set(currentQuestion.key, e.target.value)}
                placeholder={currentQuestion.placeholder}
                className="w-full bg-transparent border-t-0 border-r-0 border-l-0 border-b border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:ring-0 focus:border-[#5e9f8b] dark:focus:border-[#5e9f8b] py-3 px-0 text-xl rounded-none outline-none transition-all"
              />
            )}

            {/* Type: details — Yes/No buttons + conditional detail input */}
            {currentQuestion.type === 'details' && (
              <div className="space-y-3">
                {['yes', 'no'].map((opt) => {
                  const selected = answers[currentQuestion.key] === opt
                  return (
                    <button
                      key={opt}
                      onClick={() => setDetailsYesNo(currentQuestion.key, opt)}
                      className={`w-full flex items-center justify-between p-4 rounded-xl border text-left transition-all ${
                        selected
                          ? 'border-[#5e9f8b] bg-[#5e9f8b]/10 dark:bg-[#5e9f8b]/10 text-[#5e9f8b] dark:text-[#5e9f8b] font-medium'
                          : 'border-slate-200 dark:border-slate-800 hover:border-slate-400 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <span className="text-sm capitalize">{opt === 'yes' ? 'Yes' : 'No'}</span>
                      <div className={`w-4 h-4 rounded-full border shrink-0 transition-all flex items-center justify-center ${
                        selected ? 'border-[#5e9f8b] dark:border-[#5e9f8b]' : 'border-slate-300 dark:border-slate-700'
                      }`}>
                        {selected && <div className="w-2 h-2 rounded-full bg-[#5e9f8b] dark:bg-[#5e9f8b]" />}
                      </div>
                    </button>
                  )
                })}
                {answers[currentQuestion.key] === 'yes' && (
                  <textarea
                    autoFocus
                    value={answers[`${currentQuestion.key}Details`] || ''}
                    onChange={(e) => setDetailsText(currentQuestion.key, e.target.value)}
                    placeholder="Please provide details…"
                    className="w-full mt-2 bg-transparent border-t-0 border-r-0 border-l-0 border-b border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:ring-0 focus:border-[#5e9f8b] dark:focus:border-[#5e9f8b] py-3 px-0 text-base rounded-none outline-none transition-all resize-none min-h-[80px]"
                  />
                )}
              </div>
            )}

            {/* Type: textarea */}
            {currentQuestion.type === 'textarea' && (
              <textarea
                value={answers[currentQuestion.key] || ''}
                onChange={(e) => set(currentQuestion.key, e.target.value)}
                placeholder={currentQuestion.placeholder}
                className="w-full bg-transparent border-t-0 border-r-0 border-l-0 border-b border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:ring-0 focus:border-[#5e9f8b] dark:focus:border-[#5e9f8b] py-3 px-0 text-lg rounded-none outline-none transition-all resize-none min-h-[100px]"
              />
            )}

          </div>
        </div>

        {/* Navigation buttons */}
        <div className="flex items-center gap-4">
          <button
            onClick={handlePrev}
            className="flex-1 flex items-center justify-center border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 py-3 rounded-[50px] text-sm font-medium transition-all"
          >
            ← Back
          </button>
          
          <button
            onClick={handleNext}
            disabled={!isQuestionComplete()}
            className="flex-1 flex items-center bg-[#5e9f8b] hover:bg-[#548f7d] text-white px-6 py-3 rounded-[50px] text-sm font-medium tracking-[-0.03px] transition-all shadow-sm disabled:opacity-40 disabled:pointer-events-none"
          >
            <span className="flex-1 text-left">Next</span>
            <span className="text-white/40 mr-4">|</span>
            <span>→</span>
          </button>
        </div>

      </div>

      {/* ── Right Column: Fluid Wavy Mesh Gradient ── */}
      <div className="hidden lg:flex lg:w-[60%] bg-[#0d1e1f] fluid-gradient-mesh flex-col justify-between p-16">
        
        {/* Top Brand Logo - MyFace text */}
        <div className="flex items-center gap-3">
          <span className="font-serif font-bold text-white text-3xl tracking-tight">MyFace</span>
        </div>

        {/* Bottom Banner Branding */}
        <div className="space-y-6 max-w-xl text-left">
          <div className="inline-block px-3 py-1 rounded-full border border-white/20 text-white/80 font-mono text-[10px] uppercase tracking-wider bg-white/5 backdrop-blur-md">
            Complete the questionnaire
          </div>
          <h1 className="font-display text-5xl font-bold text-white tracking-tight leading-tight">
            Onboarding<br />Questions
          </h1>
          <p className="text-sm text-slate-300 leading-relaxed max-w-md">
            Please answer the following questions to help us customize your MyFace journey.
          </p>
        </div>

      </div>

    </div>
  )
}
