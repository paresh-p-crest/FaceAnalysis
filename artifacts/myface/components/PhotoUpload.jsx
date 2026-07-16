'use client'

import { useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import {
  Upload,
  Image,
  X,
  Sparkles,
  ArrowRight,
  ChevronLeft,
  Check,
  Loader2,
  AlertCircle,
} from 'lucide-react'
import { PHOTO_POSES } from '../utils/constants'
import { getAllDemoPhotos } from '../utils/demoPhotos'
import { uploadAssessmentPhoto, deleteAssessmentPhoto } from '../utils/apiClient'
import { validatePhoto } from '../utils/photoValidation'

const CHECKLIST_ITEM_KEYS = [
  'glassesHat',
  'lighting',
  'background',
  'hair',
  'makeup',
  'clothing',
  'filters',
]

const GUIDELINE_KEYS = [
  'lookStraight',
  'neutralExpression',
  'clearObstructions',
  'armsLength',
  'oneHead',
  'notCropped',
  'notBlurry',
  'evenLighting',
  'plainBackground',
]

// Maps each REQUIRED_GUIDELINES index to the validation check name(s) from photoValidation.js
const GUIDELINE_CHECK_MAP = [
  ['faceCentered', 'correctPose'], // Look straight at the camera
  ['neutralExpression'],           // Maintain a neutral expression
  ['hairClear', 'noGlasses'],      // Remove hair and obstructions
  ['faceSize'],                    // Photo from arm's length away
  ['faceDetected'],                // Only one head visible
  ['faceSize'],                    // Head and neck not cropped
  ['sharpness'],                   // Keep camera focused and not blurry
  ['brightness'],                  // Ensure consistent, even lighting
  [],                              // Ensure a plain, clear background (no CV check)
]

const readAsDataUrl = (fileOrBlob) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => resolve(e.target.result)
    reader.onerror = () => reject(new Error('Could not read image data'))
    reader.readAsDataURL(fileOrBlob)
  })

/** Fetch a (demo) image URL into a File so it flows through the same upload path. */
const fileFromSrc = async (src, name) => {
  const res = await fetch(src)
  if (!res.ok) throw new Error(`Could not load image ${src}`)
  const blob = await res.blob()
  return new File([blob], name, { type: blob.type || 'image/jpeg' })
}

/** Overlay shown on the active-pose preview reflecting the per-pose upload state. */
function UploadStatusOverlay({ state, error, large = false, t }) {
  if (state === 'validating' || state === 'uploading') {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-2xl bg-black/25">
        <Loader2 className={`${large ? 'w-7 h-7' : 'w-5 h-5'} text-white animate-spin`} />
        <span className="text-[11px] font-semibold text-white tracking-wide">
          {state === 'validating' ? t('validating') : t('uploading')}
        </span>
      </div>
    )
  }
  if (state === 'uploaded') {
    return (
      <div className="absolute top-2 left-2 inline-flex items-center gap-1 rounded-full bg-emerald-500/90 px-2 py-0.5 text-[10px] font-semibold text-white shadow animate-fade-up">
        <Check className="w-3 h-3" /> {t('uploaded')}
      </div>
    )
  }
  if (state === 'error') {
    return (
      <div className="absolute inset-x-2 bottom-2 inline-flex items-center gap-1 rounded-lg bg-red-500/90 px-2 py-1 text-[10px] font-semibold text-white shadow">
        <AlertCircle className="w-3 h-3 shrink-0" />
        <span className="truncate">{error || t('checkPhotoReupload')}</span>
      </div>
    )
  }
  return null
}

