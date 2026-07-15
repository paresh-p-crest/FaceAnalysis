'use client'

import { useEffect, useState, useCallback } from 'react'
import { Loader2, Check, AlertCircle, LayoutDashboard } from 'lucide-react'
import { fetchAssessment } from '../../utils/apiClient'
import {
  PIPELINE_UI_STAGES,
  isPipelineFailed,
  isPipelineProcessing,
  isPipelineReady,
  stageStatusForUi,
} from '../../utils/pipelineStatus'

const POLL_MS = 5000

function StageRow({ label, status }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-surface-border last:border-0">
      <span className="text-sm text-ink-secondary">{label}</span>
      <div className="flex items-center gap-2">
        {status === 'done' && (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-brand">
            <Check className="w-3.5 h-3.5" />
            Done
          </span>
        )}
        {status === 'active' && (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-brand">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            In progress
          </span>
        )}
        {status === 'failed' && (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-red-600">
            <AlertCircle className="w-3.5 h-3.5" />
            Failed
          </span>
        )}
        {status === 'pending' && (
          <span className="text-xs text-ink-muted">Pending</span>
        )}
      </div>
    </div>
  )
}

export default function AnalysisPreparing({
  assessmentId,
  photo,
  onGoToDashboard,
  onReady,
}) {
  const [pipeline, setPipeline] = useState(null)
  const [workflowStatus, setWorkflowStatus] = useState('draft')
  const [error, setError] = useState('')
  const [pollError, setPollError] = useState('')

  const refresh = useCallback(async () => {
    if (!assessmentId) return
    try {
      const doc = await fetchAssessment(assessmentId)
      setPipeline(doc.pipeline || null)
      setWorkflowStatus(doc.status || 'draft')
      setPollError('')
      if (isPipelineReady(doc.pipeline)) {
        onReady?.(doc)
      }
      if (isPipelineFailed(doc.pipeline)) {
        setError(doc.pipeline?.lastError || 'Analysis failed. Please try again from your dashboard.')
      }
    } catch (err) {
      setPollError(err?.message || 'Could not refresh status')
    }
  }, [assessmentId, onReady])

  useEffect(() => {
    refresh()
    if (!assessmentId) return undefined
    const id = setInterval(() => {
      if (!isPipelineProcessing(pipeline) && !isPipelineReady(pipeline) && !isPipelineFailed(pipeline)) {
        refresh()
        return
      }
      if (isPipelineProcessing(pipeline) || (!pipeline && assessmentId)) {
        refresh()
      }
    }, POLL_MS)
    return () => clearInterval(id)
  }, [assessmentId, pipeline, refresh])

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-surface">
      <div className="w-full max-w-lg rounded-3xl border border-surface-border bg-white dark:bg-surface-card shadow-elevated p-8 md:p-10">
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-14 h-14 rounded-full border-2 border-brand/30 flex items-center justify-center mb-5">
            <Loader2 className="w-7 h-7 text-brand animate-spin" />
          </div>
          <h1 className="font-display text-2xl font-bold text-ink mb-2">
            Your analysis is being prepared
          </h1>
          <p className="text-sm text-ink-muted leading-relaxed max-w-md">
            We&apos;ll notify you when it&apos;s ready — you may close this tab safely.
          </p>
        </div>

        {photo && (
          <div className="rounded-2xl overflow-hidden mb-6 aspect-[4/5] max-h-40 mx-auto w-32 border border-surface-border">
            <img src={photo} alt="" className="w-full h-full object-cover" />
          </div>
        )}

        <div className="rounded-2xl border border-surface-border bg-surface-warm dark:bg-surface-raised px-4 py-1 mb-6">
          {PIPELINE_UI_STAGES.map((stage) => (
            <StageRow
              key={stage.id}
              label={stage.label}
              status={stageStatusForUi(pipeline, stage.id, workflowStatus)}
            />
          ))}
        </div>

        {error && (
          <p className="text-sm text-red-600 text-center mb-4">{error}</p>
        )}
        {pollError && !error && (
          <p className="text-sm text-amber-700 text-center mb-4">{pollError}</p>
        )}

        <button
          type="button"
          onClick={onGoToDashboard}
          className="btn-primary w-full flex items-center justify-center gap-2"
        >
          <LayoutDashboard className="w-4 h-4" />
          Go to Dashboard
        </button>
      </div>
    </div>
  )
}
