'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { STAGES, INITIAL_ANSWERS } from '../../utils/constants'
import { runFaceAnalysis } from '../../utils/analyzeFace'
import { setActiveProvider } from '../../utils/settings'
import {
  ANALYSIS_STEPS,
  dashboardPathForUser,
  isKnownAppPath,
  parseAppPath,
  resolveLegacyPath,
  requiresAuth,
  ROUTES,
  stageToPath,
  adminTabToPath,
} from '../../utils/routes'
import { clearSession, fetchCurrentUser, getAuthToken, getStoredUser } from '../../utils/authClient'
import { isBackendApiEnabled, confirmStripeCheckout, fetchAdminAssessments, fetchAdminPayments, fetchAdminUsers, fetchAssessment } from '../../utils/apiClient'
import { trackEvent } from '../../utils/analytics'
import { clearAdminTab, resolveLegacyAdminHash } from '../../utils/adminPanel'
import { resourcesForAdminTab } from '../../utils/adminWorkspace'
import { dedupeAssessments } from '../../utils/assessmentDedupe'
import { createHistoryId } from '../../utils/historyStorage'
import { userHasAnalysisAccess } from '../../utils/paymentAccess'
import { DEV_SAMPLE_QUESTIONNAIRE_ANSWERS } from '../../utils/devSampleAnswers'

const EMPTY_PHOTOS = {
  front: null,
  leftProfile: null,
  rightProfile: null,
  left45: null,
  right45: null,
  smile: null,
  topHead: null,
}

const STAGE_STORAGE_KEY = 'myface_current_stage'
const PAYMENT_SESSION_KEY = 'myface_payment_session_id'

const RESTORABLE_STAGES = new Set([
  STAGES.LANDING,
  STAGES.DASHBOARD,
  STAGES.HISTORY,
  STAGES.BILLING,
  STAGES.PAYMENT_SUCCESS,
])

const AppContext = createContext(null)

