'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Check, Loader2, AlertCircle, RotateCcw, Clock } from 'lucide-react'
import {
  PIPELINE_UI_STAGES,
  isPipelineFailed,
  pipelineProgressPercent,
  stageStatusForUi,
} from '../../utils/pipelineStatus'
import { retryAssessmentPipeline } from '../../utils/apiClient'
import { translateApiError } from '../../utils/translateApiError'

function StageRow({ label, status, t }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-surface-border last:border-0">
      <span className="text-xs text-ink-secondary">{label}</span>
      {status === 'done' && (
        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600">
          <Check className="w-3.5 h-3.5" /> {t('stageDone')}
        </span>
      )}
      {status === 'active' && (
        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-brand">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> {t('stageInProgress')}
        </span>
      )}
      {status === 'failed' && (
        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-red-600">
          <AlertCircle className="w-3.5 h-3.5" /> {t('stageFailed')}
        </span>
      )}
      {status === 'pending' && (
        <span className="inline-flex items-center gap-1 text-[11px] text-ink-muted">
          <Clock className="w-3.5 h-3.5" /> {t('stagePending')}
        </span>
      )}
    </div>
  )
}

/**
 * Admin-only live pipeline status. Users never see this — it surfaces the real
 * cv → parsing → narratives → review progress plus a retry for failed runs.
 */
export default function PipelineStatusPanel({ assessment, onUpdated }) {
  const t = useTranslations('Admin.pipeline')
  const tErrors = useTranslations('Errors')
  const [retrying, setRetrying] = useState(false)
  const [error, setError] = useState('')

  const pipeline = assessment?.pipeline || null
  const workflowStatus = assessment?.status

  if (!pipeline) {
    return (
      <div className="rounded-xl border border-surface-border bg-surface-warm/50 dark:bg-surface-raised/20 px-3 py-2.5 text-[11px] text-ink-muted">
        {t('notStarted')}
      </div>
    )
  }

  const percent = pipelineProgressPercent(pipeline, workflowStatus)
  const failed = isPipelineFailed(pipeline)

  const handleRetry = async () => {
    setRetrying(true)
    setError('')
    try {
      const updated = await retryAssessmentPipeline(assessment.id)
      onUpdated?.(updated)
    } catch (err) {
      setError(translateApiError(err, tErrors))
    } finally {
      setRetrying(false)
    }
  }

  const stageLabels = {
    cv: t('stages.cv'),
    parsing: t('stages.parsing'),
    narratives: t('stages.narratives'),
    pending_review: t('stages.pendingReview'),
    approved: t('stages.approved'),
  }

  return (
    <div className="rounded-xl border border-surface-border bg-white dark:bg-surface-card p-3 sm:p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h4 className="text-xs font-semibold text-ink">{t('title')}</h4>
          <p className="text-[11px] text-ink-muted mt-0.5">
            {failed ? t('failedHint') : t('percentComplete', { percent })}
          </p>
        </div>
        <span
          className={`inline-flex px-2 py-0.5 rounded-md border text-[10px] font-semibold capitalize ${
            failed
              ? 'bg-red-50 text-red-700 border-red-200'
              : pipeline.status === 'ready'
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-sky-50 text-sky-700 border-sky-200'
          }`}
        >
          {pipeline.status || 'queued'}
        </span>
      </div>

      <div className="h-1.5 w-full rounded-full bg-surface-raised overflow-hidden">
        <div
          className={`h-full rounded-full transition-[width] duration-500 ${failed ? 'bg-red-400' : 'bg-brand'}`}
          style={{ width: `${percent}%` }}
        />
      </div>

      <div className="rounded-lg bg-surface-warm/50 dark:bg-surface-raised/20 px-3">
        {PIPELINE_UI_STAGES.map((stage) => (
          <StageRow
            key={stage.id}
            label={stageLabels[stage.id] || stage.label}
            status={stageStatusForUi(pipeline, stage.id, workflowStatus)}
            t={t}
          />
        ))}
      </div>

      {pipeline.lastError && (
        <p className="text-[11px] text-red-600 break-words">{pipeline.lastError}</p>
      )}
      {error && <p className="text-[11px] text-red-600">{error}</p>}

      {failed && (
        <button
          type="button"
          onClick={handleRetry}
          disabled={retrying}
          className="w-full inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border border-brand/20 bg-brand-50 text-xs font-semibold text-brand hover:bg-brand/10 transition-colors disabled:opacity-50"
        >
          {retrying ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
          {t('retry')}
        </button>
      )}
    </div>
  )
}
