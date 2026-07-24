'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { usePathname, useRouter } from '../../i18n/navigation'
import { STAGES, INITIAL_ANSWERS } from '../../utils/constants'
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
  stripLocaleFromPath,
  isReportModalHostPath,
} from '../../utils/routes'
import { clearSession, fetchCurrentUser, getAuthToken, getStoredUser, saveSession } from '../../utils/authClient'
import { isBackendApiEnabled, confirmStripeCheckout, createStripeCheckout, createAssessmentDraft, fetchAdminAssessments, fetchAdminPayments, fetchAdminUsers, fetchAssessment, fetchMyAssessments, fetchMyAssessmentsWithQuota, isFullCloudAssessment, submitAssessment } from '../../utils/apiClient'
import { trackEvent } from '../../utils/analytics'
import { clearAdminTab, resolveLegacyAdminHash } from '../../utils/adminPanel'
import { resourcesForAdminTab } from '../../utils/adminWorkspace'
import { dedupeAssessments } from '../../utils/assessmentDedupe'
import { createHistoryId } from '../../utils/historyStorage'
import { userHasAnalysisAccess } from '../../utils/paymentAccess'
import { isAssessmentProcessing, isAssessmentSubmitted, userReportReady } from '../../utils/reportWorkflow'
import { canStartNewAssessment } from '../../utils/assessmentEligibility'
import { withTimeout, DEFAULT_FETCH_TIMEOUT_MS } from '../../utils/withTimeout'
import { DEV_SAMPLE_QUESTIONNAIRE_ANSWERS } from '../../utils/devSampleAnswers'
import {
  answersHaveProgress,
  clearAnalysisDraft,
  loadAnalysisDraft,
  saveAnalysisDraft,
} from '../../utils/analysisDraftStorage'

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
  const [user, setUser] = useState(null)
  const [authReady, setAuthReady] = useState(false)
  const [hasAnalysisAccess, setHasAnalysisAccess] = useState(false)
  const [accessReady, setAccessReady] = useState(false)
  const [returnPath, setReturnPath] = useState(ROUTES.dashboard)
  const [billingMessage, setBillingMessage] = useState('')
  const [paymentReturn, setPaymentReturn] = useState(null)
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false)
  const [scanId, setScanId] = useState(null)
  const [questionnaireStartAtEnd, setQuestionnaireStartAtEnd] = useState(false)
  const [analysisStep, setAnalysisStep] = useState(ANALYSIS_STEPS.WELCOME)
  const [reportModalOpen, setReportModalOpen] = useState(false)
  const [reportSectionId, setReportSectionId] = useState('intro')
  /** PDF actions while report modal is open — set by Report.jsx */
  const [reportToolbar, setReportToolbar] = useState(null)
  const [openingReportId, setOpeningReportId] = useState(null)
  /** Full GET assessment used to open the report — reused by Report (no re-fetch). */
  const [cloudAssessment, setCloudAssessment] = useState(null)
  /** Bumped after soft-delete so chat / AI visuals remount loaders pick the new latest. */
  const [latestAssessmentEpoch, setLatestAssessmentEpoch] = useState(0)
  const [adminWorkspace, setAdminWorkspace] = useState({
    assessments: [],
    payments: [],
    users: [],
    loading: {},
    error: '',
  })
  const activeScanIdRef = useRef(null)
  const bootstrappedRef = useRef(false)
  const prevPathnameRef = useRef(null)
  const pathnameRef = useRef(pathname)
  const accessCheckedOnceRef = useRef(false)
  const userRef = useRef(user)
  const adminCacheRef = useRef({ assessments: null, payments: null, users: null })
  const adminInflightRef = useRef(new Set())
  /** Prevents re-applying local draft while already on /analysis. Reset when leaving the route. */
  const draftRestoreAttemptedRef = useRef(false)

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

  useEffect(() => {
    pathnameRef.current = pathname
  }, [pathname])

  const primaryPhoto = photos.front

  const goTo = useCallback((path, { replace = false } = {}) => {
    const legacy = resolveLegacyPath(path)
    const target = legacy || path
    if (target !== pathnameRef.current) {
      if (replace) router.replace(target)
      else router.push(target)
    }
  }, [router])

  const goToStage = useCallback((stage, { replace = false } = {}) => {
    goTo(stageToPath(stage), { replace })
  }, [goTo])

  const openReportModal = useCallback(() => setReportModalOpen(true), [])
  const closeReportModal = useCallback(() => {
    setReportModalOpen(false)
    setReportSectionId('intro')
    setHistoryId(null)
    setCloudAssessment(null)
  }, [])

  /** Open modal on /report (or admin tab); navigate there first from overview/other routes. */
  const openReportModalOnRoute = useCallback(() => {
    if (!isReportModalHostPath(pathnameRef.current)) {
      goTo(ROUTES.report)
    }
    openReportModal()
  }, [goTo, openReportModal])

  useEffect(() => {
    if (prevPathnameRef.current === null) {
      prevPathnameRef.current = pathname
      return
    }
    const prev = prevPathnameRef.current
    if (prev === pathname) return
    if (reportModalOpen && isReportModalHostPath(prev) && !isReportModalHostPath(pathname)) {
      closeReportModal()
    }
    prevPathnameRef.current = pathname
  }, [pathname, reportModalOpen, closeReportModal])

  const resetAnalysisFlow = useCallback(() => {
    setAnalysisStep(ANALYSIS_STEPS.WELCOME)
    setQuestionnaireStartAtEnd(false)
  }, [])

  const goToWelcome = useCallback(() => setAnalysisStep(ANALYSIS_STEPS.WELCOME), [])
  const goToQuestionnaire = useCallback(() => setAnalysisStep(ANALYSIS_STEPS.QUESTIONNAIRE), [])
  const goToConfirm = useCallback(() => setAnalysisStep(ANALYSIS_STEPS.CONFIRM), [])
  const goToUpload = useCallback(() => setAnalysisStep(ANALYSIS_STEPS.UPLOAD), [])
  const goToPreparing = useCallback(() => setAnalysisStep(ANALYSIS_STEPS.PREPARING), [])

  const [preparingAssessmentId, setPreparingAssessmentId] = useState(null)
  const [draftAssessmentId, setDraftAssessmentId] = useState(null)
  const [submitError, setSubmitError] = useState('')
  /** De-dupes concurrent draft-creation calls (e.g. multiple poses uploading at once). */
  const draftPromiseRef = useRef(null)

  /** Lazily create (once) the draft assessment that per-pose uploads attach to. */
  const ensureDraft = useCallback(async () => {
    if (draftAssessmentId) return draftAssessmentId
    if (!draftPromiseRef.current) {
      const sid = activeScanIdRef.current || scanId
      draftPromiseRef.current = createAssessmentDraft(sid)
        .then((res) => {
          setDraftAssessmentId(res.assessmentId)
          return res.assessmentId
        })
        .catch((err) => {
          draftPromiseRef.current = null
          throw err
        })
    }
    return draftPromiseRef.current
  }, [draftAssessmentId, scanId])

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
      pipeline: assessment.pipeline || null,
      featureParsing: assessment.featureParsing || null,
      projectedAfter: assessment.projectedAfter || null,
      projectedAnalysis: assessment.projectedAnalysis || null,
      processing: assessment.processing ?? false,
      aiNarrative: assessment.aiNarrative || assessment.analysis?.aiNarrative || null,
      aiVisuals: assessment.aiVisuals || assessment.analysis?.aiVisuals || null,
      protocolNarrative: assessment.protocolNarrative || null,
      featureNarratives: assessment.featureNarratives || null,
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
    const currentPath = stripLocaleFromPath(window.location.pathname)
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
      setReturnPath(ROUTES.dashboard)
      goTo(ROUTES.dashboard, { replace: true })
      restored = true
    } else if (payment === 'stripe-cancel') {
      setBillingMessage('Payment was cancelled. You can restart checkout when ready.')
      setReturnPath(ROUTES.dashboard)
      goTo(ROUTES.dashboard, { replace: true })
      restored = true
    }

    if (!restored && isKnownAppPath(currentPath)) {
      restored = true
    } else if (!restored && savedStage && RESTORABLE_STAGES.has(savedStage) && storedUser) {
      goTo(stageToPath(savedStage), { replace: true })
      restored = true
    }

    if (!restored && storedUser) {
      goTo(dashboardPathForUser(storedUser), { replace: true })
    }

    bootstrappedRef.current = true
    const bootPath = currentPath

    fetchCurrentUser()
      .then((currentUser) => {
        const resolved = currentUser || (getAuthToken() ? storedUser : null)
        const roleChanged = storedUser && resolved && storedUser.role !== resolved.role
        const sessionCleared = storedUser && !resolved
        if (roleChanged || sessionCleared) {
          localStorage.removeItem(STAGE_STORAGE_KEY)
          clearAdminTab()
          const stillOnBootPath = stripLocaleFromPath(window.location.pathname) === bootPath
          if (sessionCleared || stillOnBootPath) {
            goTo(resolved ? dashboardPathForUser(resolved) : ROUTES.auth, { replace: true })
          }
        }
        setUser(resolved)
      })
      .catch(() => {
        // Transient network/backend failure (e.g. dev server reloading, cold
        // start, proxy blip): fall back to the optimistic stored session so we
        // never strand a logged-in user on the boot screen. Without this catch,
        // setUser is skipped while finally still flips authReady -> the app
        // renders AppBootScreen forever until a full page refresh.
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
      goTo(user ? dashboardPathForUser(user) : ROUTES.auth, { replace: true })
    }
  }, [pathname, goTo, user])

  const refreshAnalysisAccess = useCallback(async (forUser) => {
    const subject = forUser ?? userRef.current
    if (!subject || subject.role === 'admin') {
      setHasAnalysisAccess(true)
      setAccessReady(true)
      return
    }
    if (!isBackendApiEnabled()) {
      setHasAnalysisAccess(false)
      setAccessReady(true)
      accessCheckedOnceRef.current = true
      return
    }
    if (!accessCheckedOnceRef.current) {
      setAccessReady(false)
    }
    try {
      const allowed = await withTimeout(
        userHasAnalysisAccess(subject),
        DEFAULT_FETCH_TIMEOUT_MS,
        'Payment access check timed out',
      )
      setHasAnalysisAccess(allowed)
    } catch {
      setHasAnalysisAccess(false)
    } finally {
      accessCheckedOnceRef.current = true
      setAccessReady(true)
    }
  }, [])

  // Never strand the UI if auth/access checks hang (cold backend, stale Stripe session, etc.)
  useEffect(() => {
    if (authReady && accessReady) return undefined
    const timer = setTimeout(() => {
      if (!authReady) {
        setUser(getAuthToken() ? getStoredUser() : null)
        setAuthReady(true)
      }
      setAccessReady(true)
    }, 18000)
    return () => clearTimeout(timer)
  }, [authReady, accessReady])

  const grantPaidAccess = useCallback(() => {
    localStorage.removeItem(PAYMENT_SESSION_KEY)
    setHasAnalysisAccess(true)
    setAccessReady(true)
  }, [])

  // Restore Stripe return session after refresh / race, then confirm + unlock access
  useEffect(() => {
    if (!authReady) return
    if (!paymentReturn) {
      const sid = localStorage.getItem(PAYMENT_SESSION_KEY)
      if (sid && sid.startsWith('cs_')) {
        setPaymentReturn({ provider: 'stripe', sessionId: sid })
      }
      return
    }
    const sid = paymentReturn.sessionId
    if (!sid || !user || !isBackendApiEnabled()) {
      if (user) refreshAnalysisAccess(user)
      return undefined
    }
    let cancelled = false
    withTimeout(confirmStripeCheckout(sid), DEFAULT_FETCH_TIMEOUT_MS, 'Stripe confirm timed out')
      .then(async (result) => {
        if (cancelled) return
        const status = String(result?.payment?.status || '').toLowerCase()
        if (['paid', 'complete', 'completed'].includes(status)) {
          setHasAnalysisAccess(true)
          setAccessReady(true)
        }
        await refreshAnalysisAccess(user)
      })
      .catch(() => {
        if (!cancelled) refreshAnalysisAccess(user)
      })
    return () => {
      cancelled = true
    }
  }, [authReady, user, paymentReturn, refreshAnalysisAccess])

  useEffect(() => {
    if (!authReady) return
    if (!user) {
      setHasAnalysisAccess(false)
      setAccessReady(true)
      return
    }
    refreshAnalysisAccess()
  }, [authReady, user?.id, user?.role, refreshAnalysisAccess])

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

  /** Persist in-progress questionnaire/confirm draft while on /analysis. */
  useEffect(() => {
    if (!user?.id || pathname !== ROUTES.analysis) return
    if (!answersHaveProgress(answers, INITIAL_ANSWERS)) return
    const step = analysisStep
    const persistable =
      step === ANALYSIS_STEPS.QUESTIONNAIRE
      || step === ANALYSIS_STEPS.CONFIRM
      || step === ANALYSIS_STEPS.UPLOAD
    if (!persistable) return
    const storedStep =
      step === ANALYSIS_STEPS.UPLOAD ? ANALYSIS_STEPS.CONFIRM : step
    saveAnalysisDraft(user.id, {
      answers,
      analysisStep: storedStep,
      scanId: activeScanIdRef.current || scanId,
    })
  }, [user?.id, pathname, answers, analysisStep, scanId])

  /** Restore local questionnaire draft when entering /analysis. */
  useEffect(() => {
    if (!authReady || !user?.id) return
    if (pathname !== ROUTES.analysis) {
      draftRestoreAttemptedRef.current = false
      return
    }
    if (draftRestoreAttemptedRef.current) return
    draftRestoreAttemptedRef.current = true

    const draft = loadAnalysisDraft(user.id)
    if (!draft || !answersHaveProgress(draft.answers, INITIAL_ANSWERS)) return

    let step = draft.analysisStep
    if (
      step === ANALYSIS_STEPS.UPLOAD
      || step === ANALYSIS_STEPS.PREPARING
      || step === ANALYSIS_STEPS.SCANNING
    ) {
      step = ANALYSIS_STEPS.CONFIRM
    }
    if (step !== ANALYSIS_STEPS.QUESTIONNAIRE && step !== ANALYSIS_STEPS.CONFIRM) {
      step = ANALYSIS_STEPS.QUESTIONNAIRE
    }

    setAnswers(draft.answers)
    if (draft.scanId) {
      activeScanIdRef.current = draft.scanId
      setScanId(draft.scanId)
    }
    setAnalysisStep(step)
  }, [authReady, user?.id, pathname])

  useEffect(() => {
    if (!bootstrappedRef.current || !authReady) return
    if (pathname !== ROUTES.home) return
    goTo(user ? dashboardPathForUser(user) : ROUTES.auth, { replace: true })
  }, [authReady, pathname, user, goTo])

  useEffect(() => {
    if (!authReady) return
    if (user && pathname === ROUTES.auth) {
      goTo(dashboardPathForUser(user), { replace: true })
      return
    }
    if (!user && requiresAuth(pathname)) {
      goTo(ROUTES.auth, { replace: true })
    }
  }, [authReady, user, pathname, goTo])

  useEffect(() => {
    if (!authReady || !accessReady || !user) return
    if (user.role === 'admin' && pathname === ROUTES.analysis) {
      goTo(adminTabToPath('overview'), { replace: true })
      return
    }
    if (user.role !== 'admin' && !hasAnalysisAccess) {
      if (pathname === ROUTES.analysis || pathname === ROUTES.history) {
        goTo(ROUTES.dashboard, { replace: true })
      }
    }
  }, [authReady, accessReady, user, hasAnalysisAccess, pathname, goTo])

  const openDashboard = useCallback(() => {
    setReturnPath(pathname)
    goTo(dashboardPathForUser(user))
  }, [pathname, goTo, user])

  const openHistory = useCallback(() => {
    setReturnPath(pathname)
    goTo(ROUTES.history)
  }, [pathname, goTo])

  const dismissPaymentReturn = useCallback(() => {
    localStorage.removeItem(PAYMENT_SESSION_KEY)
    setPaymentReturn(null)
  }, [])

  const clearPaymentSession = useCallback(() => {
    localStorage.removeItem(PAYMENT_SESSION_KEY)
  }, [])

  const openBilling = useCallback(() => {
    // Customer billing page is deprecated — unpaid users pay via Stripe Checkout from /dashboard.
    setBillingMessage('')
    dismissPaymentReturn()
    goTo(ROUTES.dashboard)
  }, [goTo, dismissPaymentReturn])

  const startStripeCheckout = useCallback(async () => {
    if (!user) {
      goTo(ROUTES.auth)
      return
    }
    trackEvent('checkout_start', { provider: 'stripe', planId: 'myface_report' })
    const result = await createStripeCheckout()
    if (result?.checkoutUrl) {
      window.location.href = result.checkoutUrl
      return
    }
    throw new Error('Stripe checkout URL missing')
  }, [user, goTo])

  const resumeDraftAnalysis = useCallback(async (draft) => {
    if (!draft?.id) return
    if (!user || user.role === 'admin') return
    if (isBackendApiEnabled()) {
      try {
        const { submittedCount } = await fetchMyAssessmentsWithQuota(20)
        if (!canStartNewAssessment({ user, submittedCount })) {
          goTo(ROUTES.analysis)
          return
        }
      } catch {
        goTo(ROUTES.analysis)
        return
      }
    }
    clearAnalysisDraft(user.id)
    draftRestoreAttemptedRef.current = true
    setAnswers(draft.answers || INITIAL_ANSWERS)
    setPhotos(hydratePhotosFromAssessment(draft))
    setDraftAssessmentId(draft.id)
    const sid = draft.scanId || createHistoryId()
    activeScanIdRef.current = sid
    setScanId(sid)
    draftPromiseRef.current = Promise.resolve(draft.id)
    setAnalysis(null)
    setHistoryId(null)
    setSubmitError('')
    setQuestionnaireStartAtEnd(false)
    goTo(ROUTES.analysis)
    setAnalysisStep(ANALYSIS_STEPS.UPLOAD)
  }, [goTo, user])

  const openAuth = useCallback(() => {
    goTo(ROUTES.auth)
  }, [goTo])

  const startNewAnalysis = useCallback(async () => {
    if (!user) {
      goTo(ROUTES.auth)
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
        setHasAnalysisAccess(false)
        goTo(ROUTES.dashboard)
        return
      }
      // Package limit is enforced on /analysis (AnalysisEligibilityGate + backend 403).
      // Do not send limit-reached users to /report — there may be no active report to open.
      setBillingMessage('')
      clearAnalysisDraft(user.id)
      draftRestoreAttemptedRef.current = true
      setAnswers(INITIAL_ANSWERS)
      setPhotos(EMPTY_PHOTOS)
      setAnalysis(null)
      setCloudAssessment(null)
      setHistoryId(null)
      if (reportModalOpen) closeReportModal()
      const sid = createHistoryId()
      activeScanIdRef.current = sid
      setScanId(sid)
      setDraftAssessmentId(null)
      draftPromiseRef.current = null
      setSubmitError('')
      trackEvent('assessment_start')
      setQuestionnaireStartAtEnd(false)
      goTo(ROUTES.analysis)
      setAnalysisStep(ANALYSIS_STEPS.QUESTIONNAIRE)
    } catch {
      setBillingMessage('We could not verify payment access. Please check billing before starting analysis.')
      goTo(ROUTES.dashboard)
    }
  }, [user, goTo, reportModalOpen, closeReportModal])

  const startAnalysisAfterPayment = useCallback(() => {
    if (!user) {
      goTo(ROUTES.auth)
      return
    }
    dismissPaymentReturn()
    refreshAnalysisAccess().then(() => startNewAnalysis())
  }, [user, startNewAnalysis, refreshAnalysisAccess, dismissPaymentReturn])

  /**
   * Finalize the already-uploaded draft: enqueue the pipeline and drop the user on
   * the static Preparing page. Photos are uploaded during PhotoUpload, so this is
   * an instant metadata-only submit.
   */
  const submitAnalysis = useCallback(async () => {
    setSubmitError('')
    let draftId = draftAssessmentId
    try {
      if (!draftId) draftId = await ensureDraft()
      const result = await submitAssessment(draftId, { answers, provider: 'local' })
      if (user?.id) clearAnalysisDraft(user.id)
      setPreparingAssessmentId(draftId)
      setAnalysis({ ...result, assessmentId: draftId, processing: true, savedToDb: true })
      goToPreparing()
      trackEvent('assessment_submitted', {
        assessmentId: draftId,
        provider: 'backend',
      })
    } catch (err) {
      setSubmitError(err?.message || 'Could not submit your analysis. Please try again.')
    }
  }, [draftAssessmentId, ensureDraft, answers, goToPreparing, user?.id])

  const handlePreparingReady = useCallback((assessment) => {
    hydrateFromCloudAssessment(assessment)
    setCloudAssessment(isFullCloudAssessment(assessment) ? assessment : null)
    setPreparingAssessmentId(null)
    resetAnalysisFlow()
    openReportModal()
    goTo(ROUTES.report)
    trackEvent('assessment_complete', {
      success: true,
      provider: 'backend',
      savedToDb: true,
    })
  }, [hydrateFromCloudAssessment, openReportModal, resetAnalysisFlow, goTo])

  const handlePreparingDashboard = useCallback(() => {
    resetAnalysisFlow()
    goTo(ROUTES.dashboard)
  }, [resetAnalysisFlow, goTo])

  const logout = useCallback(() => {
    if (user?.id) clearAnalysisDraft(user.id)
    clearSession()
    setUser(null)
    setHasAnalysisAccess(false)
    accessCheckedOnceRef.current = false
    setAccessReady(true)
    localStorage.removeItem(STAGE_STORAGE_KEY)
    localStorage.removeItem(PAYMENT_SESSION_KEY)
    clearAdminTab()
    resetAdminWorkspace()
    setLogoutConfirmOpen(false)
    closeReportModal()
    resetAnalysisFlow()
    goTo(ROUTES.auth, { replace: true })
  }, [goTo, closeReportModal, resetAnalysisFlow, resetAdminWorkspace, user?.id])

  const handleAuthenticated = useCallback(async (nextUser) => {
    setUser(nextUser)
    if (nextUser?.role === 'admin') {
      setHasAnalysisAccess(true)
      setAccessReady(true)
      goTo(adminTabToPath('overview'), { replace: true })
      return
    }
    if (pathname === ROUTES.billing && (paymentReturn || localStorage.getItem(PAYMENT_SESSION_KEY))) {
      const sid = localStorage.getItem(PAYMENT_SESSION_KEY)
      if (sid) setPaymentReturn({ provider: 'stripe', sessionId: sid })
      await refreshAnalysisAccess(nextUser)
      goTo(ROUTES.dashboard, { replace: true })
      return
    }
    await refreshAnalysisAccess(nextUser)
    goTo(ROUTES.dashboard, { replace: true })
  }, [pathname, goTo, paymentReturn, refreshAnalysisAccess])

  const updateSessionUser = useCallback((nextUser) => {
    setUser(nextUser)
    const token = getAuthToken()
    if (token && nextUser) saveSession({ token, user: nextUser })
  }, [])

  const viewHistoryItem = useCallback((id) => {
    setHistoryId(id)
    setAnalysis(null)
    openReportModalOnRoute()
  }, [openReportModalOnRoute])

  const viewCloudAssessment = useCallback(async (assessment, sectionId = 'intro') => {
    const originPath = pathnameRef.current
    if (sectionId) setReportSectionId(sectionId)
    if (isAssessmentProcessing(assessment)) {
      alert('This analysis is still being prepared. Check back shortly from your dashboard.')
      return
    }
    if (!assessment?.id || !isBackendApiEnabled()) {
      if (pathnameRef.current !== originPath) return
      hydrateFromCloudAssessment(assessment)
      setCloudAssessment(null)
      openReportModalOnRoute()
      return
    }
    // Reuse in-memory full GET only for the same assessment; list summaries always refetch.
    if (cloudAssessment?.id === assessment.id && isFullCloudAssessment(cloudAssessment)) {
      if (pathnameRef.current !== originPath) return
      hydrateFromCloudAssessment(cloudAssessment)
      openReportModalOnRoute()
      return
    }
    setOpeningReportId(assessment.id)
    try {
      const full = await fetchAssessment(assessment.id)
      if (pathnameRef.current !== originPath) return
      hydrateFromCloudAssessment(full)
      setCloudAssessment(full)
      openReportModalOnRoute()
    } catch {
      if (pathnameRef.current !== originPath) return
      setCloudAssessment(null)
      setHistoryId(null)
      setAnalysis((prev) => (
        prev?.assessmentId && String(prev.assessmentId) === String(assessment.id) ? null : prev
      ))
      setLatestAssessmentEpoch((n) => n + 1)
      closeReportModal()
      if (pathnameRef.current !== ROUTES.dashboard) {
        goTo(ROUTES.dashboard)
      }
    } finally {
      setOpeningReportId(null)
    }
  }, [hydrateFromCloudAssessment, openReportModalOnRoute, cloudAssessment, closeReportModal, goTo])

  /** After soft-delete: drop stale binding and rebind report modal to the next active report if needed. */
  const afterAssessmentDeleted = useCallback(async (deletedId) => {
    if (!deletedId) return
    setLatestAssessmentEpoch((n) => n + 1)

    const boundCloud = cloudAssessment?.id && String(cloudAssessment.id) === String(deletedId)
    const boundAnalysis = analysis?.assessmentId && String(analysis.assessmentId) === String(deletedId)
    const wasModalOpen = reportModalOpen
    const sectionId = reportSectionId || 'intro'

    if (boundCloud) {
      setCloudAssessment(null)
      setHistoryId(null)
    }
    if (boundAnalysis) setAnalysis(null)

    // Unbound delete: epoch refresh is enough for dashboard/report gates.
    if (!boundCloud && !boundAnalysis) return
    if (!wasModalOpen) return

    try {
      if (!isBackendApiEnabled()) {
        closeReportModal()
        return
      }
      const items = await fetchMyAssessments(20)
      const submitted = (Array.isArray(items) ? items : []).filter(isAssessmentSubmitted)
      const next = submitted.find((item) => userReportReady(item)) || null
      if (next?.id) {
        await viewCloudAssessment(next, sectionId)
        return
      }
      closeReportModal()
    } catch {
      closeReportModal()
    }
  }, [
    cloudAssessment,
    analysis,
    reportModalOpen,
    reportSectionId,
    closeReportModal,
    viewCloudAssessment,
  ])

  /** Navbar: open latest ready cloud report at a report section (overview / aiVisuals / beautyAssistant). */
  const openReportSection = useCallback(async (sectionId = 'intro') => {
    const originPath = pathnameRef.current
    setReportSectionId(sectionId)
    const boundId = cloudAssessment?.id || analysis?.assessmentId
    if (reportModalOpen && boundId) {
      try {
        if (isBackendApiEnabled()) {
          await fetchAssessment(boundId)
        }
        return
      } catch {
        setCloudAssessment(null)
        setHistoryId(null)
        if (analysis?.assessmentId && String(analysis.assessmentId) === String(boundId)) {
          setAnalysis(null)
        }
        // Bound assessment soft-deleted or missing — fall through to latest.
      }
    }
    if (!user || user.role === 'admin') {
      if (pathnameRef.current !== originPath) return
      goTo(ROUTES.report)
      return
    }
    if (!hasAnalysisAccess) {
      if (pathnameRef.current !== originPath) return
      goTo(ROUTES.dashboard)
      return
    }
    try {
      if (!isBackendApiEnabled()) {
        if (pathnameRef.current !== originPath) return
        goTo(ROUTES.dashboard)
        return
      }
      const items = await fetchMyAssessments(20)
      if (pathnameRef.current !== originPath) return
      const submitted = (Array.isArray(items) ? items : []).filter(isAssessmentSubmitted)
      const next = submitted.find((item) => userReportReady(item)) || null
      if (!next) {
        goTo(ROUTES.dashboard)
        return
      }
      await viewCloudAssessment(next, sectionId)
    } catch (err) {
      if (pathnameRef.current !== originPath) return
      alert(err?.message || 'Could not open report')
      goTo(ROUTES.dashboard)
    }
  }, [
    reportModalOpen,
    cloudAssessment,
    analysis,
    user,
    hasAnalysisAccess,
    viewCloudAssessment,
    goTo,
  ])

  const skipQuestionnaireWithSampleData = useCallback(() => {
    setAnswers(DEV_SAMPLE_QUESTIONNAIRE_ANSWERS)
    setPhotos(EMPTY_PHOTOS)
    setAnalysis(null)
    setHistoryId(null)
    const sid = createHistoryId()
    activeScanIdRef.current = sid
    setScanId(sid)
    setDraftAssessmentId(null)
    draftPromiseRef.current = null
    setSubmitError('')
    setQuestionnaireStartAtEnd(false)
    goTo(ROUTES.analysis)
    setAnalysisStep(ANALYSIS_STEPS.CONFIRM)
  }, [goTo])

  const handleLogo = useCallback(() => {
    if (user) openDashboard()
    else goTo(ROUTES.auth)
  }, [user, openDashboard, goTo])

  const value = useMemo(() => ({
    user,
    authReady,
    hasAnalysisAccess,
    accessReady,
    refreshAnalysisAccess,
    answers,
    setAnswers,
    photos,
    setPhotos,
    analysis,
    historyId,
    dismissPaymentReturn,
    clearPaymentSession,
    grantPaidAccess,
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
    reportSectionId,
    setReportSectionId,
    reportToolbar,
    setReportToolbar,
    openingReportId,
    cloudAssessment,
    setCloudAssessment,
    latestAssessmentEpoch,
    afterAssessmentDeleted,
    primaryPhoto,
    pathname,
    goTo,
    goToStage,
    openDashboard,
    openHistory,
    openBilling,
    startStripeCheckout,
    openAuth,
    openReportSection,
    startNewAnalysis,
    resumeDraftAnalysis,
    startAnalysisAfterPayment,
    logout,
    handleAuthenticated,
    updateSessionUser,
    viewHistoryItem,
    viewCloudAssessment,
    adminWorkspace,
    loadAdminTab,
    refreshAdminTab,
    patchAdminWorkspace,
    skipQuestionnaireWithSampleData,
    handleLogo,
    openReportModal,
    closeReportModal,
    goToWelcome,
    goToQuestionnaire,
    goToConfirm,
    goToUpload,
    goToPreparing,
    preparingAssessmentId,
    draftAssessmentId,
    ensureDraft,
    submitAnalysis,
    submitError,
    handlePreparingReady,
    handlePreparingDashboard,
    resetAnalysisFlow,
  }), [
    user, authReady, hasAnalysisAccess, accessReady, refreshAnalysisAccess,
    answers, photos, analysis, historyId, dismissPaymentReturn, clearPaymentSession, grantPaidAccess, returnPath,
    billingMessage, paymentReturn, logoutConfirmOpen, scanId,
    adminWorkspace,
    questionnaireStartAtEnd, analysisStep, reportModalOpen, reportSectionId, reportToolbar, openingReportId, cloudAssessment, latestAssessmentEpoch, primaryPhoto, pathname,
    preparingAssessmentId, draftAssessmentId, submitError,
    goTo, goToStage, openDashboard, openHistory, openBilling, startStripeCheckout, openAuth, openReportSection, afterAssessmentDeleted, startNewAnalysis, resumeDraftAnalysis,
    startAnalysisAfterPayment, logout,
    handleAuthenticated, updateSessionUser, viewHistoryItem, viewCloudAssessment,
    adminWorkspace, loadAdminTab, refreshAdminTab, patchAdminWorkspace,
    skipQuestionnaireWithSampleData, handleLogo,
    openReportModal, closeReportModal, goToWelcome, goToQuestionnaire,
    goToConfirm, goToUpload, goToPreparing,
    ensureDraft, submitAnalysis,
    handlePreparingReady, handlePreparingDashboard, resetAnalysisFlow,
  ])

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}
