'use client'

import QuestionnaireWelcome from '../QuestionnaireWelcome'
import Questionnaire from '../Questionnaire'
import PhotoUpload from '../PhotoUpload'
import AnalysisPreparing from './AnalysisPreparing'
import { useApp } from '../providers/AppProvider'
import { ANALYSIS_STEPS } from '../../utils/routes'

export function AnalysisFlow() {
  const {
    user,
    answers,
    setAnswers,
    photos,
    setPhotos,
    primaryPhoto,
    analysisStep,
    questionnaireStartAtEnd,
    setQuestionnaireStartAtEnd,
    openDashboard,
    startNewAnalysis,
    goToQuestionnaire,
    goToConfirm,
    goToUpload,
    goToWelcome,
    ensureDraft,
    draftAssessmentId,
    submitAnalysis,
    submitError,
    preparingAssessmentId,
    handlePreparingReady,
    handlePreparingDashboard,
  } = useApp()

  if (user?.role === 'admin') return null

  switch (analysisStep) {
    case ANALYSIS_STEPS.WELCOME:
      return (
        <QuestionnaireWelcome
          onBegin={startNewAnalysis}
          onBackToDashboard={user ? openDashboard : undefined}
        />
      )
    case ANALYSIS_STEPS.QUESTIONNAIRE:
      return (
        <Questionnaire
          answers={answers}
          setAnswers={setAnswers}
          onComplete={goToConfirm}
          onBack={goToWelcome}
          startAtEnd={questionnaireStartAtEnd}
        />
      )
    case ANALYSIS_STEPS.CONFIRM:
      return (
        <PhotoUpload
          step="instructions"
          photos={photos}
          setPhotos={setPhotos}
          onConfirmComplete={goToUpload}
          onBack={() => {
            setQuestionnaireStartAtEnd(true)
            goToQuestionnaire()
          }}
          onStartAnalysis={() => {}}
        />
      )
    case ANALYSIS_STEPS.UPLOAD:
      return (
        <PhotoUpload
          step="upload"
          photos={photos}
          setPhotos={setPhotos}
          ensureDraft={ensureDraft}
          draftAssessmentId={draftAssessmentId}
          onStartAnalysis={submitAnalysis}
          submitError={submitError}
          onBack={goToConfirm}
        />
      )
    case ANALYSIS_STEPS.PREPARING:
      return (
        <AnalysisPreparing
          assessmentId={preparingAssessmentId}
          photo={primaryPhoto}
          onGoToDashboard={handlePreparingDashboard}
          onReady={handlePreparingReady}
        />
      )
    default:
      return (
        <QuestionnaireWelcome
          onBegin={startNewAnalysis}
          onBackToDashboard={user ? openDashboard : undefined}
        />
      )
  }
}
