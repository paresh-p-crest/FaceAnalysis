import { useRef, useState } from 'react'
import { Upload, ImageIcon, Scan, CheckCircle2 } from 'lucide-react'
import { DEMO_PHOTO_URL, PHOTO_POSES } from '../utils/constants'
import { isDemoMode } from '../utils/appMode'
import { OnboardingLayout } from './OnboardingLayout'

const GUIDELINES = [
  'Remove glasses and accessories',
  'Use a plain, well-lit background',
  'Tie back long hair from the face',
  'Face the camera directly (front pose)',
  'Neutral expression, eyes open',
  'No filters or heavy makeup',
]

export default function PhotoUpload({ photos, setPhotos, onStartAnalysis, onBack }) {
  const inputRef = useRef(null)
  const [dragOver, setDragOver] = useState(false)
  const [activePose, setActivePose] = useState('front')
  const demo = isDemoMode()

  const poses = demo ? PHOTO_POSES : PHOTO_POSES.filter((p) => p.id === 'front')
  const canAnalyze = !!photos.front

  const handleFile = (file, poseId = activePose) => {
    if (!file?.type.startsWith('image/')) return
    const reader = new FileReader()
    reader.onload = (e) => {
      setPhotos((prev) => ({ ...prev, [poseId]: e.target.result }))
    }
    reader.readAsDataURL(file)
  }

  const useDemo = async (poseId = 'front') => {
    const url =
      poseId === 'profile'
        ? 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=600&h=750&fit=crop&crop=face'
        : DEMO_PHOTO_URL
    try {
      const res = await fetch(url)
      const blob = await res.blob()
      const reader = new FileReader()
      reader.onload = (e) => setPhotos((prev) => ({ ...prev, [poseId]: e.target.result }))
      reader.readAsDataURL(blob)
    } catch {
      setPhotos((prev) => ({ ...prev, [poseId]: url }))
    }
  }

  const currentPhoto = photos[activePose]

  return (
    <OnboardingLayout
      stepIndex={5}
      sidebarTitle="Upload your photo"
      sidebarDesc="A clear front-facing portrait gives us the best data for landmark mapping and skin analysis."
      onBack={onBack}
      selectionLabel={canAnalyze ? 'Photo ready' : 'Front photo required'}
      onContinue={onStartAnalysis}
      continueLabel="Start Analysis"
      continueDisabled={!canAnalyze}
    >
      <div className="max-w-3xl pt-2">
        <h2 className="font-display text-xl sm:text-2xl font-semibold text-white mb-1">Upload your front-facing photo</h2>
        <p className="text-sm text-slate-500 mb-6">
          {demo ? 'Front face required · Side profile optional' : 'Front-facing portrait required for analysis'}
        </p>

        {demo && (
          <div className="flex gap-2 mb-6">
            {poses.map((pose) => (
              <button
                key={pose.id}
                onClick={() => setActivePose(pose.id)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                  activePose === pose.id
                    ? 'chip-option-selected'
                    : 'chip-option'
                }`}
              >
                {pose.label}
                {pose.required ? ' *' : ''}
                {photos[pose.id] && <span className="ml-1">✓</span>}
              </button>
            ))}
          </div>
        )}

        <div className="grid lg:grid-cols-5 gap-6">
          <div className="lg:col-span-3">
            <p className="text-xs text-slate-500 mb-3">{poses.find((p) => p.id === activePose)?.hint}</p>
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault()
                setDragOver(false)
                handleFile(e.dataTransfer.files[0], activePose)
              }}
              onClick={() => inputRef.current?.click()}
              className={`glass rounded-2xl p-8 cursor-pointer transition-all duration-300 min-h-[280px] flex flex-col items-center justify-center ${
                dragOver ? 'border-accent/50 bg-accent/5' : ''
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
                  <div className="absolute inset-0 rounded-2xl ring-1 ring-accent/20" />
                </div>
              ) : (
                <>
                  <div className="w-14 h-14 rounded-2xl bg-accent/10 flex items-center justify-center mb-4">
                    <Upload className="w-6 h-6 text-accent" />
                  </div>
                  <p className="text-white font-medium mb-1 text-sm">Drag & drop your photo here</p>
                  <p className="text-slate-500 text-xs">or click to browse · JPG, PNG, WEBP</p>
                </>
              )}
            </div>

            <button type="button" onClick={() => useDemo(activePose)} className="btn-ghost w-full mt-3 text-sm">
              <ImageIcon className="w-4 h-4" />
              Use Demo Photo
            </button>
          </div>

          <div className="lg:col-span-2 glass rounded-2xl p-5">
            <h3 className="font-display font-semibold mb-4 text-xs uppercase tracking-wider text-slate-400">
              Photo Guidelines
            </h3>
            <ul className="space-y-2.5">
              {GUIDELINES.map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-xs">
                  <CheckCircle2 className="w-3.5 h-3.5 text-accent shrink-0 mt-0.5" />
                  <span className="text-slate-300">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </OnboardingLayout>
  )
}
