import { useEffect, useState } from 'react'
import { SCAN_MESSAGES, SCAN_STAGES } from '../utils/constants'
import { runFaceAnalysis } from '../utils/analyzeFace'
import { getActiveProvider } from '../utils/appMode'
import { ScanFace, Check } from 'lucide-react'

export default function Scanning({ photo, photos, answers, scanId, onComplete }) {
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
    let active = true
    let stageInterval = null

    const run = async () => {
      stageInterval = setInterval(() => {
        setStageIndex((i) => {
          if (i < SCAN_STAGES.length - 1) {
            setCompletedStages((prev) => [...prev, i])
            return i + 1
          }
          return i
        })
      }, 800)

      try {
        const result = await runFaceAnalysis(photo, answers, photos, scanId)
        if (!active) return

        clearInterval(stageInterval)
        stageInterval = null

        setCompletedStages(SCAN_STAGES.map((_, i) => i))
        setStageIndex(SCAN_STAGES.length - 1)

        await new Promise((r) => setTimeout(r, 400))
        if (active) onComplete(result)
      } catch (err) {
        if (!active) return
        clearInterval(stageInterval)
        onComplete({
          success: false,
          error: err?.message || 'Analysis failed. Please try again.',
          savedToDb: false,
        })
      }
    }

    run()

    const msgTimer = setInterval(() => {
      setMsgIndex((i) => (i + 1) % SCAN_MESSAGES.length)
    }, 1200)

    return () => {
      active = false
      if (stageInterval) clearInterval(stageInterval)
      clearInterval(msgTimer)
    }
  }, [photo, photos, answers, scanId, onComplete])

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
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-brand-50 border border-brand/20 mb-4">
            <ScanFace className="w-4 h-4 text-brand animate-pulse" />
            <span className="text-sm font-medium text-brand">{scanLabel}</span>
          </div>

          <p className="text-ink font-display text-lg font-semibold mb-2 min-h-[28px] transition-all">
            {SCAN_MESSAGES[msgIndex]}
          </p>

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
                <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                  completedStages.includes(i)
                    ? 'bg-brand text-white'
                    : i === stageIndex
                      ? 'bg-brand/20 text-brand animate-pulse'
                      : 'bg-surface-border text-ink-faint'
                }`}>
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
