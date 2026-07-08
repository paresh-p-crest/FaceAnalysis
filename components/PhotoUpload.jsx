import { useRef, useState, useEffect } from 'react'
import { Upload, CheckCircle2, Camera, Image, X, AlertTriangle, Sparkles, ShieldCheck, CircleX, BadgeCheck } from 'lucide-react'
import { PHOTO_POSES } from '../utils/constants'
import { OnboardingLayout } from './OnboardingLayout'
import { getAllDemoPhotos } from '../utils/demoPhotos'
import { validatePhoto } from '../utils/photoValidation'

function CheckIcon({ pass, severity }) {
  if (pass) return <BadgeCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
  if (severity === 'error') return <CircleX className="w-3.5 h-3.5 text-red-500 shrink-0" />
  return <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
}

function QualityBadge({ result, onViewDetails }) {
  if (!result) return null

  const failed = result.checks.filter((c) => !c.pass)
  const errors = failed.filter((c) => c.severity === 'error')
  const warnings = failed.filter((c) => c.severity === 'warning')
  const totalIssues = errors.length + warnings.length

  if (result.overall === 'pass') {
    return (
      <div className="mt-2 p-2 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20">
        <div className="flex items-center gap-1 text-[11px] text-emerald-700 dark:text-emerald-400 font-semibold justify-center">
          <ShieldCheck className="w-3.5 h-3.5" />
          Validation passed
        </div>
      </div>
    )
  }

  return (
    <div className="mt-2 p-2 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-center">
      <div className="flex items-center justify-between gap-2 text-[11px] text-red-700 dark:text-red-400 font-semibold">
        <div className="flex items-center gap-1">
          <CircleX className="w-3.5 h-3.5" />
          <span>Issues ({totalIssues})</span>
        </div>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onViewDetails() }}
          className="text-[10px] text-brand hover:underline font-bold focus:outline-none shrink-0"
        >
          View details
        </button>
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
  const [showDetailsModal, setShowDetailsModal] = useState(false)
  const [showLightbox, setShowLightbox] = useState(false)

  const allPoses = PHOTO_POSES
  const totalUploaded = Object.values(photos).filter(Boolean).length
  const frontValidation = validation.front
  const frontPassed = frontValidation?.overall === 'pass'
  const canAnalyze = !!photos.front && frontPassed

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
      <div className="max-w-3xl pt-1">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <div>
            <h2 className="font-display text-xl sm:text-2xl font-semibold text-ink">Upload your photos</h2>
            <p className="text-xs text-ink-muted mt-0.5">
              Front-facing portrait required · Additional angles improve precision
            </p>
          </div>

          <button
            type="button"
            onClick={handleUseAllDemos}
            className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-brand bg-brand-50 dark:bg-brand-50/10 border border-brand/20 hover:bg-brand-100 transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Use demo photos
          </button>
        </div>

        {/* Photo pose tabs — Swipeable on mobile */}
        <div className="flex overflow-x-auto gap-1.5 mb-4 scrollbar-none select-none -mx-4 px-4 sm:mx-0 sm:px-0">
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
                className={`shrink-0 flex items-center gap-1 px-3 py-2 rounded-lg text-[11px] font-medium transition-all ${
                  isActive
                    ? 'bg-brand text-white shadow-sm'
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
                <span>{pose.label}</span>
                {pose.required && <span className="text-[9px] opacity-70 ml-0.5">*</span>}
              </button>
            )
          })}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          <div className="lg:col-span-3">
            <p className="text-[11px] text-ink-muted mb-2 font-medium">{activePoseInfo?.hint}</p>
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault()
                setDragOver(false)
                handleFile(e.dataTransfer.files[0], activePose)
              }}
              onClick={() => !currentPhoto && inputRef.current?.click()}
              className={`rounded-2xl border-2 border-dashed p-4 cursor-pointer transition-all duration-200 min-h-[160px] flex flex-col items-center justify-center ${
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
                <div className="relative w-full max-w-[200px]">
                  <img
                    src={currentPhoto}
                    alt="Upload preview"
                    onClick={(e) => { e.stopPropagation(); setShowLightbox(true) }}
                    className="mx-auto rounded-xl object-cover max-h-[150px] aspect-[4/5] hover:scale-[1.02] transition-transform duration-200 cursor-zoom-in"
                  />
                  <div className="absolute top-2 right-2 flex gap-1.5">
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); inputRef.current?.click() }}
                      className="w-7 h-7 rounded-md bg-white dark:bg-surface-raised shadow flex items-center justify-center text-ink-secondary hover:text-brand transition-colors border border-surface-border"
                    >
                      <Image className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); removePhoto(activePose) }}
                      className="w-7 h-7 rounded-md bg-white dark:bg-surface-raised shadow flex items-center justify-center text-ink-muted hover:text-red-500 transition-colors border border-surface-border"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <QualityBadge result={validation[activePose]} onViewDetails={() => setShowDetailsModal(true)} />
                  {validation[activePose] && validation[activePose].overall !== 'pass' && activePose === 'front' && (
                    <p className="text-[9px] text-red-500 mt-1 font-medium text-center">
                      Fix validation issues to proceed
                    </p>
                  )}
                  {validating && (
                    <div className="flex items-center justify-center gap-1 text-[10px] text-ink-muted mt-1.5">
                      <div className="w-3 h-3 rounded-full border-2 border-brand border-t-transparent animate-spin" />
                      Checking quality…
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-4">
                  <Upload className="w-5 h-5 text-brand mx-auto mb-2" />
                  <p className="text-ink font-medium text-xs">Drag & drop or click to browse</p>
                  <p className="text-[10px] text-ink-muted mt-0.5">JPG, PNG, WEBP</p>
                </div>
              )}
            </div>
          </div>

          <div className="lg:col-span-2 flex flex-col justify-center">
            {/* Guidelines (Compact) */}
            <div className="rounded-xl border border-surface-border bg-white dark:bg-surface-card p-4 shadow-soft">
              <h3 className="font-display font-semibold mb-2 text-[10px] uppercase tracking-wider text-ink-muted">
                Photo Guidelines
              </h3>
              <p className="text-[11px] text-ink-secondary leading-relaxed font-normal">
                Face clearly visible · Neutral expression · No glasses or hair covering forehead · Plain background.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Validation Details Modal */}
      {showDetailsModal && currentPhoto && validation[activePose] && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm cursor-pointer"
          onClick={() => setShowDetailsModal(false)}
        >
          <div 
            className="bg-white dark:bg-surface-card rounded-2xl max-w-md w-full border border-surface-border shadow-2xl p-6 relative animate-scale-in cursor-default"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setShowDetailsModal(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-surface-raised dark:hover:bg-surface text-ink-muted hover:text-ink transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            <h3 className="font-display font-semibold text-base text-ink mb-4 flex items-center gap-2">
              <CircleX className="w-5 h-5 text-red-500" />
              Validation Results
            </h3>

            <div className="space-y-2.5 max-h-[280px] overflow-y-auto pr-1 scrollbar-thin">
              {validation[activePose].checks.map((c, i) => (
                <div 
                  key={i} 
                  className={`p-3 rounded-xl border flex items-start gap-2.5 text-[11px] ${
                    c.pass 
                      ? 'bg-emerald-50/50 dark:bg-emerald-500/5 border-emerald-100 dark:border-emerald-500/10 text-emerald-800 dark:text-emerald-400' 
                      : c.severity === 'error'
                        ? 'bg-red-50/50 dark:bg-red-500/5 border-red-100 dark:border-red-500/10 text-red-800 dark:text-red-400'
                        : 'bg-amber-50/50 dark:bg-amber-500/5 border-amber-100 dark:border-amber-500/10 text-amber-800 dark:text-amber-400'
                  }`}
                >
                  <div className="mt-0.5 shrink-0">
                    {c.pass ? (
                      <BadgeCheck className="w-4 h-4 text-emerald-500" />
                    ) : c.severity === 'error' ? (
                      <CircleX className="w-4 h-4 text-red-500" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-amber-500" />
                    )}
                  </div>
                  <div>
                    <p className="font-semibold">{c.pass ? 'Passed' : c.severity === 'error' ? 'Critical Check Failed' : 'Check Warning'}</p>
                    <p className="mt-0.5 leading-relaxed">{c.message}</p>
                  </div>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setShowDetailsModal(false)}
              className="w-full mt-5 py-2.5 rounded-xl bg-brand text-white font-semibold hover:bg-brand-dark transition-colors text-xs"
            >
              Close Details
            </button>
          </div>
        </div>
      )}

      {/* Lightbox Modal */}
      {showLightbox && currentPhoto && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md cursor-pointer"
          onClick={() => setShowLightbox(false)}
        >
          <div className="relative max-w-3xl w-full max-h-[90vh] flex items-center justify-center">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setShowLightbox(false) }}
              className="absolute -top-12 right-0 p-2 rounded-xl bg-white/10 text-white hover:bg-white/20 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            <img
              src={currentPhoto}
              alt="Enlarged portrait view"
              className="max-w-full max-h-[80vh] rounded-2xl object-contain shadow-2xl animate-scale-in"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}
    </OnboardingLayout>
  )
}
