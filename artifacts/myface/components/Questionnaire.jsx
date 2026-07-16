'use client'

import { useState, useEffect, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import {
  DRINKING_OPTIONS,
  GENDER_PREFERENCE_OPTIONS,
  TREATMENT_COMFORT_OPTIONS,
  GOAL_AESTHETIC_OPTIONS,
  AESTHETIC_DISTRESS_OPTIONS,
  APPEARANCE_FREQUENCY_OPTIONS,
  SMOKING_OPTIONS,
  optionLabel,
  optionDescription,
} from '../utils/onboarding'
import './Questionnaire.css'

export default function Questionnaire({ answers, setAnswers, onComplete, onBack, startAtEnd = false }) {
  const t = useTranslations('Questionnaire')
  const tWelcome = useTranslations('Questionnaire.welcome')
  const tOnboarding = useTranslations('Onboarding')
  const [currentIdx, setCurrentIdx] = useState(0)
  const [transitionKey, setTransitionKey] = useState(0)

  const QUESTIONS = useMemo(() => [
    { key: 'occupation', questionKey: 'questions.occupation', type: 'text', placeholderKey: 'common.answerHere' },
    { key: 'smoking', questionKey: 'questions.smoking', type: 'select', options: SMOKING_OPTIONS },
    { key: 'drinking', questionKey: 'questions.drinking', type: 'select', options: DRINKING_OPTIONS },
    { key: 'genderPreference', questionKey: 'questions.genderPreference', type: 'select', options: GENDER_PREFERENCE_OPTIONS },
    { key: 'hadNonSurgical', questionKey: 'questions.hadNonSurgical', type: 'yes_no' },
    { key: 'hadSurgery', questionKey: 'questions.hadSurgery', type: 'yes_no' },
    { key: 'comfortableTreatments', questionKey: 'questions.comfortableTreatments', type: 'multi_select', options: TREATMENT_COMFORT_OPTIONS },
    { key: 'medicalConditions', questionKey: 'questions.medicalConditions', type: 'details' },
    { key: 'medications', questionKey: 'questions.medications', type: 'details' },
    { key: 'usedRetinoids', questionKey: 'questions.usedRetinoids', type: 'yes_no' },
    { key: 'allergies', questionKey: 'questions.allergies', type: 'details' },
    { key: 'activeInfections', questionKey: 'questions.activeInfections', type: 'details' },
    { key: 'proneToHyperpigmentation', questionKey: 'questions.proneToHyperpigmentation', type: 'yes_no' },
    { key: 'featureLike', questionKey: 'questions.featureLike', type: 'text', placeholderKey: 'common.pleaseList' },
    { key: 'featureDislike', questionKey: 'questions.featureDislike', type: 'text', placeholderKey: 'common.pleaseList' },
    { key: 'celebrityMatch', questionKey: 'questions.celebrityMatch', type: 'text', placeholderKey: 'common.pleaseList' },
    { key: 'comfortableWeightLoss', questionKey: 'questions.comfortableWeightLoss', type: 'yes_no' },
    { key: 'goalAesthetic', questionKey: 'questions.goalAesthetic', type: 'select', options: GOAL_AESTHETIC_OPTIONS },
    { key: 'growBeard', questionKey: 'questions.growBeard', type: 'yes_no', condition: (ans) => ans.genderPreference === 'masculine' },
    { key: 'aestheticDistress', questionKey: 'questions.aestheticDistress', type: 'select', options: AESTHETIC_DISTRESS_OPTIONS },
    { key: 'appearanceFrequency', questionKey: 'questions.appearanceFrequency', type: 'select', options: APPEARANCE_FREQUENCY_OPTIONS },
    { key: 'motivation', questionKey: 'questions.motivation', type: 'textarea', placeholderKey: 'common.answerHere' },
    { key: 'additionalNotes', questionKey: 'questions.additionalNotes', type: 'textarea', placeholderKey: 'common.answerHere' },
  ], [])

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

  useEffect(() => {
    setTransitionKey((prev) => prev + 1)
  }, [currentIdx])

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
        const detailsText = (answers[`${currentQuestion.key}Details`] || '').trim()
        return detailsText.length >= 3
      }
      default:
        return false
    }
  }

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

  if (!currentQuestion) return null

  const yesNoOptions = [
    { value: 'yes', label: t('common.yes') },
    { value: 'no', label: t('common.no') },
  ]

  return (
    <div className="min-h-screen flex bg-white dark:bg-slate-900 animate-fade-up">

      <div className="w-full lg:w-[40%] flex flex-col justify-between p-6 sm:p-16 bg-white dark:bg-slate-950 border-r border-surface-border">

        <div className="flex items-center justify-between">
          <button
            onClick={handlePrev}
            className="flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors uppercase tracking-wider"
          >
            {t('common.back')}
          </button>

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

        <div key={transitionKey} className="my-auto py-12 max-w-lg fade-in-slide space-y-8">
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white leading-tight tracking-tight">
            {t(currentQuestion.questionKey)}
          </h1>

          <div className="space-y-3">

            {currentQuestion.type === 'select' && currentQuestion.options && (
              <div className="space-y-2">
                {currentQuestion.options.map((opt) => {
                  const selected = answers[currentQuestion.key] === opt.value
                  const desc = optionDescription(opt, tOnboarding)
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
                        <span className="text-sm">{optionLabel(opt, tOnboarding)}</span>
                        {desc && <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{desc}</p>}
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

            {currentQuestion.type === 'yes_no' && (
              <div className="space-y-2">
                {yesNoOptions.map((opt) => {
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

            {currentQuestion.type === 'multi_select' && currentQuestion.options && (
              <div className="space-y-2">
                {currentQuestion.options.map((opt) => {
                  const selected = (answers[currentQuestion.key] || []).includes(opt.value)
                  const desc = optionDescription(opt, tOnboarding)
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
                        <span className="text-sm">{optionLabel(opt, tOnboarding)}</span>
                        {desc && <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{desc}</p>}
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

            {currentQuestion.type === 'text' && (
              <input
                type="text"
                value={answers[currentQuestion.key] || ''}
                onChange={(e) => set(currentQuestion.key, e.target.value)}
                placeholder={currentQuestion.placeholderKey ? t(currentQuestion.placeholderKey) : undefined}
                className="w-full bg-transparent border-t-0 border-r-0 border-l-0 border-b border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:ring-0 focus:border-[#5e9f8b] dark:focus:border-[#5e9f8b] py-3 px-0 text-xl rounded-none outline-none transition-all"
              />
            )}

            {currentQuestion.type === 'details' && (
              <div className="space-y-3">
                {yesNoOptions.map((opt) => {
                  const selected = answers[currentQuestion.key] === opt.value
                  return (
                    <button
                      key={opt.value}
                      onClick={() => setDetailsYesNo(currentQuestion.key, opt.value)}
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
                {answers[currentQuestion.key] === 'yes' && (
                  <textarea
                    autoFocus
                    value={answers[`${currentQuestion.key}Details`] || ''}
                    onChange={(e) => setDetailsText(currentQuestion.key, e.target.value)}
                    placeholder={t('common.pleaseProvideDetails')}
                    className="w-full mt-2 bg-transparent border-t-0 border-r-0 border-l-0 border-b border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:ring-0 focus:border-[#5e9f8b] dark:focus:border-[#5e9f8b] py-3 px-0 text-base rounded-none outline-none transition-all resize-none min-h-[80px]"
                  />
                )}
              </div>
            )}

            {currentQuestion.type === 'textarea' && (
              <textarea
                value={answers[currentQuestion.key] || ''}
                onChange={(e) => set(currentQuestion.key, e.target.value)}
                placeholder={currentQuestion.placeholderKey ? t(currentQuestion.placeholderKey) : undefined}
                className="w-full bg-transparent border-t-0 border-r-0 border-l-0 border-b border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:ring-0 focus:border-[#5e9f8b] dark:focus:border-[#5e9f8b] py-3 px-0 text-lg rounded-none outline-none transition-all resize-none min-h-[100px]"
              />
            )}

          </div>
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={handlePrev}
            className="flex-1 flex items-center justify-center border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 py-3 rounded-[50px] text-sm font-medium transition-all"
          >
            {t('common.back')}
          </button>

          <button
            onClick={handleNext}
            disabled={!isQuestionComplete()}
            className="flex-1 flex items-center bg-[#5e9f8b] hover:bg-[#548f7d] text-white px-6 py-3 rounded-[50px] text-sm font-medium tracking-[-0.03px] transition-all shadow-sm disabled:opacity-40 disabled:pointer-events-none"
          >
            <span className="flex-1 text-left">{t('common.next')}</span>
            <span className="text-white/40 mr-4">|</span>
            <span>→</span>
          </button>
        </div>

      </div>

      <div className="hidden lg:flex lg:w-[60%] bg-[#0d1e1f] fluid-gradient-mesh flex-col justify-between p-16">

        <div className="flex items-center gap-3">
          <span className="font-serif font-bold text-white text-3xl tracking-tight">MyFace</span>
        </div>

        <div className="space-y-6 max-w-xl text-left">
          <div className="inline-block px-3 py-1 rounded-full border border-white/20 text-white/80 font-mono text-[10px] uppercase tracking-wider bg-white/5 backdrop-blur-md">
            {tWelcome('sidebarBadge')}
          </div>
          <h1 className="font-display text-5xl font-bold text-white tracking-tight leading-tight whitespace-pre-line">
            {tWelcome('sidebarTitle')}
          </h1>
          <p className="text-sm text-slate-300 leading-relaxed max-w-md">
            {tWelcome('sidebarDescription')}
          </p>
        </div>

      </div>

    </div>
  )
}
