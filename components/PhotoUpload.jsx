import { useRef, useState, useEffect } from 'react'
import { Upload, CheckCircle2, Camera, Image, X, AlertTriangle, Info, Sparkles, ShieldCheck, CircleX, BadgeCheck, ArrowRight } from 'lucide-react'
import { PHOTO_POSES } from '../utils/constants'
import { OnboardingLayout } from './OnboardingLayout'
import { getAllDemoPhotos } from '../utils/demoPhotos'
import { validatePhoto } from '../utils/photoValidation'

const GUIDELINES = [
  'Good lighting — face clearly visible',
  'Neutral expression, eyes open',
  'Remove glasses and accessories',
  'Hair away from face',
  'Camera at eye level',
  'Plain background',
]

/** Icon + color for each check severity/state */
function CheckIcon({ pass, severity }) {
  if (pass) return <BadgeCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
  if (severity === 'error') return <CircleX className="w-3.5 h-3.5 text-red-500 shrink-0" />
  return <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
}

function QualityBadge({ result }) {
  if (!result) return null

  const failed = result.checks.filter((c) => !c.pass)
  const errors = failed.filter((c) => c.severity === 'error')
  const warnings = failed.filter((c) => c.severity === 'warning')

  if (result.overall === 'pass') {
    return (
      <div className="mt-2 p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20">
        <div className="flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-400 font-semibold">
          <ShieldCheck className="w-3.5 h-3.5" />
          Photo validation passed
        </div>
        <p className="text-[10px] text-emerald-600/70 dark:text-emerald-400/60 mt-0.5">
          All {result.checks.length} checks passed
        </p>
      </div>
    )
  }

  return (
    <div className="mt-2 p-2.5 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20">
      <div className="flex items-center gap-1.5 text-xs text-red-700 dark:text-red-400 font-semibold mb-1.5">
        <CircleX className="w-3.5 h-3.5" />
        Photo validation failed
      </div>
      <div className="space-y-1">
        {errors.map((c, i) => (
          <div key={`e${i}`} className="flex items-center gap-1.5 text-[11px] text-red-600 dark:text-red-400">
            <CheckIcon pass={false} severity="error" />
            {c.message}
          </div>
        ))}
        {warnings.map((c, i) => (
          <div key={`w${i}`} className="flex items-center gap-1.5 text-[11px] text-amber-600 dark:text-amber-400">
            <CheckIcon pass={false} severity="warning" />
            {c.message}
          </div>
        ))}
      </div>
    </div>
  )
}

