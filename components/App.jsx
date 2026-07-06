'use client'

import { useState, useCallback } from 'react'
import { STAGES, INITIAL_ANSWERS } from '../utils/constants'
import { runFaceAnalysis } from '../utils/analyzeFace'
import { setActiveProvider } from '../utils/settings'
import Landing from './Landing'
import Questionnaire from './Questionnaire'
import PhotoProtocol from './PhotoProtocol'
import PhotoUpload from './PhotoUpload'
import Scanning from './Scanning'
import Report from './Report'
import HistoryPage from './HistoryPage'
import Settings from './Settings'
import { TopNav } from './TopNav'
import { ThemeProvider } from '../utils/theme'

const EMPTY_PHOTOS = { front: null, leftProfile: null, rightProfile: null, left45: null, right45: null, smile: null, topHead: null }

export default function App() {
  return (
    <ThemeProvider>
      <AppInner />
    </ThemeProvider>
  )
}

function AppInner() {
  const [stage, setStage] = useState(STAGES.LANDING)
  const [answers, setAnswers] = useState(INITIAL_ANSWERS)
  const [photos, setPhotos] = useState(EMPTY_PHOTOS)
  const [analysis, setAnalysis] = useState(null)
  const [historyId, setHistoryId] = useState(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [returnStage, setReturnStage] = useState(STAGES.LANDING)

  const primaryPhoto = photos.front
  const showNav = stage !== STAGES.SCANNING

  const restart = useCallback(() => {
    setStage(STAGES.LANDING)
    setAnswers(INITIAL_ANSWERS)
    setPhotos(EMPTY_PHOTOS)
    setAnalysis(null)
    setHistoryId(null)
  }, [])

  const handleScanComplete = useCallback((result) => {
    setAnalysis(result)
    setHistoryId(null)
    setStage(STAGES.REPORT)
  }, [])

  const handleRetryLocal = useCallback(async (retryPhoto, retryPhotos, retryAnswers) => {
    const prevProvider = setActiveProvider('local')
    setStage(STAGES.SCANNING)
    try {
      const result = await runFaceAnalysis(retryPhoto, retryAnswers, retryPhotos)
      setAnalysis(result)
      setHistoryId(null)
      setStage(STAGES.REPORT)
    } catch {
      setActiveProvider(prevProvider)
      setStage(STAGES.REPORT)
    }
  }, [])

  const openHistory = () => {
    setReturnStage(stage)
    setStage(STAGES.HISTORY)
  }

  const viewHistoryItem = (id) => {
    setHistoryId(id)
    setStage(STAGES.REPORT)
  }

  const afterQuestionnaire = () => {
    setStage(STAGES.UPLOAD)
  }

  return (
    <div className="relative min-h-screen overflow-x-hidden font-sans">
      {showNav && stage !== STAGES.REPORT && (
        <TopNav onHistory={openHistory} onSettings={() => setSettingsOpen(true)} />
      )}
      <Settings open={settingsOpen} onClose={() => setSettingsOpen(false)} />

      <div className="fixed top-1/4 -left-32 w-64 h-64 rounded-full bg-brand-50/50 blur-3xl pointer-events-none dark:opacity-30" />
      <div className="fixed bottom-1/4 -right-32 w-80 h-80 rounded-full bg-brand-50/50 blur-3xl pointer-events-none dark:opacity-30" />

      {stage === STAGES.LANDING && (
        <Landing onBegin={() => setStage(STAGES.QUESTIONNAIRE)} />
      )}

      {stage === STAGES.QUESTIONNAIRE && (
        <Questionnaire
          answers={answers}
          setAnswers={setAnswers}
          onComplete={afterQuestionnaire}
          onBack={() => setStage(STAGES.LANDING)}
        />
      )}

      {stage === STAGES.PROTOCOL && (
        <PhotoProtocol
          onComplete={() => setStage(STAGES.UPLOAD)}
          onBack={() => setStage(STAGES.QUESTIONNAIRE)}
        />
      )}

      {stage === STAGES.UPLOAD && (
        <PhotoUpload
          photos={photos}
          setPhotos={setPhotos}
          onStartAnalysis={() => setStage(STAGES.SCANNING)}
          onBack={() => setStage(STAGES.QUESTIONNAIRE)}
        />
      )}

      {stage === STAGES.SCANNING && (
        <Scanning
          photo={primaryPhoto}
          photos={photos}
          answers={answers}
          onComplete={handleScanComplete}
        />
      )}

      {stage === STAGES.HISTORY && (
        <HistoryPage
          onBack={() => setStage(returnStage)}
          onViewItem={viewHistoryItem}
        />
      )}

      {stage === STAGES.REPORT && (
        <Report
          photo={primaryPhoto}
          photos={photos}
          answers={answers}
          analysis={analysis}
          historyId={historyId}
          onRestart={restart}
          onRetryLocal={handleRetryLocal}
          onHistory={openHistory}
          onSettings={() => setSettingsOpen(true)}
        />
      )}
    </div>
  )
}
