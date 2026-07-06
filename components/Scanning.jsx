import { useEffect, useState } from 'react'
import { SCAN_MESSAGES, SCAN_STAGES } from '../utils/constants'
import { runFaceAnalysis } from '../utils/analyzeFace'
import { getActiveProvider } from '../utils/appMode'
import { ScanFace, Check } from 'lucide-react'

export default function Scanning({ photo, photos, answers, onComplete }) {
  const [msgIndex, setMsgIndex] = useState(0)
  const [stageIndex, setStageIndex] = useState(0)
  const [completedStages, setCompletedStages] = useState([])

  const provider = getActiveProvider()
  const scanLabel = provider === 'local'
    ? 'MediaPipe + OpenCV'
    : provider === 'aws'
      ? 'AWS Rekognition'
      : 'MediaPipe + OpenCV'

  useEffect(() => {
    let cancelled = false
    let stageTimer = null

    const run = async () => {
      // Simulate progressive stage completion
      const stageInterval = setInterval(() => {
        setStageIndex((i) => {
          if (i < SCAN_STAGES.length - 1) {
            setCompletedStages((prev) => [...prev, i])
            return i + 1
          }
          return i
        })
      }, 800)

      const result = await runFaceAnalysis(photo, answers, photos)

      clearInterval(stageInterval)
      if (cancelled) return

      // Complete all remaining stages
      setCompletedStages(SCAN_STAGES.map((_, i) => i))
      setStageIndex(SCAN_STAGES.length - 1)

      const minDelay = 4000
      const start = Date.now()
      const elapsed = Date.now() - start
      if (elapsed < minDelay) {
        await new Promise((r) => setTimeout(r, minDelay - elapsed))
      }
      if (!cancelled) onComplete(result)
    }

    run()

    const msgTimer = setInterval(() => {
      setMsgIndex((i) => (i + 1) % SCAN_MESSAGES.length)
    }, 1200)

    return () => {
      cancelled = true
      clearInterval(msgTimer)
    }
  }, [photo, photos, answers, onComplete])

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 animate-fade-up bg-surface">
      <div className="relative w-full max-w-sm">
        {/* Photo with scan overlay */}
        <div className="rounded-3xl p-3 overflow-hidden bg-white dark:bg-surface-card shadow-elevated border border-surface-border">
          <div className="relative rounded-2xl overflow-hidden aspect-[4/5]">
            <img src={photo} alt="Scanning" className="w-full h-full object-cover" />

            {/* Grid overlay */}
            <div
              className="absolute inset-0 opacity-10"
              style={{
                backgroundImage:
                  'linear-gradient(rgba(15,118,110,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(15,118,110,0.3) 1px, transparent 1px)',
                backgroundSize: '24px 24px',
              }}
            />

            {/* Corner brackets */}
            {['top-3 left-3 border-t-2 border-l-2', 'top-3 right-3 border-t-2 border-r-2', 'bottom-3 left-3 border-b-2 border-l-2', 'bottom-3 right-3 border-b-2 border-r-2'].map((cls, idx) => (
              <div key={idx} className={'absolute w-8 h-8 border-brand ' + cls + ' rounded-sm'} />
            ))}

            {/* Scan line */}
            <div className="absolute left-0 right-0 h-0.5 animate-laser-sweep pointer-events-none">
              <div className="h-full bg-gradient-to-r from-transparent via-brand to-transparent shadow-[0_0_20px_4px_rgba(15,118,110,0.4)]" />
            </div>

            {/* Subtle overlay */}
            <div className="absolute inset-0 bg-gradient-to-b from-brand/5 via-transparent to-brand/5 animate-pulse-glow" />
          </div>
        </div>

        {/* Outer pulse ring */}
        <div className="absolute -inset-4 rounded-[2rem] border border-brand/15 animate-pulse-glow pointer-events-none" />
      </div>

      {/* Status badge */}
      <div className="mt-8 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white dark:bg-surface-card border border-surface-border text-brand text-sm font-medium mb-4 shadow-soft">
          <span className="w-2 h-2 rounded-full bg-brand animate-pulse" />
          {scanLabel}
        </div>
        <p className="text-ink-muted text-sm h-5 transition-opacity duration-300">
          {SCAN_MESSAGES[msgIndex]}
        </p>
      </div>

      {/* Stage progress — compact grid that fits all viewports */}
      <div className="mt-6 w-full max-w-md">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1.5">
          {SCAN_STAGES.map((stage, i) => {
            const done = completedStages.includes(i)
            const active = i === stageIndex && !done
            return (
              <div key={stage} className="flex items-center gap-2">
                <div className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 transition-all duration-300 ${
                  done
                    ? 'bg-brand text-white'
                    : active
                      ? 'bg-brand/20 border border-brand'
                      : 'bg-surface-warm border border-surface-border'
                }`}>
                  {done ? (
                    <Check className="w-2.5 h-2.5" />
                  ) : active ? (
                    <div className="w-1.5 h-1.5 rounded-full bg-brand animate-pulse" />
                  ) : null}
                </div>
                <span className={`text-[11px] leading-tight transition-colors duration-300 truncate ${
                  done ? 'text-brand font-medium' : active ? 'text-ink' : 'text-ink-faint'
                }`}>
                  {stage}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