export default function PhotoUpload({ photos, setPhotos, onStartAnalysis, onBack }) {
  const inputRef = useRef(null)
  const [dragOver, setDragOver] = useState(false)
  const [activePose, setActivePose] = useState('front')
  const [validation, setValidation] = useState({})
  const [validating, setValidating] = useState(false)

  const allPoses = PHOTO_POSES
  const totalUploaded = Object.values(photos).filter(Boolean).length
  const frontValidation = validation.front
  const frontPassed = frontValidation?.overall === 'pass'
  // Block when: no photo, validation still running (undefined), or any check failed.
  // Only allow when ALL checks pass.
  const canAnalyze = !!photos.front && frontPassed

  // Find the next unuploaded pose after the current one
  const getNextPose = (current) => {
    const idx = allPoses.findIndex((p) => p.id === current)
    // First try forward from current
    for (let i = idx + 1; i < allPoses.length; i++) {
      if (!photos[allPoses[i].id]) return allPoses[i].id
    }
    // Then wrap around
    for (let i = 0; i < idx; i++) {
      if (!photos[allPoses[i].id]) return allPoses[i].id
    }
    return null // all uploaded
  }

  const goToNextPhoto = () => {
    const next = getNextPose(activePose)
    if (next) setActivePose(next)
  }

  const hasNextPhoto = (() => {
    const next = getNextPose(activePose)
    return next !== null
  })()

  const handleFile = (file, poseId = activePose) => {
    if (!file?.type.startsWith('image/')) return
    const reader = new FileReader()
    reader.onload = (e) => {
      const dataUrl = e.target.result
      setPhotos((prev) => ({ ...prev, [poseId]: dataUrl }))
      // Auto-validate after upload
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

    allPoses.forEach((pose) => {
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

  // Re-validate on photo change (e.g., when switching tabs with pre-loaded photos)
  useEffect(() => {
    if (photos[activePose] && !validation[activePose]) {
      runValidation(photos[activePose], activePose)
    }
  }, [activePose])

  const currentPhoto = photos[activePose]
  const activePoseInfo = allPoses.find((p) => p.id === activePose)

  return (
    <OnboardingLayout
      stepIndex={6}
      sidebarTitle="Upload your photo"
      sidebarDesc="A clear front-facing portrait gives us the best data for landmark mapping and skin analysis."
      onBack={onBack}
      selectionLabel={canAnalyze ? `${totalUploaded} photo${totalUploaded > 1 ? 's' : ''} ready` : 'Front photo required'}
      onContinue={onStartAnalysis}
      continueLabel="Start Analysis"
      continueDisabled={!canAnalyze}
    >
      <div className="max-w-3xl pt-2">
        <h2 className="font-display text-xl sm:text-2xl font-semibold text-ink mb-1">Upload your photos</h2>
        <p className="text-sm text-ink-muted mb-4">
          Front-facing portrait required · Additional angles improve analysis accuracy
        </p>

        <button
          type="button"
          onClick={handleUseAllDemos}
          className="mb-6 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-brand bg-brand-50 dark:bg-brand-50/10 border border-brand/20 hover:bg-brand-100 dark:hover:bg-brand-50/20 transition-colors"
        >
          <Sparkles className="w-4 h-4" />
          Use all demo photos
        </button>

        {/* Photo pose tabs */}
        <div className="flex gap-1.5 mb-6">
          {allPoses.map((pose) => {
            const uploaded = !!photos[pose.id]
            const isActive = activePose === pose.id
            const vResult = validation[pose.id]
            const qualityOk = vResult?.overall === 'pass'
            const qualityWarn = vResult?.overall === 'warn'
            const qualityFail = vResult?.overall === 'fail'
            return (
              <button
                key={pose.id}
                onClick={() => setActivePose(pose.id)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                  isActive
                    ? 'bg-brand text-white shadow-brand'
                    : uploaded
                      ? qualityOk
                        ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20'
                        : qualityFail
                          ? 'bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-500/20'
                          : qualityWarn
                            ? 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/30'
                            : 'bg-brand-50 dark:bg-brand-50/20 text-brand border border-brand/20'
                      : 'bg-white dark:bg-surface-card border border-surface-border text-ink-secondary hover:border-brand/30'
                }`}
              >
                {uploaded ? qualityFail ? <CircleX className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" /> : <Camera className="w-3.5 h-3.5" />}
                {pose.label}
                {pose.required && <span className="text-[10px] opacity-70">*</span>}
              </button>
            )
          })}
        </div>

        <div className="grid lg:grid-cols-5 gap-6">
          <div className="lg:col-span-3">
            <p className="text-xs text-ink-muted mb-3">{activePoseInfo?.hint}</p>
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault()
                setDragOver(false)
                handleFile(e.dataTransfer.files[0], activePose)
              }}
              onClick={() => !currentPhoto && inputRef.current?.click()}
              className={`rounded-2xl border-2 border-dashed p-8 cursor-pointer transition-all duration-300 min-h-[280px] flex flex-col items-center justify-center ${
                dragOver
                  ? 'border-brand bg-brand-50 dark:bg-brand-50/10'
                  : currentPhoto
                    ? 'border-surface-border bg-white dark:bg-surface-card'
                    : 'border-surface-border bg-surface-warm dark:bg-surface-raised hover:border-brand/40 hover:bg-brand-50/50 dark:hover:bg-brand-50/5'
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
                <div className="relative w-full max-w-xs">
                  <img src={currentPhoto} alt="Upload preview" className="w-full rounded-2xl object-cover aspect-[4/5]" />
                  <div className="absolute inset-0 rounded-2xl ring-1 ring-brand/20" />
                  <div className="absolute top-3 right-3 flex gap-2">
                    <button
                      onClick={(e) => { e.stopPropagation(); inputRef.current?.click() }}
                      className="w-8 h-8 rounded-lg bg-white/90 dark:bg-surface-card/90 shadow-soft flex items-center justify-center text-ink-secondary hover:text-brand transition-colors"
                    >
                      <Image className="w-4 h-4" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); removePhoto(activePose) }}
                      className="w-8 h-8 rounded-lg bg-white/90 dark:bg-surface-card/90 shadow-soft flex items-center justify-center text-ink-muted hover:text-red-500 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <QualityBadge result={validation[activePose]} />
                  {validation[activePose] && validation[activePose].overall !== 'pass' && activePose === 'front' && (
                    <p className="text-[10px] text-red-500 dark:text-red-400 mt-1.5 font-medium">
                      Fix all issues above to proceed with analysis
                    </p>
                  )}
                  {validating && (
                    <div className="flex items-center gap-1.5 text-xs text-ink-muted mt-2">
                      <div className="w-3 h-3 rounded-full border-2 border-brand border-t-transparent animate-spin" />
                      Checking quality…
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center">
                  <div className="w-14 h-14 rounded-2xl bg-brand-50 dark:bg-brand-50/10 flex items-center justify-center mb-4 mx-auto">
                    <Upload className="w-6 h-6 text-brand" />
                  </div>
                  <p className="text-ink font-medium mb-1 text-sm">Drag & drop your photo here</p>
                  <p className="text-ink-muted text-xs">or click to browse · JPG, PNG, WEBP</p>
                </div>
              )}
              {/* Next Photo button — shown below the photo after upload when more photos can be added */}
              {currentPhoto && hasNextPhoto && (
                <button
                  onClick={(e) => { e.stopPropagation(); goToNextPhoto() }}
                  className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-brand text-white hover:bg-brand-600 shadow-brand transition-all"
                >
                  Next Photo
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}
              {currentPhoto && !hasNextPhoto && (
                <p className="mt-3 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                  ✓ All angles captured — you can start the analysis
                </p>
              )}
            </div>
          </div>

          <div className="lg:col-span-2 space-y-4">
            {/* Guidelines */}
            <div className="rounded-2xl border border-surface-border bg-white dark:bg-surface-card p-5 shadow-soft">
              <h3 className="font-display font-semibold mb-4 text-xs uppercase tracking-wider text-ink-muted">
                Photo Guidelines
              </h3>
              <ul className="space-y-2.5">
                {GUIDELINES.map((item) => (
                  <li key={item} className="flex items-start gap-2.5 text-xs">
                    <CheckCircle2 className="w-3.5 h-3.5 text-brand shrink-0 mt-0.5" />
                    <span className="text-ink-secondary">{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Upload status */}
            <div className="rounded-2xl border border-surface-border bg-white dark:bg-surface-card p-5 shadow-soft">
              <h3 className="font-display font-semibold mb-3 text-xs uppercase tracking-wider text-ink-muted">
                Upload Status
              </h3>
              <div className="space-y-2">
                {allPoses.map((pose) => {
                  const vResult = validation[pose.id]
                  return (
                    <div key={pose.id} className="flex items-center justify-between text-xs">
                      <span className={photos[pose.id] ? 'text-ink' : 'text-ink-muted'}>
                        {pose.label}
                        {pose.required && <span className="text-brand ml-1">*</span>}
                      </span>
                      {photos[pose.id] ? (
                        <span className="flex items-center gap-1.5">
                          {vResult?.overall === 'fail' ? (
                            <span className="text-red-500 font-medium">Failed</span>
                          ) : vResult?.overall === 'warn' ? (
                            <span className="text-amber-600 font-medium">Warning</span>
                          ) : vResult?.overall === 'pass' ? (
                            <span className="text-emerald-600 font-medium">Passed</span>
                          ) : (
                            <span className="text-brand font-medium">Uploaded</span>
                          )}
                        </span>
                      ) : (
                        <span className="text-ink-faint">Pending</span>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>


          </div>
        </div>
      </div>
    </OnboardingLayout>
  )
}
