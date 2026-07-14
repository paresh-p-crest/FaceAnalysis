import { useEffect, useRef, useState } from 'react'
import { SCAN_NL_STAGE_INDEX, SCAN_STAGES } from '../utils/constants'
import { runFaceAnalysis } from '../utils/analyzeFace'
import { Check } from 'lucide-react'

/** Faster cadence for CV-ish stages; slower once NL enrichment begins. */
const CV_STAGE_MS = 1400
const NL_STAGE_MS = 10000

export default function Scanning({ photo, photos, answers, scanId, onComplete }) {
  const [stageIndex, setStageIndex] = useState(0)
  const [completedStages, setCompletedStages] = useState([])
  const stageIndexRef = useRef(0)

  useEffect(() => {
    stageIndexRef.current = stageIndex
  }, [stageIndex])

  useEffect(() => {
    let active = true
    let stageTimer = null

    const scheduleNextStage = () => {
      const i = stageIndexRef.current
      // Hold on the last stage until the request finishes — do not auto-complete it.
      if (i >= SCAN_STAGES.length - 1) return
      const delay = i >= SCAN_NL_STAGE_INDEX - 1 ? NL_STAGE_MS : CV_STAGE_MS
      stageTimer = setTimeout(() => {
        if (!active) return
        setStageIndex((prev) => {
          if (prev >= SCAN_STAGES.length - 1) return prev
          setCompletedStages((done) => (done.includes(prev) ? done : [...done, prev]))
          const next = prev + 1
          stageIndexRef.current = next
          scheduleNextStage()
          return next
        })
      }, delay)
    }

    const run = async () => {
      scheduleNextStage()

      try {
        const result = await runFaceAnalysis(photo, answers, photos, scanId)
        if (!active) return

        if (stageTimer) {
          clearTimeout(stageTimer)
          stageTimer = null
        }

        setCompletedStages(SCAN_STAGES.map((_, i) => i))
        setStageIndex(SCAN_STAGES.length - 1)

        await new Promise((r) => setTimeout(r, 400))
        if (active) onComplete(result)
      } catch (err) {
        if (!active) return
        if (stageTimer) clearTimeout(stageTimer)
        onComplete({
          success: false,
          error: err?.message || 'Analysis failed. Please try again.',
          savedToDb: false,
        })
      }
    }

    run()

    return () => {
      active = false
      if (stageTimer) clearTimeout(stageTimer)
    }
  }, [photo, photos, answers, scanId, onComplete])

  const inNlBand = stageIndex >= SCAN_NL_STAGE_INDEX

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 animate-fade-up bg-surface">
      <div className="relative w-full max-w-sm">
        <div className="rounded-3xl p-3 overflow-hidden bg-white dark:bg-surface-card shadow-elevated border border-surface-border">
          <div className="relative rounded-2xl overflow-hidden aspect-[4/5]">
            <img src={photo} alt="Scanning" className="w-full h-full object-cover" />

            <div
              className="absolute inset-0 opacity-10"
              style={{
                backgroundImage:
                  'linear-gradient(rgba(15,118,110,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(15,118,110,0.3) 1px, transparent 1px)',
                backgroundSize: '24px 24px',
              }}
            />

            <div className="absolute inset-x-0 h-0.5 bg-brand/60 animate-scan-line shadow-[0_0_12px_rgba(15,118,110,0.5)]" />
          </div>
        </div>

        <div className="mt-8 text-center">
          <p className="text-ink font-display text-lg font-semibold mb-2">
            {SCAN_STAGES[stageIndex]}
          </p>
          {inNlBand ? (
            <p className="text-ink-muted text-xs mb-2 px-2">
              Personalized copy can take a few minutes…
            </p>
          ) : null}

          <div className="space-y-2 mt-6">
            {SCAN_STAGES.map((stage, i) => (
              <div
                key={stage}
                className={`flex items-center gap-3 px-4 py-2 rounded-xl text-sm transition-all ${
                  completedStages.includes(i)
                    ? 'text-brand bg-brand-50/50'
                    : i === stageIndex
                      ? 'text-ink bg-surface-warm'
                      : 'text-ink-faint'
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                    completedStages.includes(i)
                      ? 'bg-brand text-white'
                      : i === stageIndex
                        ? 'bg-brand/20 text-brand animate-pulse'
                        : 'bg-surface-border text-ink-faint'
                  }`}
                >
                  {completedStages.includes(i) ? <Check className="w-3 h-3" /> : i + 1}
                </div>
                {stage}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
