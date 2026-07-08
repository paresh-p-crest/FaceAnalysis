'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
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
import BillingPage from './BillingPage'
import DashboardPage from './DashboardPage'
import AdminPanelPage from './AdminPanelPage'
import PaymentSuccessPage from './PaymentSuccessPage'
import Settings from './Settings'
import AuthModal from './AuthModal'
import { TopNav } from './TopNav'
import { ThemeProvider } from '../utils/theme'
import { clearSession, fetchCurrentUser, getStoredUser } from '../utils/authClient'
import { fetchAssessment, isBackendApiEnabled, confirmStripeCheckout } from '../utils/apiClient'
import { trackEvent } from '../utils/analytics'
import { clearAdminTab, persistAdminTab, readAdminTab } from '../utils/adminPanel'
import { createHistoryId } from '../utils/historyStorage'
import { userHasAnalysisAccess } from '../utils/paymentAccess'
import ConfirmDialog from './ConfirmDialog'

const EMPTY_PHOTOS = { front: null, leftProfile: null, rightProfile: null, left45: null, right45: null, smile: null, topHead: null }
const STAGE_STORAGE_KEY = 'aurascan_current_stage'
const REPORT_STORAGE_KEY = 'aurascan_current_assessment_id'
const PAYMENT_SESSION_KEY = 'aurascan_payment_session_id'
const RESTORABLE_STAGES = new Set([
  STAGES.LANDING,
  STAGES.DASHBOARD,
  STAGES.ADMIN,
  STAGES.HISTORY,
  STAGES.BILLING,
  STAGES.PAYMENT_SUCCESS,
  STAGES.REPORT,
])

const CLIENT_FLOW_STAGES = new Set([
  STAGES.LANDING,
  STAGES.QUESTIONNAIRE,
  STAGES.PROTOCOL,
  STAGES.UPLOAD,
  STAGES.SCANNING,
  STAGES.DASHBOARD,
  STAGES.HISTORY,
  STAGES.BILLING,
  STAGES.PAYMENT_SUCCESS,
])

