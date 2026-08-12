'use client'

import { useEffect } from 'react'
import { X } from 'lucide-react'

export default function RetryPipelineModal({ open, busy, onClose, onConfirm, t }) {
  useEffect(() => {
    if (!open) return undefined
    const onKey = (event) => {
      if (event.key === 'Escape' && !busy) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, busy, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-ink/40 backdrop-blur-sm"
        onClick={busy ? undefined : onClose}
        aria-label={t('retryCancel')}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="retry-pipeline-title"
        className="relative w-full max-w-md rounded-2xl border border-surface-border bg-white dark:bg-surface-card shadow-elevated p-6"
      >
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h2 id="retry-pipeline-title" className="font-display text-lg font-semibold text-ink">
              {t('retryModalTitle')}
            </h2>
            <p className="text-sm text-ink-muted mt-2 leading-relaxed">{t('retryModalDescription')}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="p-1.5 rounded-lg text-ink-muted hover:text-ink hover:bg-surface-warm transition-colors disabled:opacity-50"
            aria-label={t('retryCancel')}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-3">
          <button
            type="button"
            disabled={busy}
            onClick={() => onConfirm('resume')}
            className="w-full text-left rounded-xl border border-brand/20 bg-brand-50 px-4 py-3 hover:bg-brand/10 transition-colors disabled:opacity-50"
          >
            <p className="text-sm font-semibold text-brand">{t('retryResumeTitle')}</p>
            <p className="text-xs text-ink-muted mt-1">{t('retryResumeHint')}</p>
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => onConfirm('full')}
            className="w-full text-left rounded-xl border border-red-200 bg-red-50 px-4 py-3 hover:bg-red-100/60 transition-colors disabled:opacity-50"
          >
            <p className="text-sm font-semibold text-red-700">{t('retryFullTitle')}</p>
            <p className="text-xs text-red-600/80 mt-1">{t('retryFullHint')}</p>
          </button>
        </div>

        <button
          type="button"
          onClick={onClose}
          disabled={busy}
          className="mt-4 w-full px-3 py-2 rounded-xl border border-surface-border text-xs font-medium text-ink-muted hover:text-ink disabled:opacity-50"
        >
          {t('retryCancel')}
        </button>
      </div>
    </div>
  )
}
