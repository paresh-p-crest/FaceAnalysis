'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { ImagePlus, Loader2, Save, Sparkles, X } from 'lucide-react'
import {
  generateAssessmentVisuals,
  generateProjectedAfter,
  updateAssessmentAdminReview,
} from '../utils/apiClient'
import { resolveProjectedAfterUrl } from '../utils/projectedAfter'
import { normalizeReportStatus } from '../utils/reportWorkflow'
import { translateApiError } from '../utils/translateApiError'
import ConfirmDialog from './ConfirmDialog'
// Temporary: hide pipeline status in generated-images overlay.
// import PipelineStatusPanel from './admin/PipelineStatusPanel'

const fieldClass =
  'w-full rounded-xl border border-surface-border bg-white dark:bg-surface-card px-3 py-2 text-sm text-ink outline-none focus:border-brand resize-y min-h-[5rem]'

function ImagePreviewModal({ src, title, onClose, closeLabel }) {
  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  if (!src) return null

  return (
    <div
      className="fixed inset-0 z-[240] flex items-center justify-center bg-black/70 p-4 sm:p-8"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute top-4 right-4 w-9 h-9 rounded-xl border border-white/20 bg-white/10 text-white hover:bg-white/20 inline-flex items-center justify-center z-10"
        aria-label={closeLabel}
      >
        <X className="w-4 h-4" />
      </button>
      <img
        src={src}
        alt={title}
        className="max-h-[85vh] max-w-full w-auto rounded-2xl shadow-elevated object-contain"
        onClick={(event) => event.stopPropagation()}
      />
    </div>
  )
}

