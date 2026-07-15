import { useEffect, useRef, useState } from 'react'
import { runFaceAnalysis } from '../utils/analyzeFace'
import { Loader2 } from 'lucide-react'

/** Fast submit — uploads photos and enqueues the async pipeline. */
export default function Scanning({ photo, photos, answers, scanId, onComplete }) {
  const [message, setMessage] = useState('Uploading your photos…')
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return undefined
    started.current = true
    let active = true

    const run = async () => {
      try {
        setMessage('Validating and saving your photos…')
        const result = await runFaceAnalysis(photo, answers, photos, scanId)
        if (!active) return
        onComplete(result)
      } catch (err) {
        if (!active) return
        onComplete({
          success: false,
          error: err?.message || 'Upload failed. Please try again.',
          savedToDb: false,
        })
      }
    }

    run()
    return () => {
      active = false
    }
  }, [photo, photos, answers, scanId, onComplete])

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 animate-fade-up bg-surface">
      <div className="text-center max-w-sm">
        <Loader2 className="w-10 h-10 text-brand animate-spin mx-auto mb-4" />
        <p className="font-display text-lg font-semibold text-ink mb-2">{message}</p>
        <p className="text-sm text-ink-muted">This usually takes a few seconds.</p>
      </div>
    </div>
  )
}
