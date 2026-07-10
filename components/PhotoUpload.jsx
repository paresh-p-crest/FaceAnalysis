import { useRef, useState, useEffect } from 'react'
import {
  Upload,
  Image,
  X,
  Sparkles,
  ArrowRight,
  ChevronLeft
} from 'lucide-react'
import { PHOTO_POSES } from '../utils/constants'
import { getAllDemoPhotos } from '../utils/demoPhotos'
import { validatePhoto } from '../utils/photoValidation'

const POSES = PHOTO_POSES.map((p) => ({
  id: p.id,
  label: p.label,
  desc: p.hint,
  required: p.required,
}))

const REQUIRED_GUIDELINES = [
  'Look straight at the camera',
  'Maintain a neutral expression',
  'Remove hair and obstructions from the face',
  'Photo taken from an arm\'s length away',
  'Only one head should be visible in the image',
  'The head and neck are not cropped out',
  'Keep camera focused and not blurry',
  'Ensure consistent, even lighting',
  'Ensure a plain, clear background',
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

const CHECKLIST_ITEMS = [
  'Take off any glasses and hat',
  'Use natural, even lighting that illuminates your face directly',
  'Use a plain & white background',
  'Tie long hair back to clear up the face, neck and ears',
  'Remove any makeup',
  'Avoid neck-covering clothes',
  'Don\'t use filters on the pictures',
]

export default function PhotoUpload({ photos, setPhotos, onStartAnalysis, onBack, step, onConfirmComplete }) {
  const inputRef = useRef(null)
  const [confirmedChecks, setConfirmedChecks] = useState([false, false, false, false, false, false, false])
  const [dragOver, setDragOver] = useState(false)
  const [activePose, setActivePose] = useState('front')
  const [validation, setValidation] = useState({})
  const [validating, setValidating] = useState(false)

  const allChecked = confirmedChecks.every(Boolean)
  const requiredPoses = POSES.filter((p) => p.required)
  const requiredCount = requiredPoses.length
  const uploadedRequiredCount = requiredPoses.filter((p) => !!photos[p.id]).length
  const allRequiredUploaded = uploadedRequiredCount === requiredCount
  const allRequiredPass = requiredPoses.every(
    (pose) => photos[pose.id] && validation[pose.id]?.overall === 'pass'
  )
  const canAnalyze = allRequiredUploaded && allRequiredPass

  const handleFile = (file, poseId = activePose) => {
    if (!file?.type.startsWith('image/')) return
    const reader = new FileReader()
    reader.onload = (e) => {
      const dataUrl = e.target.result
      setPhotos((prev) => ({ ...prev, [poseId]: dataUrl }))
      runValidation(dataUrl, poseId)
    }
    reader.readAsDataURL(file)
  }

  const runValidation = async (dataUrl, poseId) => {
    setValidating(true)
    try {
      const result = await validatePhoto(dataUrl, poseId)
      setValidation((prev) => ({ ...prev, [poseId]: result }))
    } catch {
      setValidation((prev) => ({ ...prev, [poseId]: null }))
    }
    setValidating(false)
  }

  const handleUseAllDemos = () => {
    const allDemos = getAllDemoPhotos()
    const demoValidation = {}
    const demoPhotos = {}

    POSES.forEach((pose) => {
      demoPhotos[pose.id] = allDemos[pose.id] || allDemos.front
      demoValidation[pose.id] = {
        overall: 'pass',
        checks: [{ pass: true, message: 'Demo image', severity: 'ok' }],
      }
    })

    setPhotos((prev) => ({ ...prev, ...demoPhotos }))
    setValidation((prev) => ({ ...prev, ...demoValidation }))
    setActivePose('front')
  }

  const removePhoto = (poseId) => {
    setPhotos((prev) => ({ ...prev, [poseId]: null }))
    setValidation((prev) => ({ ...prev, [poseId]: null }))
  }

  useEffect(() => {
    if (photos[activePose] && !validation[activePose]) {
      runValidation(photos[activePose], activePose)
    }
  }, [activePose])

  const currentPhoto = photos[activePose]
  const activePoseInfo = POSES.find((p) => p.id === activePose) || POSES[0]

  // Compute per-guideline status from active pose's validation result
  const getGuidelineStatus = (idx) => {
    if (!photos[activePose]) return 'idle'
    if (validating) return 'pending'
    const result = validation[activePose]
    if (!result) return 'idle'

    const checkNames = GUIDELINE_CHECK_MAP[idx]
    if (!checkNames || checkNames.length === 0) {
      // No CV check mapped — treat as passing once photo is uploaded and overall passes
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
              Back
            </button>

            <div className="pt-2">
              <span className="text-[10px] font-bold tracking-widest text-[#5e9f8b] uppercase block mb-1">
                Photo Requirements
              </span>
              <h1 className="font-serif font-bold text-3xl tracking-tight text-slate-900 dark:text-white">
                Confirmation
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mt-3">
                Please review and confirm the following photo guidelines to ensure accurate results.
              </p>
            </div>
          </div>

          {/* Checklist — MOBILE ONLY (shown inline, hidden on lg where right panel takes over) */}
          <div className="lg:hidden mt-6 space-y-2.5">
            <span className="text-[9px] uppercase tracking-wider text-[#5e9f8b] font-bold block">Requirements</span>
            <h3 className="text-slate-900 dark:text-white font-semibold text-sm mb-3">Photo Guidelines Checklist</h3>
            {CHECKLIST_ITEMS.map((item, idx) => (
              <label
                key={idx}
                className={`flex items-center justify-between p-3.5 rounded-xl border transition-all cursor-pointer ${
                  confirmedChecks[idx]
                    ? 'bg-[#5e9f8b]/10 border-[#5e9f8b]/30 dark:bg-[#5e9f8b]/10'
                    : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <span className="text-slate-800 dark:text-slate-200 text-xs font-sans leading-snug pr-4">{item}</span>
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
              <span>Next</span>
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
              <span className="text-[9px] uppercase tracking-wider text-[#5e9f8b] font-bold block mb-1">Requirements</span>
              <h3 className="text-white font-serif text-lg font-bold">Photo Guidelines Checklist</h3>
            </div>

            <div className="space-y-3 max-h-[480px] overflow-y-auto pr-1.5 scrollbar-thin">
              {CHECKLIST_ITEMS.map((item, idx) => (
                <label
                  key={idx}
                  className={`flex items-center justify-between p-4 rounded-xl border transition-all cursor-pointer ${
                    confirmedChecks[idx]
                      ? 'bg-[#5e9f8b]/10 border-[#5e9f8b]/30'
                      : 'bg-white/[0.02] border-white/5 hover:bg-white/[0.04]'
                  }`}
                >
                  <span className="text-white text-xs font-sans leading-snug pr-4">{item}</span>
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
            Back to requirements
          </button>

          <div>
            <h1 className="font-serif font-bold text-xl tracking-tight text-slate-900 dark:text-white">
              Upload Your Images
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mt-1">
              You&apos;re almost done! Once we have your images, we can begin your facial analysis.
            </p>
          </div>

          {/* Quick Demo Photo Injector — dev only, kept small */}
          <button
            type="button"
            onClick={handleUseAllDemos}
            className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-400 hover:text-[#5e9f8b] transition-colors"
          >
            <Sparkles className="w-3 h-3" />
            Use demo photos
          </button>
        </div>

        {/* Scrollable Middle Content */}
        <div className="flex-1 min-h-0 overflow-y-auto px-7 space-y-4 pb-2">
          {/* Required Poses Grid */}
          <div className="space-y-2">
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 dark:text-slate-500">
              Poses Required ({uploadedRequiredCount}/{requiredCount})
            </span>
            <div className="grid grid-cols-2 gap-2">
              {POSES.map((pose) => {
                const uploaded = !!photos[pose.id]
                const isActive = activePose === pose.id
                const vResult = validation[pose.id]
                const qualityOk = vResult?.overall === 'pass'
                const qualityFail = vResult?.overall === 'fail'

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
                      {uploaded && (
                        qualityFail ? (
                          <span className="text-red-500 text-[10px]">✕</span>
                        ) : qualityOk ? (
                          <span className="text-emerald-500 text-[10px]">✓</span>
                        ) : (
                          <span className="text-[#5e9f8b] text-[10px]">●</span>
                        )
                      )}
                    </div>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 line-clamp-1">
                      {uploaded ? 'Uploaded' : 'Pending'}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Mobile-only Upload Zone — shown between poses and guidelines on small screens */}
          <div className="lg:hidden space-y-2">
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 dark:text-slate-500">
              Upload — {activePoseInfo.label}
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
                    <img src={currentPhoto} alt="Preview" className="w-28 h-36 rounded-xl object-cover shadow-md" />
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
                    <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">Tap to upload photo</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">JPG, PNG, WEBP</p>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Detailed requirements list — live validation status per item */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 dark:text-slate-500">
                Required
              </span>
              {validating && (
                <span className="flex items-center gap-1 text-[10px] text-[#5e9f8b]">
                  <span className="w-2.5 h-2.5 rounded-full border border-[#5e9f8b] border-t-transparent animate-spin" />
                  Checking…
                </span>
              )}
            </div>
            <ul className="space-y-1.5 border border-slate-100 dark:border-slate-800 rounded-xl p-3 bg-slate-50/50 dark:bg-slate-950/20 max-h-[180px] overflow-y-auto lg:max-h-none lg:overflow-visible">
              {REQUIRED_GUIDELINES.map((item, idx) => {
                const status = getGuidelineStatus(idx)
                return (
                  <li key={idx} className="flex items-start gap-2 text-[11px] leading-normal">
                    {status === 'idle' && <span className="text-slate-300 dark:text-slate-600 shrink-0 font-bold mt-px">○</span>}
                    {status === 'pending' && <span className="w-2.5 h-2.5 rounded-full border border-[#5e9f8b] border-t-transparent animate-spin shrink-0 mt-0.5" />}
                    {status === 'pass' && <span className="text-[#5e9f8b] font-bold shrink-0">✓</span>}
                    {status === 'warn' && <span className="text-amber-500 font-bold shrink-0">‼</span>}
                    {status === 'fail' && <span className="text-red-500 font-bold shrink-0">✕</span>}
                    <span className={
                      status === 'fail' ? 'text-red-500 dark:text-red-400' :
                      status === 'warn' ? 'text-amber-600 dark:text-amber-400' :
                      'text-slate-600 dark:text-slate-400'
                    }>{item}</span>
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
            <span>Continue</span>
            <ArrowRight className="w-4 h-4" />
          </button>
          {!canAnalyze && (
            <p className="text-[9px] text-slate-400 dark:text-slate-500 text-center mt-2">
              {!allRequiredUploaded
                ? `* Upload all ${requiredCount} required photos to continue (${uploadedRequiredCount}/${requiredCount})`
                : '* All photos must pass validation checks to continue'}
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
              Active Pose
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
                <img
                  src={currentPhoto}
                  alt="Upload preview"
                  className="w-48 h-60 rounded-2xl object-cover shadow-2xl border border-white/10"
                />
                <div className="absolute top-2 right-12 flex gap-1.5">
                  <button
                    onClick={(e) => { e.stopPropagation(); inputRef.current?.click() }}
                    className="w-8 h-8 rounded-lg bg-black/70 backdrop-blur-sm shadow-soft flex items-center justify-center text-white hover:text-[#5e9f8b] transition-colors"
                    title="Change Photo"
                  >
                    <Image className="w-4 h-4" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); removePhoto(activePose) }}
                    className="w-8 h-8 rounded-lg bg-black/70 backdrop-blur-sm shadow-soft flex items-center justify-center text-white hover:text-red-500 transition-colors"
                    title="Delete Photo"
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
                    Drag and drop or Choose file upload
                  </p>
                  <p className="text-slate-450 text-[10px] mt-1">
                    Supports JPG, PNG, WEBP files
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
