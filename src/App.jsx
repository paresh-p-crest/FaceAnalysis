import { useState, useCallback } from 'react'
import { STAGES, INITIAL_ANSWERS } from './utils/constants'
import { isDemoMode } from './utils/appMode'
import Landing from './components/Landing'
import Questionnaire from './components/Questionnaire'
import PhotoProtocol from './components/PhotoProtocol'
import PhotoUpload from './components/PhotoUpload'
import Scanning from './components/Scanning'
import Report from './components/Report'
import HistoryPage from './components/HistoryPage'
import Settings from './components/Settings'
import { TopNav } from './components/TopNav'

const EMPTY_PHOTOS = { front: null, profile: null }

export default function App() {
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

  const openHistory = () => {
    setReturnStage(stage)
    setStage(STAGES.HISTORY)
  }

  const viewHistoryItem = (id) => {
    setHistoryId(id)
    setStage(STAGES.REPORT)
  }

  const afterQuestionnaire = () => {
    setStage(isDemoMode() ? STAGES.PROTOCOL : STAGES.UPLOAD)
  }

  return (
    <div className="relative min-h-screen overflow-x-hidden font-sans">
      {showNav && (
        <TopNav onHistory={openHistory} onSettings={() => setSettingsOpen(true)} />
      )}
      <Settings open={settingsOpen} onClose={() => setSettingsOpen(false)} />

      <div className="fixed top-1/4 -left-32 w-64 h-64 rounded-full bg-accent/5 blur-3xl pointer-events-none" />
      <div className="fixed bottom-1/4 -right-32 w-80 h-80 rounded-full bg-accent/5 blur-3xl pointer-events-none" />

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
          onBack={() => setStage(isDemoMode() ? STAGES.PROTOCOL : STAGES.QUESTIONNAIRE)}
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
        />
      )}
    </div>
  )
}
