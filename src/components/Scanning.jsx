import { useEffect, useState } from 'react'
import { SCAN_MESSAGES } from '../utils/constants'
import { runFaceAnalysis } from '../utils/analyzeFace'
import { isDemoMode, getActiveLLM } from '../utils/appMode'

export default function Scanning({ photo, answers, onComplete }) {
  const [msgIndex, setMsgIndex] = useState(0)

  const scanLabel = isDemoMode()
    ? 'Demo mode — simulated scan'
    : getActiveLLM() === 'aws'
      ? 'AWS Rekognition · analyzing'
      : 'MediaPipe + OpenCV · analyzing'

  useEffect(() => {
    let cancelled = false
    let result = null

    const run = async () => {
      result = await runFaceAnalysis(photo, answers)
      if (cancelled) return
      const minDelay = 3500
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
  }, [photo, answers, onComplete])

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 animate-fade-up">
      <div className="relative w-full max-w-sm">
        <div className="glass rounded-3xl p-3 overflow-hidden">
          <div className="relative rounded-2xl overflow-hidden aspect-[4/5]">
            <img src={photo} alt="Scanning" className="w-full h-full object-cover" />

            <div
              className="absolute inset-0 opacity-20"
              style={{
                backgroundImage:
                  'linear-gradient(rgba(110,231,200,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(110,231,200,0.3) 1px, transparent 1px)',
                backgroundSize: '24px 24px',
              }}
            />

            {['top-3 left-3 border-t-2 border-l-2', 'top-3 right-3 border-t-2 border-r-2', 'bottom-3 left-3 border-b-2 border-l-2', 'bottom-3 right-3 border-b-2 border-r-2'].map((cls) => (
              <div key={cls} className={`absolute w-8 h-8 border-accent ${cls} rounded-sm`} />
            ))}

            <div className="absolute left-0 right-0 h-0.5 animate-laser-sweep pointer-events-none">
              <div className="h-full bg-gradient-to-r from-transparent via-accent to-transparent shadow-[0_0_20px_4px_rgba(110,231,200,0.6)]" />
            </div>

            <div className="absolute inset-0 bg-gradient-to-b from-accent/5 via-transparent to-violet-glow/5 animate-pulse-glow" />
          </div>
        </div>

        <div className="absolute -inset-4 rounded-[2rem] border border-accent/20 animate-pulse-glow pointer-events-none" />
      </div>

      <div className="mt-10 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass text-accent text-sm font-medium mb-4">
          <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
          {scanLabel}
        </div>
        <p className="text-slate-400 text-sm h-5 transition-opacity duration-300">
          {SCAN_MESSAGES[msgIndex]}
        </p>
      </div>

      <div className="w-64 h-1 rounded-full bg-white/5 mt-8 overflow-hidden">
        <div className="h-full bg-gradient-to-r from-accent to-violet-glow rounded-full" style={{ width: '100%' }} />
      </div>
    </div>
  )
}