function resolveStageForRole(nextStage, role) {
  if (role !== 'admin') return nextStage
  if (nextStage === STAGES.ADMIN || nextStage === STAGES.REPORT) return nextStage
  return STAGES.ADMIN
}

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
  const [authOpen, setAuthOpen] = useState(false)
  const [user, setUser] = useState(null)
  const [returnStage, setReturnStage] = useState(STAGES.LANDING)
  const [billingMessage, setBillingMessage] = useState('')
  const [paymentReturn, setPaymentReturn] = useState(null)
  const [adminTab, setAdminTab] = useState(() => readAdminTab())
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false)
  const [scanId, setScanId] = useState(null)
  const activeScanIdRef = useRef(null)
  const stageRef = useRef(stage)

  useEffect(() => {
    stageRef.current = stage
  }, [stage])

  const primaryPhoto = photos.front
  const currentAssessmentId = analysis?.assessmentId || null
  const showNav = stage !== STAGES.SCANNING

  const getCloudAssessmentPhoto = (assessment) => {
    const report = assessment?.analysis?.cvReport
    return (
      report?.faceShape?.imageSrc ||
      report?.symmetry?.imageSrc ||
      report?.proportions?.imageSrc ||
      report?.nose?.imageSrc ||
      null
    )
  }

  function applyCloudAssessment(assessment) {
    const cloudPhoto = getCloudAssessmentPhoto(assessment)
    setAnswers(assessment.answers || INITIAL_ANSWERS)
    setPhotos({ ...EMPTY_PHOTOS, front: cloudPhoto })
    setAnalysis({
      ...(assessment.analysis || {}),
      assessmentId: assessment.id,
      savedToDb: true,
      reportStatus: assessment.status || 'pending_review',
      aiNarrative: assessment.aiNarrative || assessment.analysis?.aiNarrative || null,
      aiVisuals: assessment.aiVisuals || assessment.analysis?.aiVisuals || null,
    })
    setHistoryId(null)
    setStage(STAGES.REPORT)
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const payment = params.get('payment')
    const sessionId = params.get('session_id')
    const savedStage = localStorage.getItem(STAGE_STORAGE_KEY)
    const savedAssessmentId = localStorage.getItem(REPORT_STORAGE_KEY)
    let restored = false
    const storedUser = getStoredUser()
    setUser(storedUser)

    if (payment === 'stripe-success' || (sessionId && sessionId.startsWith('cs_'))) {
      const sid = sessionId || localStorage.getItem(PAYMENT_SESSION_KEY)
      if (sid) localStorage.setItem(PAYMENT_SESSION_KEY, sid)
      setPaymentReturn({ provider: 'stripe', sessionId: sid })
      setReturnStage(STAGES.BILLING)
      setStage(STAGES.PAYMENT_SUCCESS)
      window.history.replaceState({}, '', window.location.pathname)
      restored = true
      if (sid && storedUser && isBackendApiEnabled()) {
        confirmStripeCheckout(sid).catch(() => {})
      }
    } else if (payment === 'stripe-cancel') {
      setBillingMessage('Payment was cancelled. You can restart checkout when ready.')
      setReturnStage(STAGES.LANDING)
      setStage(STAGES.BILLING)
      window.history.replaceState({}, '', window.location.pathname)
      restored = true
    }

    if (!restored && localStorage.getItem(PAYMENT_SESSION_KEY)) {
      const sid = localStorage.getItem(PAYMENT_SESSION_KEY)
      setPaymentReturn({ provider: 'stripe', sessionId: sid })
      setReturnStage(STAGES.BILLING)
      setStage(STAGES.PAYMENT_SUCCESS)
      restored = true
      if (sid && storedUser && isBackendApiEnabled()) {
        confirmStripeCheckout(sid).catch(() => {})
      }
    }

    if (!restored && savedStage && RESTORABLE_STAGES.has(savedStage)) {
      if (savedStage === STAGES.REPORT && savedAssessmentId && isBackendApiEnabled()) {
        fetchAssessment(savedAssessmentId)
          .then(applyCloudAssessment)
          .catch(() => setStage(resolveStageForRole(STAGES.LANDING, storedUser?.role)))
        restored = true
      } else if (savedStage !== STAGES.REPORT) {
        const nextStage = resolveStageForRole(savedStage, storedUser?.role)
        setStage(nextStage)
        if (nextStage === STAGES.ADMIN) {
          setAdminTab(readAdminTab())
        }
        if (nextStage === STAGES.PAYMENT_SUCCESS) {
          const sid = localStorage.getItem(PAYMENT_SESSION_KEY)
          if (sid) setPaymentReturn({ provider: 'stripe', sessionId: sid })
        }
        restored = true
      }
    }

    if (!restored && storedUser?.role === 'admin') {
      setStage(STAGES.ADMIN)
      setAdminTab(readAdminTab())
    }
    fetchCurrentUser().then((currentUser) => {
      if (currentUser) {
        setUser(currentUser)
        if (!restored && currentUser.role === 'admin') {
          setStage(STAGES.ADMIN)
          setAdminTab(readAdminTab())
        }
      }
    })
  }, [])

  useEffect(() => {
    if (!RESTORABLE_STAGES.has(stage)) return
    const persistedStage = resolveStageForRole(stage, user?.role)
    localStorage.setItem(STAGE_STORAGE_KEY, persistedStage)
    if (stage === STAGES.REPORT && currentAssessmentId) {
      localStorage.setItem(REPORT_STORAGE_KEY, currentAssessmentId)
    }
  }, [stage, currentAssessmentId, user?.role])

  useEffect(() => {
    if (user?.role !== 'admin') return
    if (CLIENT_FLOW_STAGES.has(stage)) {
      setAdminTab(readAdminTab())
      setStage(STAGES.ADMIN)
    }
  }, [user?.role, stage])

  const openDashboard = () => {
    setReturnStage(stage)
    if (user?.role === 'admin') {
      setAdminTab(readAdminTab())
      setStage(STAGES.ADMIN)
      return
    }
    setStage(STAGES.DASHBOARD)
  }

  const openAdmin = () => {
    setReturnStage(stage)
    setAdminTab(readAdminTab())
    setStage(STAGES.ADMIN)
  }

  const startNewAnalysis = useCallback(async () => {
    if (!user) {
      setReturnStage(stageRef.current)
      setAuthOpen(true)
      return
    }
    if (user.role === 'admin') {
      openAdmin()
      return
    }
    try {
      const hasAccess = await userHasAnalysisAccess(user)
      if (!hasAccess) {
        setBillingMessage('Payment is required before starting a new facial analysis.')
        setReturnStage(stageRef.current)
        setStage(STAGES.BILLING)
        return
      }
      setBillingMessage('')
      setAnswers(INITIAL_ANSWERS)
      setPhotos(EMPTY_PHOTOS)
      setAnalysis(null)
      setHistoryId(null)
      localStorage.removeItem(REPORT_STORAGE_KEY)
      trackEvent('assessment_start')
      setStage(STAGES.QUESTIONNAIRE)
    } catch {
      setBillingMessage('We could not verify payment access. Please check billing before starting analysis.')
      setReturnStage(stageRef.current)
      setStage(STAGES.BILLING)
    }
  }, [user])

  const restart = useCallback(() => {
    startNewAnalysis()
  }, [startNewAnalysis])

  const beginUserAnalysis = startNewAnalysis

  const startAnalysisAfterPayment = useCallback(() => {
    if (!user) {
      setReturnStage(STAGES.PAYMENT_SUCCESS)
      setAuthOpen(true)
      return
    }
    localStorage.removeItem(PAYMENT_SESSION_KEY)
    startNewAnalysis()
  }, [user, startNewAnalysis])

  const startAnalysisWithAccessCheck = startNewAnalysis

  const handleScanComplete = useCallback((result) => {
    setAnalysis(result)
    setHistoryId(null)
    setStage(STAGES.REPORT)
    trackEvent('assessment_complete', {
      success: !!result?.success,
      provider: result?.activeProvider || result?.cvEngine || 'unknown',
      savedToDb: !!result?.savedToDb,
    })
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

  const openBilling = () => {
    setBillingMessage('')
    setReturnStage(stage)
    setStage(STAGES.BILLING)
  }

  const logout = () => {
    clearSession()
    setUser(null)
    setStage(STAGES.LANDING)
    localStorage.removeItem(STAGE_STORAGE_KEY)
    localStorage.removeItem(REPORT_STORAGE_KEY)
    localStorage.removeItem(PAYMENT_SESSION_KEY)
    clearAdminTab()
    setLogoutConfirmOpen(false)
  }

  const requestLogout = () => setLogoutConfirmOpen(true)

  const handleAuthenticated = async (nextUser) => {
    setUser(nextUser)
    if (nextUser?.role === 'admin') {
      setReturnStage(STAGES.LANDING)
      persistAdminTab('overview')
      setAdminTab('overview')
      setStage(STAGES.ADMIN)
      return
    }
    if (
      stageRef.current === STAGES.PAYMENT_SUCCESS ||
      localStorage.getItem(PAYMENT_SESSION_KEY)
    ) {
      const sid = localStorage.getItem(PAYMENT_SESSION_KEY)
      if (sid) setPaymentReturn({ provider: 'stripe', sessionId: sid })
      setStage(STAGES.PAYMENT_SUCCESS)
      if (sid && isBackendApiEnabled()) {
        confirmStripeCheckout(sid).catch(() => {})
      }
      return
    }
    try {
      if (isBackendApiEnabled()) {
        const hasAccess = await userHasAnalysisAccess(nextUser)
        if (hasAccess) {
          setReturnStage(STAGES.LANDING)
          setStage(STAGES.DASHBOARD)
          return
        }
      }
      setBillingMessage('Payment is required before starting a new facial analysis.')
      setReturnStage(STAGES.LANDING)
      setStage(STAGES.BILLING)
    } catch {
      setBillingMessage('We could not verify payment access. Please check billing before starting analysis.')
      setReturnStage(STAGES.LANDING)
      setStage(STAGES.BILLING)
    }
  }

  const viewHistoryItem = (id) => {
    setHistoryId(id)
    setStage(STAGES.REPORT)
  }

  const viewCloudAssessment = (assessment) => {
    applyCloudAssessment(assessment)
  }

  const afterQuestionnaire = () => {
    setStage(STAGES.UPLOAD)
  }

  return (
    <div className="relative min-h-screen overflow-x-hidden font-sans">
      {showNav && stage !== STAGES.REPORT && (
        <TopNav
          onDashboard={openDashboard}
          onAdmin={openAdmin}
          onHistory={openHistory}
          onBilling={openBilling}
          onSettings={() => setSettingsOpen(true)}
          onAuth={() => setAuthOpen(true)}
          onLogout={requestLogout}
          user={user}
        />
      )}
      <ConfirmDialog
        open={logoutConfirmOpen}
        title="Sign out?"
        message="You will need to sign in again to access your reports, billing, and admin tools."
        confirmLabel="Sign out"
        danger
        onConfirm={logout}
        onCancel={() => setLogoutConfirmOpen(false)}
      />
      <Settings open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} onAuthenticated={handleAuthenticated} />

      <div className="fixed top-1/4 -left-32 w-64 h-64 rounded-full bg-brand-50/50 blur-3xl pointer-events-none dark:opacity-30" />
      <div className="fixed bottom-1/4 -right-32 w-80 h-80 rounded-full bg-brand-50/50 blur-3xl pointer-events-none dark:opacity-30" />

      {stage === STAGES.LANDING && user?.role !== 'admin' && (
        <Landing onBegin={startAnalysisWithAccessCheck} />
      )}

      {stage === STAGES.QUESTIONNAIRE && user?.role !== 'admin' && (
        <Questionnaire
          answers={answers}
          setAnswers={setAnswers}
          onComplete={afterQuestionnaire}
          onBack={() => setStage(STAGES.LANDING)}
        />
      )}

      {stage === STAGES.PROTOCOL && user?.role !== 'admin' && (
        <PhotoProtocol
          onComplete={() => setStage(STAGES.UPLOAD)}
          onBack={() => setStage(STAGES.QUESTIONNAIRE)}
        />
      )}

      {stage === STAGES.UPLOAD && user?.role !== 'admin' && (
        <PhotoUpload
          photos={photos}
          setPhotos={setPhotos}
          onStartAnalysis={() => {
            activeScanIdRef.current = createHistoryId()
            setScanId(activeScanIdRef.current)
            setStage(STAGES.SCANNING)
          }}
          onBack={() => setStage(STAGES.QUESTIONNAIRE)}
        />
      )}

      {stage === STAGES.SCANNING && user?.role !== 'admin' && (
        <Scanning
          photo={primaryPhoto}
          photos={photos}
          answers={answers}
          scanId={activeScanIdRef.current || scanId}
          onComplete={handleScanComplete}
        />
      )}

      {stage === STAGES.HISTORY && (
        <HistoryPage
          onBack={() => setStage(returnStage)}
          onViewItem={viewHistoryItem}
          onViewCloudItem={viewCloudAssessment}
          onOpenAdmin={openAdmin}
          user={user}
        />
      )}

      {stage === STAGES.BILLING && (
        <BillingPage
          onBack={() => setStage(returnStage)}
          onAuth={() => setAuthOpen(true)}
          message={billingMessage}
          user={user}
        />
      )}

      {stage === STAGES.DASHBOARD && (
        <DashboardPage
          onAuth={() => setAuthOpen(true)}
          onStartAssessment={startNewAnalysis}
          onHistory={openHistory}
          onBilling={openBilling}
          onViewCloudItem={viewCloudAssessment}
          user={user}
        />
      )}

      {stage === STAGES.ADMIN && (
        <AdminPanelPage
          onSettings={() => setSettingsOpen(true)}
          onViewCloudItem={viewCloudAssessment}
          user={user}
          initialTab={adminTab}
        />
      )}

      {stage === STAGES.PAYMENT_SUCCESS && (
        <PaymentSuccessPage
          user={user}
          sessionId={paymentReturn?.sessionId}
          onAuth={() => setAuthOpen(true)}
          onStartAnalysis={startAnalysisAfterPayment}
          onBilling={openBilling}
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
          onDashboard={user?.role === 'admin' ? openAdmin : openDashboard}
          onSettings={() => setSettingsOpen(true)}
          user={user}
        />
      )}
    </div>
  )
}