export default function PhotoUpload({
  photos,
  setPhotos,
  onStartAnalysis,
  onBack,
  step,
  onConfirmComplete,
  ensureDraft,
  draftAssessmentId,
  submitError,
}) {
  const t = useTranslations('Photo.upload')
  const tPoses = useTranslations('Photo.poses')

  const POSES = PHOTO_POSES.map((p) => ({
    id: p.id,
    label: tPoses(`${p.id}.label`),
    desc: tPoses(`${p.id}.hint`),
    required: p.required,
  }))

  const inputRef = useRef(null)
  const filesRef = useRef({})
  const [confirmedChecks, setConfirmedChecks] = useState([false, false, false, false, false, false, false])
  const [dragOver, setDragOver] = useState(false)
  const [activePose, setActivePose] = useState('front')
  const [validation, setValidation] = useState({})
  // Per-pose lifecycle: idle | validating | uploading | uploaded | error
  const [uploadState, setUploadState] = useState({})
  const [uploadErrors, setUploadErrors] = useState({})
  const [loadingDemos, setLoadingDemos] = useState(false)

  const allChecked = confirmedChecks.every(Boolean)
  const requiredPoses = POSES.filter((p) => p.required)
  const requiredCount = requiredPoses.length
  const isUploaded = (id) => uploadState[id] === 'uploaded'
  const isBusy = (id) => uploadState[id] === 'validating' || uploadState[id] === 'uploading'
  const uploadedRequiredCount = requiredPoses.filter((p) => isUploaded(p.id)).length
  const allRequiredUploaded = uploadedRequiredCount === requiredCount
  const anyBusy = POSES.some((p) => isBusy(p.id))
  const canAnalyze = allRequiredUploaded && !anyBusy

  const setPoseState = (poseId, state) => setUploadState((prev) => ({ ...prev, [poseId]: state }))

  const uploadPose = async (file, poseId) => {
    setPoseState(poseId, 'uploading')
    setUploadErrors((prev) => ({ ...prev, [poseId]: '' }))
    try {
      const id = await ensureDraft()
      await uploadAssessmentPhoto(id, poseId, file)
      setPoseState(poseId, 'uploaded')
    } catch (err) {
      setPoseState(poseId, 'error')
      setUploadErrors((prev) => ({ ...prev, [poseId]: err?.message || t('uploadFailed') }))
    }
  }

  // Validate on a throwaway canvas copy (unchanged), then upload the ORIGINAL file.
  const processPose = async (dataUrl, file, poseId) => {
    setUploadErrors((prev) => ({ ...prev, [poseId]: '' }))
    setPoseState(poseId, 'validating')
    let result = null
    try {
      result = await validatePhoto(dataUrl, poseId)
      setValidation((prev) => ({ ...prev, [poseId]: result }))
    } catch {
      setValidation((prev) => ({ ...prev, [poseId]: null }))
    }
    if (!result || result.overall !== 'pass') {
      setPoseState(poseId, 'error')
      setUploadErrors((prev) => ({
        ...prev,
        [poseId]: t('qualityCheckFailed'),
      }))
      return
    }
    await uploadPose(file, poseId)
  }

  const handleFile = (file, poseId = activePose) => {
    if (!file?.type?.startsWith('image/')) return
    filesRef.current[poseId] = file
    const reader = new FileReader()
    reader.onload = (e) => {
      const dataUrl = e.target.result
      setPhotos((prev) => ({ ...prev, [poseId]: dataUrl }))
      processPose(dataUrl, file, poseId)
    }
    reader.readAsDataURL(file)
  }

  const handleUseAllDemos = async () => {
    const allDemos = getAllDemoPhotos()
    setLoadingDemos(true)
    try {
      const id = await ensureDraft()
      await Promise.all(
        POSES.map(async (pose) => {
          const src = allDemos[pose.id] || allDemos.front
          const file = await fileFromSrc(src, `${pose.id}.jpg`)
          const dataUrl = await readAsDataUrl(file)
          filesRef.current[pose.id] = file
          setPhotos((prev) => ({ ...prev, [pose.id]: dataUrl }))
          setValidation((prev) => ({
            ...prev,
            [pose.id]: { overall: 'pass', checks: [{ pass: true, messageKey: 'demoImage', severity: 'ok' }] },
          }))
          setPoseState(pose.id, 'uploading')
          await uploadAssessmentPhoto(id, pose.id, file)
          setPoseState(pose.id, 'uploaded')
        })
      )
      setActivePose('front')
    } catch (err) {
      alert(err?.message || t('demoLoadFailed'))
    } finally {
      setLoadingDemos(false)
    }
  }

  const removePhoto = async (poseId) => {
    const hadUpload = uploadState[poseId] === 'uploaded' || uploadState[poseId] === 'uploading'
    setPhotos((prev) => ({ ...prev, [poseId]: null }))
    setValidation((prev) => ({ ...prev, [poseId]: null }))
    setUploadErrors((prev) => ({ ...prev, [poseId]: '' }))
    setPoseState(poseId, 'idle')
    filesRef.current[poseId] = null
    if (hadUpload && draftAssessmentId) {
      try {
        await deleteAssessmentPhoto(draftAssessmentId, poseId)
      } catch {
        // Best-effort; the object becomes an orphan draft file (cleaned up later).
      }
    }
  }

  const currentPhoto = photos[activePose]
  const activePoseInfo = POSES.find((p) => p.id === activePose) || POSES[0]
  const activeState = uploadState[activePose] || (currentPhoto ? 'uploaded' : 'idle')
  const activeBusy = activeState === 'validating' || activeState === 'uploading'
  const activeErr = activeState === 'error'
  const activeUploaded = activeState === 'uploaded'
  const previewFilter = `transition-all duration-500 ${activeBusy ? 'blur-lg scale-105' : 'blur-0 scale-100'}`
  const previewRing = activeErr ? 'ring-2 ring-red-500' : activeUploaded ? 'ring-2 ring-emerald-400/70' : ''

  // Compute per-guideline status from active pose's validation result
  const getGuidelineStatus = (idx) => {
    if (!photos[activePose]) return 'idle'
    if (activeState === 'validating') return 'pending'
    const result = validation[activePose]
    if (!result) return 'idle'

    const checkNames = GUIDELINE_CHECK_MAP[idx]
    if (!checkNames || checkNames.length === 0) {
      return result.overall === 'pass' ? 'pass' : 'idle'
    }

    const relevant = result.checks.filter((c) => checkNames.includes(c.name))
    if (relevant.length === 0) return result.overall === 'pass' ? 'pass' : 'idle'
    if (relevant.some((c) => !c.pass && c.severity === 'error')) return 'fail'
    if (relevant.some((c) => !c.pass && c.severity === 'warning')) return 'warn'
    return 'pass'
  }

  // ── STEP 1: Instructions Confirmation View ──
  if (step === 'instructions') {
    return (
      <div className="min-h-screen h-screen flex flex-col lg:flex-row animate-fade-up bg-surface lg:overflow-hidden">
        {/* Left/Main Column */}
        <div className="w-full lg:w-[380px] shrink-0 bg-white dark:bg-surface-card lg:border-r border-surface-border px-8 py-10 flex flex-col">
          {/* Back + Title */}
          <div className="space-y-6">
            <button
              onClick={onBack}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              {t('back')}
            </button>

            <div className="pt-2">
              <span className="text-[10px] font-bold tracking-widest text-[#5e9f8b] uppercase block mb-1">
                {t('requirementsLabel')}
              </span>
              <h1 className="font-serif font-bold text-3xl tracking-tight text-slate-900 dark:text-white">
                {t('confirmationTitle')}
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mt-3">
                {t('confirmationDescription')}
              </p>
            </div>
          </div>

          {/* Checklist — MOBILE ONLY (shown inline, hidden on lg where right panel takes over) */}
          <div className="lg:hidden mt-6 space-y-2.5">
            <span className="text-[9px] uppercase tracking-wider text-[#5e9f8b] font-bold block">{t('requirementsHeading')}</span>
            <h3 className="text-slate-900 dark:text-white font-semibold text-sm mb-3">{t('checklistTitle')}</h3>
            {CHECKLIST_ITEM_KEYS.map((itemKey, idx) => (
              <label
                key={idx}
                className={`flex items-center justify-between p-3.5 rounded-xl border transition-all cursor-pointer ${
                  confirmedChecks[idx]
                    ? 'bg-[#5e9f8b]/10 border-[#5e9f8b]/30 dark:bg-[#5e9f8b]/10'
                    : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <span className="text-slate-800 dark:text-slate-200 text-xs font-sans leading-snug pr-4">{t(`checklist.${itemKey}`)}</span>
                <input
                  type="checkbox"
                  checked={confirmedChecks[idx]}
                  onChange={(e) => {
                    const next = [...confirmedChecks]
                    next[idx] = e.target.checked
                    setConfirmedChecks(next)
                  }}
                  className="w-4 h-4 rounded border-slate-300 text-[#5e9f8b] focus:ring-[#5e9f8b] focus:ring-offset-0 shrink-0"
                />
              </label>
            ))}
          </div>

          {/* Spacer pushes button to bottom on desktop */}
          <div className="flex-1" />

          {/* Next Button */}
          <div className="pt-6 mt-6 border-t border-slate-100 dark:border-slate-800">
            <button
              onClick={onConfirmComplete}
              disabled={!allChecked}
              className={`w-full py-3 rounded-[50px] font-semibold text-xs tracking-[-0.03px] transition-all flex items-center justify-between px-6 ${
                allChecked
                  ? 'bg-[#5e9f8b] hover:bg-[#548f7d] text-white cursor-pointer shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-600 cursor-not-allowed'
              }`}
            >
              <span>{t('next')}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Right Column (Dark Slate-Teal Visual Page) — DESKTOP ONLY */}
        <div className="hidden lg:flex flex-1 flex-col justify-center items-center p-12 bg-gradient-to-br from-[#0d1e1f] via-[#091516] to-[#04090a] relative">
          <div className="absolute top-10 left-10">
            <span className="font-serif font-bold text-white text-2xl tracking-tight">MyFace</span>
          </div>

          <div className="max-w-xl w-full bg-white/[0.03] backdrop-blur-md rounded-3xl p-8 border border-white/10 shadow-2xl space-y-6">
            <div>
              <span className="text-[9px] uppercase tracking-wider text-[#5e9f8b] font-bold block mb-1">{t('requirementsHeading')}</span>
              <h3 className="text-white font-serif text-lg font-bold">{t('checklistTitle')}</h3>
            </div>

            <div className="space-y-3 max-h-[480px] overflow-y-auto pr-1.5 scrollbar-thin">
              {CHECKLIST_ITEM_KEYS.map((itemKey, idx) => (
                <label
                  key={idx}
                  className={`flex items-center justify-between p-4 rounded-xl border transition-all cursor-pointer ${
                    confirmedChecks[idx]
                      ? 'bg-[#5e9f8b]/10 border-[#5e9f8b]/30'
                      : 'bg-white/[0.02] border-white/5 hover:bg-white/[0.04]'
                  }`}
                >
                  <span className="text-white text-xs font-sans leading-snug pr-4">{t(`checklist.${itemKey}`)}</span>
                  <input
                    type="checkbox"
                    checked={confirmedChecks[idx]}
                    onChange={(e) => {
                      const next = [...confirmedChecks]
                      next[idx] = e.target.checked
                      setConfirmedChecks(next)
                    }}
                    className="w-4 h-4 rounded border-white/20 text-[#5e9f8b] focus:ring-[#5e9f8b] focus:ring-offset-0 bg-transparent shrink-0"
                  />
                </label>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── STEP 2: Main Image Upload View ──
  return (
    <div className="min-h-screen h-screen flex flex-col lg:flex-row animate-fade-up bg-surface lg:overflow-hidden">
      {/* Left/Main Column */}
      <div className="w-full lg:w-[380px] shrink-0 bg-white dark:bg-surface-card lg:border-r border-surface-border flex flex-col">

        {/* Fixed Header */}
        <div className="px-7 pt-7 pb-4 shrink-0 space-y-4">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            {t('backToRequirements')}
          </button>

          <div>
            <h1 className="font-serif font-bold text-xl tracking-tight text-slate-900 dark:text-white">
              {t('uploadTitle')}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mt-1">
              {t('uploadDescription')}
            </p>
          </div>

          {/* Quick Demo Photo Injector — dev only, kept small */}
          <button
            type="button"
            onClick={handleUseAllDemos}
            disabled={loadingDemos}
            className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-400 hover:text-[#5e9f8b] transition-colors disabled:opacity-50"
          >
            <Sparkles className="w-3 h-3" />
            {loadingDemos ? t('loadingDemoPhotos') : t('useDemoPhotos')}
          </button>
        </div>

        {/* Scrollable Middle Content */}
        <div className="flex-1 min-h-0 overflow-y-auto px-7 space-y-4 pb-2">
          {/* Required Poses Grid */}
          <div className="space-y-2">
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 dark:text-slate-500">
              {t('posesUploaded', { uploaded: uploadedRequiredCount, total: requiredCount })}
            </span>
            <div className="grid grid-cols-2 gap-2">
              {POSES.map((pose) => {
                const isActive = activePose === pose.id
                const st = uploadState[pose.id]
                const subtitle =
                  st === 'uploaded' ? t('statusUploaded')
                    : st === 'uploading' ? t('statusUploading')
                      : st === 'validating' ? t('statusChecking')
                        : st === 'error' ? t('statusNeedsAttention')
                          : t('statusPending')

                return (
                  <button
                    key={pose.id}
                    onClick={() => setActivePose(pose.id)}
                    className={`p-2.5 rounded-xl border text-left transition-all relative ${
                      isActive
                        ? 'border-[#5e9f8b] bg-[#5e9f8b]/5 dark:bg-[#5e9f8b]/10'
                        : 'border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700 bg-slate-50/50 dark:bg-slate-950/20'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-xs font-bold leading-tight">{pose.label}</span>
                      {(st === 'validating' || st === 'uploading') ? (
                        <Loader2 className="w-3 h-3 text-[#5e9f8b] animate-spin" />
                      ) : st === 'uploaded' ? (
                        <span className="text-emerald-500 text-[10px]">✓</span>
                      ) : st === 'error' ? (
                        <span className="text-red-500 text-[10px]">✕</span>
                      ) : photos[pose.id] ? (
                        <span className="text-[#5e9f8b] text-[10px]">●</span>
                      ) : null}
                    </div>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 line-clamp-1">
                      {subtitle}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Mobile-only Upload Zone — shown between poses and guidelines on small screens */}
          <div className="lg:hidden space-y-2">
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 dark:text-slate-500">
              {t('uploadActivePose', { pose: activePoseInfo.label })}
            </span>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">{activePoseInfo.desc}</p>
            <div
              onClick={() => !currentPhoto && inputRef.current?.click()}
              className={`rounded-2xl border p-5 cursor-pointer transition-all flex flex-col items-center justify-center gap-3 ${
                currentPhoto
                  ? 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900'
                  : 'border-dashed border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-950/50 hover:bg-slate-100 dark:hover:bg-slate-900'
              }`}
            >
              {currentPhoto ? (
                <div className="w-full flex flex-col items-center gap-3">
                  <div className="relative">
                    <img
                      src={currentPhoto}
                      alt={t('previewAlt')}
                      className={`w-28 h-36 rounded-xl object-cover shadow-md ${previewFilter} ${previewRing}`}
                    />
                    <UploadStatusOverlay state={activeState} error={uploadErrors[activePose]} t={t} />
                    <div className="absolute top-1 right-1 flex gap-1">
                      <button
                        onClick={(e) => { e.stopPropagation(); inputRef.current?.click() }}
                        className="w-6 h-6 rounded-md bg-black/70 flex items-center justify-center text-white"
                      >
                        <Image className="w-3 h-3" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); removePhoto(activePose) }}
                        className="w-6 h-6 rounded-md bg-black/70 flex items-center justify-center text-white hover:text-red-400"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <div className="w-10 h-10 rounded-full bg-[#5e9f8b]/10 flex items-center justify-center">
                    <Upload className="w-4 h-4 text-[#5e9f8b]" />
                  </div>
                  <div className="text-center">
                    <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">{t('tapToUpload')}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">{t('fileTypesShort')}</p>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Detailed requirements list — live validation status per item */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 dark:text-slate-500">
                {t('required')}
              </span>
              {activeState === 'validating' && (
                <span className="flex items-center gap-1 text-[10px] text-[#5e9f8b]">
                  <span className="w-2.5 h-2.5 rounded-full border border-[#5e9f8b] border-t-transparent animate-spin" />
                  {t('checking')}
                </span>
              )}
            </div>
            <ul className="space-y-1.5 border border-slate-100 dark:border-slate-800 rounded-xl p-3 bg-slate-50/50 dark:bg-slate-950/20 max-h-[180px] overflow-y-auto lg:max-h-none lg:overflow-visible">
              {GUIDELINE_KEYS.map((guidelineKey, idx) => {
                const status = getGuidelineStatus(idx)
                return (
                  <li key={guidelineKey} className="flex items-start gap-2 text-[11px] leading-normal">
                    {status === 'idle' && <span className="text-slate-300 dark:text-slate-600 shrink-0 font-bold mt-px">○</span>}
                    {status === 'pending' && <span className="w-2.5 h-2.5 rounded-full border border-[#5e9f8b] border-t-transparent animate-spin shrink-0 mt-0.5" />}
                    {status === 'pass' && <span className="text-[#5e9f8b] font-bold shrink-0">✓</span>}
                    {status === 'warn' && <span className="text-amber-500 font-bold shrink-0">‼</span>}
                    {status === 'fail' && <span className="text-red-500 font-bold shrink-0">✕</span>}
                    <span className={
                      status === 'fail' ? 'text-red-500 dark:text-red-400' :
                      status === 'warn' ? 'text-amber-600 dark:text-amber-400' :
                      'text-slate-600 dark:text-slate-400'
                    }>{t(`guidelines.${guidelineKey}`)}</span>
                  </li>
                )
              })}
            </ul>
          </div>
        </div>

        {/* Fixed Footer — Continue Button */}
        <div className="px-7 py-5 border-t border-slate-100 dark:border-slate-800 shrink-0">
          <button
            onClick={onStartAnalysis}
            disabled={!canAnalyze}
            className={`w-full py-3 rounded-[50px] font-semibold text-xs tracking-[-0.03px] transition-all flex items-center justify-between px-6 ${
              canAnalyze
                ? 'bg-[#5e9f8b] hover:bg-[#548f7d] text-white cursor-pointer shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-600 cursor-not-allowed'
            }`}
          >
            <span>{t('continue')}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
          {submitError && (
            <p className="text-[10px] text-red-500 text-center mt-2">{submitError}</p>
          )}
          {!canAnalyze && !submitError && (
            <p className="text-[9px] text-slate-400 dark:text-slate-500 text-center mt-2">
              {!allRequiredUploaded
                ? t('uploadAllRequired', { count: requiredCount, uploaded: uploadedRequiredCount })
                : t('finishingUpload')}
            </p>
          )}
        </div>
      </div>

      {/* Right Column (Dark Slate-Teal Visual Page) */}
      <div className="hidden lg:flex flex-1 flex-col justify-center items-center p-12 bg-gradient-to-br from-[#0d1e1f] via-[#091516] to-[#04090a] relative">
        <div className="absolute top-10 left-10">
          <span className="font-serif font-bold text-white text-2xl tracking-tight">MyFace</span>
        </div>

        {/* Center Glassmorphic Dropzone */}
        <div className="max-w-xl w-full mx-auto my-auto space-y-6">
          <div className="text-center space-y-1.5">
            <span className="text-[9px] uppercase tracking-wider text-[#5e9f8b] font-bold block">
              {t('activePose')}
            </span>
            <h2 className="text-white font-serif text-2xl font-bold">{activePoseInfo.label}</h2>
            <p className="text-xs text-slate-400 font-sans max-w-sm mx-auto">
              {activePoseInfo.desc}
            </p>
          </div>

          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault()
              setDragOver(false)
              handleFile(e.dataTransfer.files[0], activePose)
            }}
            onClick={() => !currentPhoto && inputRef.current?.click()}
            className={`rounded-3xl border border-white/10 p-8 cursor-pointer transition-all duration-300 min-h-[340px] flex flex-col items-center justify-center relative ${
              dragOver
                ? 'bg-white/10 border-[#5e9f8b]'
                : currentPhoto
                  ? 'bg-white/[0.02]'
                  : 'bg-white/[0.03] backdrop-blur-md shadow-2xl hover:bg-white/[0.05] hover:border-white/20'
            }`}
          >
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => handleFile(e.target.files[0], activePose)}
            />

            {currentPhoto ? (
              <div className="relative w-full max-w-xs flex flex-col items-center">
                <div className="relative">
                  <img
                    src={currentPhoto}
                    alt={t('uploadPreviewAlt')}
                    className={`w-48 h-60 rounded-2xl object-cover shadow-2xl border border-white/10 ${previewFilter} ${previewRing}`}
                  />
                  <UploadStatusOverlay state={activeState} error={uploadErrors[activePose]} large t={t} />
                </div>
                <div className="absolute top-2 right-12 flex gap-1.5">
                  <button
                    onClick={(e) => { e.stopPropagation(); inputRef.current?.click() }}
                    className="w-8 h-8 rounded-lg bg-black/70 backdrop-blur-sm shadow-soft flex items-center justify-center text-white hover:text-[#5e9f8b] transition-colors"
                    title={t('changePhoto')}
                  >
                    <Image className="w-4 h-4" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); removePhoto(activePose) }}
                    className="w-8 h-8 rounded-lg bg-black/70 backdrop-blur-sm shadow-soft flex items-center justify-center text-white hover:text-red-500 transition-colors"
                    title={t('deletePhoto')}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center space-y-4">
                <div className="w-14 h-14 rounded-full bg-white/5 flex items-center justify-center mx-auto border border-white/10">
                  <Upload className="w-5 h-5 text-[#5e9f8b]" />
                </div>
                <div>
                  <p className="text-white text-xs font-semibold">
                    {t('dragDropOrChoose')}
                  </p>
                  <p className="text-slate-450 text-[10px] mt-1">
                    {t('fileTypesLong')}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