/** Admin overlay for projected AFTER + AI visuals (narrative edits live in protocol preview). */
export default function AdminReviewPanel({
  assessment,
  view = 'images',
  onClose,
  onSaved,
}) {
  const t = useTranslations('Admin.reviewPanel')
  const tErrors = useTranslations('Errors')
  const [adminNotes, setAdminNotes] = useState(assessment?.adminNotes || '')
  const [projectedAfter, setProjectedAfter] = useState(assessment?.projectedAfter || null)
  const [aiVisuals, setAiVisuals] = useState(assessment?.aiVisuals || null)
  const [saving, setSaving] = useState(false)
  const [generatingAfter, setGeneratingAfter] = useState(false)
  const [generatingVisuals, setGeneratingVisuals] = useState(false)
  const [regeneratingStyleId, setRegeneratingStyleId] = useState(null)
  const [error, setError] = useState('')
  const [approveConfirmOpen, setApproveConfirmOpen] = useState(false)
  const [preview, setPreview] = useState(null)

  const status = normalizeReportStatus(assessment?.status)
  const isApproved = status === 'approved'
  const busy = saving || generatingAfter || generatingVisuals || !!regeneratingStyleId
  const afterUrl = resolveProjectedAfterUrl(projectedAfter)
  const visualVariants = Array.isArray(aiVisuals?.variants) ? aiVisuals.variants : []
  // Accept legacy view ids from older sessions.
  const isImages = view === 'images' || view === 'after' || view === 'visuals'

  useEffect(() => {
    if (!assessment) return
    setAdminNotes(assessment.adminNotes || '')
    setProjectedAfter(assessment.projectedAfter || null)
    setAiVisuals(assessment.aiVisuals || null)
    setError('')
    setPreview(null)
  }, [assessment?.id, view])

  if (!assessment || !isImages) return null

  const applyAssessmentUpdate = (updated) => {
    if (!updated) return
    if (updated.projectedAfter) setProjectedAfter(updated.projectedAfter)
    if (updated.aiVisuals) setAiVisuals(updated.aiVisuals)
    if (updated.adminNotes != null) setAdminNotes(updated.adminNotes)
    onSaved?.(updated)
  }

  const handleSave = async (nextStatus = 'pending_review') => {
    setSaving(true)
    setError('')
    try {
      const updated = await updateAssessmentAdminReview(assessment.id, {
        status: nextStatus,
        adminNotes,
      })
      applyAssessmentUpdate(updated)
    } catch (err) {
      setError(translateApiError(err, tErrors))
    } finally {
      setSaving(false)
    }
  }

  const handleGenerateAfter = async () => {
    setGeneratingAfter(true)
    setError('')
    try {
      applyAssessmentUpdate(await generateProjectedAfter(assessment.id, { force: true }))
    } catch (err) {
      setError(translateApiError(err, tErrors))
    } finally {
      setGeneratingAfter(false)
    }
  }

  const handleGenerateAllVisuals = async () => {
    setGeneratingVisuals(true)
    setError('')
    try {
      applyAssessmentUpdate(await generateAssessmentVisuals(assessment.id, { force: true }))
    } catch (err) {
      setError(translateApiError(err, tErrors))
    } finally {
      setGeneratingVisuals(false)
    }
  }

  const handleGenerateVisualStyle = async (styleId) => {
    if (!styleId) return
    setRegeneratingStyleId(styleId)
    setError('')
    try {
      applyAssessmentUpdate(
        await generateAssessmentVisuals(assessment.id, { force: true, styleId }),
      )
    } catch (err) {
      setError(translateApiError(err, tErrors))
    } finally {
      setRegeneratingStyleId(null)
    }
  }

  const openPreview = (src, title) => {
    if (!src) return
    setPreview({ src, title: title || t('afterPreviewAlt') })
  }

  return (
    <>
      <div
        className="fixed inset-0 z-[220] flex items-end sm:items-center justify-center bg-ink/40 p-0 sm:p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-review-title"
      >
        <button type="button" className="absolute inset-0 cursor-default" aria-label={t('closePanel')} onClick={onClose} />
        <section className="relative z-10 w-full sm:max-w-2xl h-[min(92dvh,44rem)] sm:h-[min(88vh,42rem)] bg-white dark:bg-surface-card rounded-t-2xl sm:rounded-2xl border border-brand/20 shadow-modal overflow-hidden flex flex-col min-h-0">
          <div className="px-4 sm:px-5 py-4 border-b border-surface-border flex items-start justify-between gap-3 shrink-0">
            <div className="flex items-start gap-3 min-w-0">
              <div className="w-9 h-9 shrink-0 rounded-xl bg-brand-50 flex items-center justify-center">
                <ImagePlus className="w-4 h-4 text-brand" />
              </div>
              <div className="min-w-0">
                <h3 id="admin-review-title" className="font-display text-base font-semibold text-ink tracking-tight">
                  {t('titleImages', { id: assessment.id.slice(-6) })}
                </h3>
                <p className="text-xs text-ink-muted mt-0.5">{t('subtitleImages')}</p>
              </div>
            </div>
            <button type="button" onClick={onClose} className="w-9 h-9 shrink-0 rounded-xl border border-surface-border text-ink-muted hover:text-ink hover:border-brand/30 inline-flex items-center justify-center transition-colors" aria-label={t('close')}>
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-5 space-y-4">
            {error && <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>}

            <div className="flex flex-wrap items-center gap-2">
              <span className={`inline-flex px-2 py-0.5 rounded-md border text-[10px] font-semibold ${isApproved ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                {isApproved ? t('statusApproved') : t('statusPendingReview')}
              </span>
            </div>

            {/* Temporary: hide pipeline status in generated-images overlay.
            <PipelineStatusPanel assessment={assessment} onUpdated={applyAssessmentUpdate} />
            */}

            <div className="space-y-3">
              <h4 className="text-xs font-semibold text-ink uppercase tracking-wider">{t('sectionAfter')}</h4>
              <button type="button" onClick={handleGenerateAfter} disabled={busy || isApproved} className="w-full inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border border-brand/20 bg-brand-50 text-xs font-semibold text-brand hover:bg-brand/10 transition-colors disabled:opacity-50">
                {generatingAfter ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ImagePlus className="w-3.5 h-3.5" />}
                {afterUrl ? t('regenerateAfter') : t('generateAfter')}
              </button>

              {afterUrl ? (
                <div className="rounded-xl border border-surface-border bg-surface-muted/40 p-3 space-y-3">
                  <button
                    type="button"
                    onClick={() => openPreview(afterUrl, t('sectionAfter'))}
                    className="block w-full rounded-lg border border-surface-border bg-white overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
                    aria-label={t('openPreview', { title: t('sectionAfter') })}
                    title={t('openPreviewHint')}
                  >
                    <img src={afterUrl} alt={t('afterPreviewAlt')} className="w-full max-h-[min(40vh,18rem)] object-contain" />
                  </button>
                  <div>
                    <p className="text-xs font-semibold text-ink">{t('afterReady')}</p>
                    <p className="text-[11px] text-ink-muted break-all mt-1">{afterUrl}</p>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-surface-border px-4 py-8 text-center text-xs text-ink-muted">{t('noAfterYet')}</div>
              )}
            </div>

            <div className="space-y-3 pt-2 border-t border-surface-border">
              <h4 className="text-xs font-semibold text-ink uppercase tracking-wider">{t('sectionVisuals')}</h4>
              <button
                type="button"
                onClick={handleGenerateAllVisuals}
                disabled={busy || isApproved}
                className="w-full inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border border-brand/20 bg-brand-50 text-xs font-semibold text-brand hover:bg-brand/10 transition-colors disabled:opacity-50"
              >
                {generatingVisuals ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                {visualVariants.length ? t('regenerateAllVisuals') : t('generateAllVisuals')}
              </button>

              {visualVariants.length ? (
                <div className="space-y-2">
                  {visualVariants.map((variant) => {
                    const styleId = variant.styleId
                    const thisBusy = regeneratingStyleId === styleId
                    const title = variant.title || styleId || t('sectionVisuals')
                    const typeLabel = t.has(`visualType.${variant.type}`)
                      ? t(`visualType.${variant.type}`)
                      : variant.type
                    return (
                      <div
                        key={styleId || `${variant.type}:${variant.title}`}
                        className="flex items-center gap-3 rounded-xl border border-surface-border bg-surface-muted/40 p-2.5"
                      >
                        {variant.imageSrc ? (
                          <button
                            type="button"
                            onClick={() => openPreview(variant.imageSrc, title)}
                            className="h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-surface-border bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
                            aria-label={t('openPreview', { title })}
                            title={t('openPreviewHint')}
                          >
                            <img src={variant.imageSrc} alt="" className="h-full w-full object-cover" />
                          </button>
                        ) : (
                          <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-surface-border bg-white flex items-center justify-center text-[10px] text-ink-muted">
                            —
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold text-ink truncate">{title}</p>
                          <p className="text-[11px] text-ink-muted">{typeLabel}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleGenerateVisualStyle(styleId)}
                          disabled={busy || isApproved || !styleId}
                          className="shrink-0 inline-flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-xl border border-brand/20 bg-white text-[11px] font-semibold text-brand hover:bg-brand-50 transition-colors disabled:opacity-50"
                        >
                          {thisBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                          {t('regenerateVisual')}
                        </button>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-surface-border px-4 py-8 text-center text-xs text-ink-muted">
                  {t('noVisualsYet')}
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-ink-secondary mb-2">{t('adminNotes')}</label>
              <textarea value={adminNotes} onChange={(e) => setAdminNotes(e.target.value)} rows={3} disabled={isApproved} className={fieldClass} placeholder={t('adminNotesPlaceholder')} />
            </div>
          </div>

          <div className="shrink-0 border-t border-surface-border bg-white dark:bg-surface-card px-4 sm:px-5 py-3 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
            <button type="button" onClick={() => setApproveConfirmOpen(true)} disabled={busy || isApproved} className="w-full sm:w-auto px-3 py-2.5 rounded-xl border border-emerald-200 bg-emerald-50 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 transition-colors disabled:opacity-50">
              {t('approveRelease')}
            </button>
            <button type="button" onClick={() => handleSave('pending_review')} disabled={busy || isApproved} className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-brand text-white text-xs font-semibold hover:bg-brand-dark transition-colors disabled:opacity-50 shadow-brand">
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              {t('saveEdits')}
            </button>
          </div>
        </section>
      </div>

      <ImagePreviewModal
        src={preview?.src}
        title={preview?.title}
        onClose={() => setPreview(null)}
        closeLabel={t('closePreview')}
      />

      <ConfirmDialog
        open={approveConfirmOpen}
        title={t('approveConfirmTitle')}
        message={t('approveConfirmMessage')}
        confirmLabel={t('approveConfirmLabel')}
        onConfirm={async () => {
          setApproveConfirmOpen(false)
          await handleSave('approved')
          onClose?.()
        }}
        onCancel={() => setApproveConfirmOpen(false)}
      />
    </>
  )
}