export function AppProvider({ children }) {
  const router = useRouter()
  const pathname = usePathname()
  const [answers, setAnswers] = useState(INITIAL_ANSWERS)
  const [photos, setPhotos] = useState(EMPTY_PHOTOS)
  const [analysis, setAnalysis] = useState(null)
  const [historyId, setHistoryId] = useState(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [authOpen, setAuthOpen] = useState(false)
  const [user, setUser] = useState(null)
  const [authReady, setAuthReady] = useState(false)
  const [returnPath, setReturnPath] = useState(ROUTES.dashboard)
  const [billingMessage, setBillingMessage] = useState('')
  const [paymentReturn, setPaymentReturn] = useState(null)
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false)
  const [scanId, setScanId] = useState(null)
  const [questionnaireStartAtEnd, setQuestionnaireStartAtEnd] = useState(false)
  const [analysisStep, setAnalysisStep] = useState(ANALYSIS_STEPS.WELCOME)
  const [reportModalOpen, setReportModalOpen] = useState(false)
  const [openingReportId, setOpeningReportId] = useState(null)
  const [adminWorkspace, setAdminWorkspace] = useState({
    assessments: [],
    payments: [],
    users: [],
    loading: {},
    error: '',
  })
  const activeScanIdRef = useRef(null)
  const bootstrappedRef = useRef(false)
  const userRef = useRef(user)
  const adminCacheRef = useRef({ assessments: null, payments: null, users: null })
  const adminInflightRef = useRef(new Set())

  const resetAdminWorkspace = useCallback(() => {
    adminCacheRef.current = { assessments: null, payments: null, users: null }
    adminInflightRef.current.clear()
    setAdminWorkspace({
      assessments: [],
      payments: [],
      users: [],
      loading: {},
      error: '',
    })
  }, [])

  const fetchAdminResource = useCallback(async (resource) => {
    if (resource === 'assessments') {
      const items = await fetchAdminAssessments(100)
      return dedupeAssessments(items)
    }
    if (resource === 'payments') return fetchAdminPayments(50)
    if (resource === 'users') return fetchAdminUsers(250)
    return null
  }, [])

  const ensureAdminResources = useCallback(async (resources, { force = false } = {}) => {
    if (!user || user.role !== 'admin' || !isBackendApiEnabled()) return
    const unique = [...new Set(resources)]
    const toFetch = unique.filter((key) => force || adminCacheRef.current[key] == null)
    if (!toFetch.length) {
      setAdminWorkspace((prev) => ({
        ...prev,
        assessments: adminCacheRef.current.assessments ?? prev.assessments,
        payments: adminCacheRef.current.payments ?? prev.payments,
        users: adminCacheRef.current.users ?? prev.users,
      }))
      return
    }

    const inflightKey = toFetch.sort().join(',')
    if (adminInflightRef.current.has(inflightKey)) return
    adminInflightRef.current.add(inflightKey)

    setAdminWorkspace((prev) => ({
      ...prev,
      loading: {
        ...prev.loading,
        ...Object.fromEntries(toFetch.map((key) => [key, true])),
      },
      error: '',
    }))

    try {
      const results = await Promise.all(
        toFetch.map(async (resource) => [resource, await fetchAdminResource(resource)]),
      )
      const updates = {}
      for (const [resource, items] of results) {
        adminCacheRef.current[resource] = items
        updates[resource] = items
      }
      setAdminWorkspace((prev) => ({
        ...prev,
        ...updates,
        error: '',
      }))
    } catch (err) {
      setAdminWorkspace((prev) => ({
        ...prev,
        error: err.message || 'Could not load admin data',
      }))
    } finally {
      adminInflightRef.current.delete(inflightKey)
      setAdminWorkspace((prev) => ({
        ...prev,
        loading: {
          ...prev.loading,
          ...Object.fromEntries(toFetch.map((key) => [key, false])),
        },
      }))
    }
  }, [user, fetchAdminResource])

  const loadAdminTab = useCallback(async (tab, { force = false } = {}) => {
    const resources = resourcesForAdminTab(tab)
    if (!resources.length) return
    if (force) {
      resources.forEach((key) => {
        adminCacheRef.current[key] = null
      })
    }
    await ensureAdminResources(resources, { force })
  }, [ensureAdminResources])

  const refreshAdminTab = useCallback(async (tab) => {
    await loadAdminTab(tab, { force: true })
  }, [loadAdminTab])

  const patchAdminWorkspace = useCallback((patch) => {
    setAdminWorkspace((prev) => ({ ...prev, ...patch }))
    if (patch.assessments) adminCacheRef.current.assessments = patch.assessments
    if (patch.payments) adminCacheRef.current.payments = patch.payments
    if (patch.users) adminCacheRef.current.users = patch.users
  }, [])
  useEffect(() => {
    userRef.current = user
  }, [user])

  const primaryPhoto = photos.front

  const goTo = useCallback((path, { replace = false } = {}) => {
    const legacy = resolveLegacyPath(path)
    const target = legacy || path
    if (target !== pathname) {
      if (replace) router.replace(target)
      else router.push(target)
    }
  }, [pathname, router])

  const goToStage = useCallback((stage, { replace = false } = {}) => {
    goTo(stageToPath(stage), { replace })
  }, [goTo])

  const openReportModal = useCallback(() => setReportModalOpen(true), [])
  const closeReportModal = useCallback(() => {
    setReportModalOpen(false)
    setHistoryId(null)
  }, [])

  const resetAnalysisFlow = useCallback(() => {
    setAnalysisStep(ANALYSIS_STEPS.WELCOME)
    setQuestionnaireStartAtEnd(false)
  }, [])

  const goToWelcome = useCallback(() => setAnalysisStep(ANALYSIS_STEPS.WELCOME), [])
  const goToQuestionnaire = useCallback(() => setAnalysisStep(ANALYSIS_STEPS.QUESTIONNAIRE), [])
  const goToConfirm = useCallback(() => setAnalysisStep(ANALYSIS_STEPS.CONFIRM), [])
  const goToUpload = useCallback(() => setAnalysisStep(ANALYSIS_STEPS.UPLOAD), [])
  const goToScanning = useCallback(() => setAnalysisStep(ANALYSIS_STEPS.SCANNING), [])

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

  const hydratePhotosFromAssessment = (assessment) => {
    const stored = assessment?.photos || {}
    const hydrated = { ...EMPTY_PHOTOS }
    Object.entries(stored).forEach(([poseId, meta]) => {
      if (meta?.publicUrl) hydrated[poseId] = meta.publicUrl
    })
    const report = assessment?.analysis?.cvReport
    const reportPhotos = report?.photos || {}
    Object.entries(reportPhotos).forEach(([poseId, url]) => {
      if (url && !hydrated[poseId]) hydrated[poseId] = url
    })
    if (!hydrated.front) hydrated.front = getCloudAssessmentPhoto(assessment)
    return hydrated
  }

  const hydrateFromCloudAssessment = useCallback((assessment) => {
    setAnswers(assessment.answers || INITIAL_ANSWERS)
    setPhotos(hydratePhotosFromAssessment(assessment))
    setAnalysis({
      ...(assessment.analysis || {}),
      success: assessment.analysis?.success ?? true,
      assessmentId: assessment.id,
      savedToDb: true,
      reportStatus: assessment.status || 'pending_review',
      aiNarrative: assessment.aiNarrative || assessment.analysis?.aiNarrative || null,
      aiVisuals: assessment.aiVisuals || assessment.analysis?.aiVisuals || null,
      protocolData: assessment.protocolData || null,
      protocolNarrative: assessment.protocolNarrative || null,
      protocolStorage: assessment.protocolStorage || null,
    })
    setHistoryId(null)
  }, [])

  useEffect(() => {
    if (bootstrappedRef.current) return

    const params = new URLSearchParams(window.location.search)
    const payment = params.get('payment')
    const sessionId = params.get('session_id')
    const savedStage = localStorage.getItem(STAGE_STORAGE_KEY)
    const currentPath = window.location.pathname
    let restored = false
    const storedUser = getStoredUser()

    const legacy = resolveLegacyPath(currentPath)
    if (legacy) {
      goTo(legacy, { replace: true })
      restored = true
    }

    const legacyAdminHash = resolveLegacyAdminHash()
    if (!restored && legacyAdminHash) {
      goTo(legacyAdminHash, { replace: true })
      restored = true
    }

    if (payment === 'stripe-success' || (sessionId && sessionId.startsWith('cs_'))) {
      const sid = sessionId || localStorage.getItem(PAYMENT_SESSION_KEY)
      if (sid) localStorage.setItem(PAYMENT_SESSION_KEY, sid)
      setPaymentReturn({ provider: 'stripe', sessionId: sid })
      setReturnPath(ROUTES.billing)
      goTo(ROUTES.billing, { replace: true })
      restored = true
      if (sid && storedUser && isBackendApiEnabled()) confirmStripeCheckout(sid).catch(() => {})
    } else if (payment === 'stripe-cancel') {
      setBillingMessage('Payment was cancelled. You can restart checkout when ready.')
      setReturnPath(ROUTES.analysis)
      goTo(ROUTES.billing, { replace: true })
      restored = true
    }

    if (!restored && localStorage.getItem(PAYMENT_SESSION_KEY)) {
      const sid = localStorage.getItem(PAYMENT_SESSION_KEY)
      setPaymentReturn({ provider: 'stripe', sessionId: sid })
      setReturnPath(ROUTES.billing)
      goTo(ROUTES.billing, { replace: true })
      restored = true
      if (sid && storedUser && isBackendApiEnabled()) confirmStripeCheckout(sid).catch(() => {})
    }

    if (!restored && isKnownAppPath(currentPath)) {
      restored = true
    } else if (!restored && savedStage && RESTORABLE_STAGES.has(savedStage)) {
      goTo(stageToPath(savedStage), { replace: true })
      restored = true
    }

    if (!restored && storedUser) {
      goTo(dashboardPathForUser(storedUser), { replace: true })
    }

    bootstrappedRef.current = true

    fetchCurrentUser()
      .then((currentUser) => {
        if (currentUser) {
          setUser(currentUser)
          return
        }
        setUser(getAuthToken() ? storedUser : null)
      })
      .finally(() => setAuthReady(true))
  }, [goTo])

  useEffect(() => {
    if (!bootstrappedRef.current) return
    const legacy = resolveLegacyPath(pathname)
    if (legacy) {
      goTo(legacy, { replace: true })
      return
    }
    if (!isKnownAppPath(pathname)) {
      goTo(user ? ROUTES.dashboard : ROUTES.analysis, { replace: true })
    }
  }, [pathname, goTo, user])

  useEffect(() => {
    if (!bootstrappedRef.current) return
    const { stage } = parseAppPath(pathname)
    if (!stage || !RESTORABLE_STAGES.has(stage)) return
    localStorage.setItem(STAGE_STORAGE_KEY, stage)
  }, [pathname])

  useEffect(() => {
    if (pathname !== ROUTES.analysis && analysisStep !== ANALYSIS_STEPS.WELCOME) {
      resetAnalysisFlow()
    }
  }, [pathname, analysisStep, resetAnalysisFlow])

  useEffect(() => {
    if (!authReady) return
    if (!user && requiresAuth(pathname)) {
      setAuthOpen(true)
    }
  }, [authReady, user, pathname])

  useEffect(() => {
    if (user?.role === 'admin' && pathname === ROUTES.analysis) {
      goTo(adminTabToPath('overview'), { replace: true })
    }
  }, [user?.role, pathname, goTo])

  const openDashboard = useCallback(() => {
    setReturnPath(pathname)
    goTo(dashboardPathForUser(user))
  }, [pathname, goTo, user])

  const openHistory = useCallback(() => {
    setReturnPath(pathname)
    goTo(ROUTES.history)
  }, [pathname, goTo])

  const openBilling = useCallback(() => {
    setBillingMessage('')
    setReturnPath(pathname)
    goTo(ROUTES.billing)
  }, [pathname, goTo])

  const startNewAnalysis = useCallback(async () => {
    if (!user) {
      setReturnPath(pathname)
      setAuthOpen(true)
      return
    }
    if (user.role === 'admin') {
      goTo(adminTabToPath('overview'))
      return
    }
    try {
      const hasAccess = await userHasAnalysisAccess(user)
      if (!hasAccess) {
        setBillingMessage('Payment is required before starting a new facial analysis.')
        setReturnPath(pathname)
        goTo(ROUTES.billing)
        return
      }
      setBillingMessage('')
      setAnswers(INITIAL_ANSWERS)
      setPhotos(EMPTY_PHOTOS)
      setAnalysis(null)
      setHistoryId(null)
      trackEvent('assessment_start')
      setQuestionnaireStartAtEnd(false)
      goTo(ROUTES.analysis)
      setAnalysisStep(ANALYSIS_STEPS.QUESTIONNAIRE)
    } catch {
      setBillingMessage('We could not verify payment access. Please check billing before starting analysis.')
      setReturnPath(pathname)
      goTo(ROUTES.billing)
    }
  }, [user, pathname, goTo])

  const startAnalysisAfterPayment = useCallback(() => {
    if (!user) {
      setReturnPath(ROUTES.billing)
      setAuthOpen(true)
      return
    }
    localStorage.removeItem(PAYMENT_SESSION_KEY)
    setPaymentReturn(null)
    startNewAnalysis()
  }, [user, startNewAnalysis])

  const handleScanComplete = useCallback((result) => {
    setAnalysis(result)
    setHistoryId(null)
    resetAnalysisFlow()
    openReportModal()
    goTo(ROUTES.history)
    trackEvent('assessment_complete', {
      success: !!result?.success,
      provider: result?.activeProvider || result?.cvEngine || 'unknown',
      savedToDb: !!result?.savedToDb,
    })
  }, [openReportModal, resetAnalysisFlow, goTo])

  const handleRetryLocal = useCallback(async (retryPhoto, retryPhotos, retryAnswers) => {
    const prevProvider = setActiveProvider('local')
    goTo(ROUTES.analysis)
    goToScanning()
    try {
      const result = await runFaceAnalysis(retryPhoto, retryAnswers, retryPhotos)
      setAnalysis(result)
      setHistoryId(null)
      openReportModal()
    } catch {
      setActiveProvider(prevProvider)
      openReportModal()
    }
  }, [goTo, goToScanning, openReportModal])

  const logout = useCallback(() => {
    clearSession()
    setUser(null)
    setAuthOpen(true)
    localStorage.removeItem(STAGE_STORAGE_KEY)
    localStorage.removeItem(PAYMENT_SESSION_KEY)
    clearAdminTab()
    resetAdminWorkspace()
    setLogoutConfirmOpen(false)
    closeReportModal()
    resetAnalysisFlow()
    goTo(ROUTES.analysis, { replace: true })
  }, [goTo, closeReportModal, resetAnalysisFlow, resetAdminWorkspace])

  const handleAuthenticated = useCallback(async (nextUser) => {
    setUser(nextUser)
    setAuthOpen(false)
    if (nextUser?.role === 'admin') {
      setReturnPath(ROUTES.analysis)
      goTo(adminTabToPath('overview'))
      return
    }
    if (pathname === ROUTES.billing && (paymentReturn || localStorage.getItem(PAYMENT_SESSION_KEY))) {
      const sid = localStorage.getItem(PAYMENT_SESSION_KEY)
      if (sid) setPaymentReturn({ provider: 'stripe', sessionId: sid })
      if (sid && isBackendApiEnabled()) confirmStripeCheckout(sid).catch(() => {})
      return
    }
    try {
      if (isBackendApiEnabled()) {
        const hasAccess = await userHasAnalysisAccess(nextUser)
        if (hasAccess) {
          setReturnPath(ROUTES.analysis)
          goTo(ROUTES.dashboard)
          return
        }
      }
      setBillingMessage('Payment is required before starting a new facial analysis.')
      setReturnPath(ROUTES.analysis)
      goTo(ROUTES.billing)
    } catch {
      setBillingMessage('We could not verify payment access. Please check billing before starting analysis.')
      setReturnPath(ROUTES.analysis)
      goTo(ROUTES.billing)
    }
  }, [pathname, goTo, paymentReturn])

  const viewHistoryItem = useCallback((id) => {
    setHistoryId(id)
    setAnalysis(null)
    openReportModal()
  }, [openReportModal])

  const viewCloudAssessment = useCallback(async (assessment) => {
    if (!assessment?.id || !isBackendApiEnabled()) {
      hydrateFromCloudAssessment(assessment)
      openReportModal()
      return
    }
    setOpeningReportId(assessment.id)
    try {
      const full = await fetchAssessment(assessment.id)
      hydrateFromCloudAssessment(full)
      openReportModal()
    } catch (err) {
      alert(err?.message || 'Could not load report')
    } finally {
      setOpeningReportId(null)
    }
  }, [hydrateFromCloudAssessment, openReportModal])

  const skipQuestionnaireWithSampleData = useCallback(() => {
    setAnswers(DEV_SAMPLE_QUESTIONNAIRE_ANSWERS)
    setPhotos(EMPTY_PHOTOS)
    setAnalysis(null)
    setHistoryId(null)
    setQuestionnaireStartAtEnd(false)
    goTo(ROUTES.analysis)
    setAnalysisStep(ANALYSIS_STEPS.CONFIRM)
  }, [goTo])

  const startScanning = useCallback(() => {
    activeScanIdRef.current = createHistoryId()
    setScanId(activeScanIdRef.current)
    goTo(ROUTES.analysis)
    goToScanning()
  }, [goTo, goToScanning])

  const handleLogo = useCallback(() => {
    if (user) openDashboard()
    else goTo(ROUTES.analysis)
  }, [user, openDashboard, goTo])

  const value = useMemo(() => ({
    user,
    authReady,
    answers,
    setAnswers,
    photos,
    setPhotos,
    analysis,
    historyId,
    settingsOpen,
    setSettingsOpen,
    authOpen,
    setAuthOpen,
    returnPath,
    billingMessage,
    paymentReturn,
    setPaymentReturn,
    logoutConfirmOpen,
    setLogoutConfirmOpen,
    scanId,
    activeScanIdRef,
    questionnaireStartAtEnd,
    setQuestionnaireStartAtEnd,
    analysisStep,
    reportModalOpen,
    openingReportId,
    primaryPhoto,
    pathname,
    goTo,
    goToStage,
    openDashboard,
    openHistory,
    openBilling,
    startNewAnalysis,
    startAnalysisAfterPayment,
    handleScanComplete,
    handleRetryLocal,
    logout,
    handleAuthenticated,
    viewHistoryItem,
    viewCloudAssessment,
    adminWorkspace,
    loadAdminTab,
    refreshAdminTab,
    patchAdminWorkspace,
    skipQuestionnaireWithSampleData,
    startScanning,
    handleLogo,
    openReportModal,
    closeReportModal,
    goToWelcome,
    goToQuestionnaire,
    goToConfirm,
    goToUpload,
    goToScanning,
    resetAnalysisFlow,
  }), [
    user, authReady, answers, photos, analysis, historyId, settingsOpen, authOpen, returnPath,
    billingMessage, paymentReturn, logoutConfirmOpen, scanId,
    adminWorkspace,
    questionnaireStartAtEnd, analysisStep, reportModalOpen, openingReportId, primaryPhoto, pathname,
    goTo, goToStage, openDashboard, openHistory, openBilling, startNewAnalysis,
    startAnalysisAfterPayment, handleScanComplete, handleRetryLocal, logout,
    handleAuthenticated, viewHistoryItem, viewCloudAssessment,
    adminWorkspace, loadAdminTab, refreshAdminTab, patchAdminWorkspace,
    skipQuestionnaireWithSampleData, startScanning, handleLogo,
    openReportModal, closeReportModal, goToWelcome, goToQuestionnaire,
    goToConfirm, goToUpload, goToScanning, resetAnalysisFlow,
  ])

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}
