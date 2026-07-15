import { useEffect, useMemo, useState } from 'react'
import { ImagePlus, Loader2, Save, ShieldCheck, Sparkles, X } from 'lucide-react'
import {
  generateAssessmentProtocol,
  generateAssessmentProtocolSection,
  generateProjectedAfter,
  updateAssessmentAdminReview,
} from '../utils/apiClient'
import { resolveProjectedAfterUrl } from '../utils/projectedAfter'
import {
  PROTOCOL_SECTION_OPTIONS,
  cloneProtocolDraft,
  ensureFeatureDraft,
} from '../utils/protocolSections'
import { normalizeReportStatus } from '../utils/reportWorkflow'
import ConfirmDialog from './ConfirmDialog'

const fieldClass =
  'w-full rounded-xl border border-surface-border bg-white dark:bg-surface-card px-3 py-2 text-sm text-ink outline-none focus:border-brand resize-y min-h-[5rem]'

/**
 * Admin-only review overlay. Opened from Report header toggles.
 * @param {'narrative' | 'after'} view
 */
export default function AdminReviewPanel({
  assessment,
  view = 'narrative',
  onClose,
  onSaved,
}) {
  const [adminNotes, setAdminNotes] = useState(assessment?.adminNotes || '')
  const [sectionId, setSectionId] = useState('overview')
  const [protocolNarrative, setProtocolNarrative] = useState(
    () => cloneProtocolDraft(assessment).protocolNarrative
  )
  const [featureNarratives, setFeatureNarratives] = useState(
    () => cloneProtocolDraft(assessment).featureNarratives
  )
  const [projectedAfter, setProjectedAfter] = useState(assessment?.projectedAfter || null)
  const [saving, setSaving] = useState(false)
  const [generatingWhole, setGeneratingWhole] = useState(false)
  const [generatingSection, setGeneratingSection] = useState(false)
  const [generatingAfter, setGeneratingAfter] = useState(false)
  const [error, setError] = useState('')
  const [approveConfirmOpen, setApproveConfirmOpen] = useState(false)

  const status = normalizeReportStatus(assessment?.status)
  const isApproved = status === 'approved'
  const busy = saving || generatingWhole || generatingSection || generatingAfter
  const afterUrl = resolveProjectedAfterUrl(projectedAfter)
  const isNarrative = view === 'narrative'
  const isAfter = view === 'after'

  useEffect(() => {
    if (!assessment) return
    const draft = cloneProtocolDraft(assessment)
    setAdminNotes(assessment.adminNotes || '')
    setProtocolNarrative(draft.protocolNarrative)
    setFeatureNarratives(draft.featureNarratives)
    setProjectedAfter(assessment.projectedAfter || null)
    setError('')
  }, [assessment?.id, view])

  const featureDraft = useMemo(() => {
    if (!isNarrative || sectionId === 'overview' || sectionId === 'closing') return null
    return ensureFeatureDraft(featureNarratives, sectionId)
  }, [featureNarratives, sectionId, isNarrative])

  if (!assessment) return null

  const applyAssessmentUpdate = (updated) => {
    if (!updated) return
    const draft = cloneProtocolDraft(updated)
    setProtocolNarrative(draft.protocolNarrative)
    setFeatureNarratives(draft.featureNarratives)
    if (updated.projectedAfter) setProjectedAfter(updated.projectedAfter)
    if (updated.adminNotes != null) setAdminNotes(updated.adminNotes)
    onSaved?.(updated)
  }

  const handleSave = async (nextStatus = 'pending_review') => {
    setSaving(true)
    setError('')
    try {
      const payload = {
        status: nextStatus,
        adminNotes,
      }
      if (isNarrative) {
        payload.protocolNarrative = protocolNarrative
        payload.featureNarratives = featureNarratives
      }
      const updated = await updateAssessmentAdminReview(assessment.id, payload)
      applyAssessmentUpdate(updated)
    } catch (err) {
      setError(err.message || 'Could not save review')
    } finally {
      setSaving(false)
    }
  }

  const handleGenerateWhole = async () => {
    setGeneratingWhole(true)
    setError('')
    try {
      const updated = await generateAssessmentProtocol(assessment.id, { force: true })
      applyAssessmentUpdate(updated)
    } catch (err) {
      setError(err.message || 'Could not generate whole PDF narrative')
    } finally {
      setGeneratingWhole(false)
    }
  }

  const handleGenerateSection = async () => {
    setGeneratingSection(true)
    setError('')
    try {
      const updated = await generateAssessmentProtocolSection(assessment.id, sectionId)
      applyAssessmentUpdate(updated)
    } catch (err) {
      setError(err.message || 'Could not generate section')
    } finally {
      setGeneratingSection(false)
    }
  }

  const handleGenerateAfter = async () => {
    setGeneratingAfter(true)
    setError('')
    try {
      const updated = await generateProjectedAfter(assessment.id)
      applyAssessmentUpdate(updated)
    } catch (err) {
      setError(err.message || 'Could not generate after image')
    } finally {
      setGeneratingAfter(false)
    }
  }

  const updateOverviewSummary = (value) => {
    setProtocolNarrative((prev) => ({ ...prev, summary: value }))
  }

  const updateClosingText = (value) => {
    const paragraphs = value
      .split(/\n\s*\n/)
      .map((p) => p.trim())
      .filter(Boolean)
    setProtocolNarrative((prev) => ({ ...prev, closing: paragraphs }))
  }

  const updateFeatureSummary = (value) => {
    setFeatureNarratives((prev) => {
      const current = ensureFeatureDraft(prev, sectionId)
      return { ...prev, [sectionId]: { ...current, summary: value } }
    })
  }

  const updateFeatureSubsection = (title, body) => {
    setFeatureNarratives((prev) => {
      const current = ensureFeatureDraft(prev, sectionId)
      return {
        ...prev,
        [sectionId]: {
          ...current,
          subsections: current.subsections.map((sub) =>
            sub.title === title ? { ...sub, body } : sub
          ),
        },
      }
    })
  }

  const closingText = Array.isArray(protocolNarrative?.closing)
    ? protocolNarrative.closing.join('\n\n')
    : ''

  return (
    <>
      <div
        className="fixed inset-0 z-[220] flex items-end sm:items-center justify-center bg-ink/40 p-0 sm:p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-review-title"
      >
        <button
          type="button"
          className="absolute inset-0 cursor-default"
          aria-label="Close admin panel"
          onClick={onClose}
        />
        <section className="relative z-10 w-full sm:max-w-2xl h-[min(92dvh,44rem)] sm:h-[min(88vh,42rem)] bg-white dark:bg-surface-card rounded-t-2xl sm:rounded-2xl border border-brand/20 shadow-modal overflow-hidden flex flex-col min-h-0">
          <div className="px-4 sm:px-5 py-4 border-b border-surface-border flex items-start justify-between gap-3 shrink-0">
            <div className="flex items-start gap-3 min-w-0">
              <div className="w-9 h-9 shrink-0 rounded-xl bg-brand-50 flex items-center justify-center">
                {isAfter ? (
                  <ImagePlus className="w-4 h-4 text-brand" />
                ) : (
                  <ShieldCheck className="w-4 h-4 text-brand" />
                )}
              </div>
              <div className="min-w-0">
                <h3
                  id="admin-review-title"
                  className="font-display text-base font-semibold text-ink tracking-tight"
                >
                  {isAfter ? 'Projected AFTER image' : 'PDF narrative'} — {assessment.id.slice(-6)}
                </h3>
                <p className="text-xs text-ink-muted mt-0.5">
                  {isAfter
                    ? 'Generate or refresh the full-face projected AFTER used in the protocol and PDF.'
                    : 'Generate whole or per-section protocol text, edit subsections, then save.'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 shrink-0 rounded-xl border border-surface-border text-ink-muted hover:text-ink hover:border-brand/30 inline-flex items-center justify-center transition-colors"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-5 space-y-4">
            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                {error}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex px-2 py-0.5 rounded-md border text-[10px] font-semibold ${
                  isApproved
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-amber-50 text-amber-700 border-amber-200'
                }`}
              >
                {isApproved ? 'Approved' : 'Pending review'}
              </span>
            </div>

            {isNarrative && (
              <>
                <button
                  type="button"
                  onClick={handleGenerateWhole}
                  disabled={busy || isApproved}
                  className="w-full inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border border-brand/20 bg-brand-50 text-xs font-semibold text-brand hover:bg-brand/10 transition-colors disabled:opacity-50"
                >
                  {generatingWhole ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="w-3.5 h-3.5" />
                  )}
                  Generate AI narrative for whole PDF
                </button>

                <div className="flex flex-col sm:flex-row gap-2">
                  <label className="sr-only" htmlFor="admin-protocol-section">
                    Protocol section
                  </label>
                  <select
                    id="admin-protocol-section"
                    value={sectionId}
                    onChange={(event) => setSectionId(event.target.value)}
                    disabled={busy || isApproved}
                    className="w-full sm:flex-1 rounded-xl border border-surface-border bg-white dark:bg-surface-card px-3 py-2.5 text-xs font-semibold text-ink outline-none focus:border-brand disabled:opacity-50"
                  >
                    {PROTOCOL_SECTION_OPTIONS.map((opt) => (
                      <option key={opt.id} value={opt.id}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={handleGenerateSection}
                    disabled={busy || isApproved}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border border-brand/20 bg-white text-xs font-semibold text-brand hover:bg-brand-50 transition-colors disabled:opacity-50"
                  >
                    {generatingSection ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="w-3.5 h-3.5" />
                    )}
                    Generate section
                  </button>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-ink-secondary mb-2">
                    Admin notes
                  </label>
                  <textarea
                    value={adminNotes}
                    onChange={(event) => setAdminNotes(event.target.value)}
                    rows={3}
                    disabled={isApproved}
                    className={fieldClass}
                    placeholder="Internal review notes (not shown to client)"
                  />
                </div>

                <div className="rounded-xl border border-surface-border p-3 sm:p-4 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                    <h4 className="text-xs font-semibold text-ink">
                      Edit section —{' '}
                      {PROTOCOL_SECTION_OPTIONS.find((o) => o.id === sectionId)?.label || sectionId}
                    </h4>
                    <p className="text-[11px] text-ink-muted">Changes apply to the PDF after Save.</p>
                  </div>

                  {sectionId === 'overview' && (
                    <div>
                      <label className="block text-xs font-semibold text-ink-secondary mb-2">
                        Overview summary
                      </label>
                      <textarea
                        value={protocolNarrative?.summary || ''}
                        onChange={(event) => updateOverviewSummary(event.target.value)}
                        rows={5}
                        disabled={isApproved}
                        className={fieldClass}
                        placeholder="Protocol overview text shown in the PDF"
                      />
                    </div>
                  )}

                  {sectionId === 'closing' && (
                    <div>
                      <label className="block text-xs font-semibold text-ink-secondary mb-2">
                        Closing paragraphs
                      </label>
                      <textarea
                        value={closingText}
                        onChange={(event) => updateClosingText(event.target.value)}
                        rows={8}
                        disabled={isApproved}
                        className={fieldClass}
                        placeholder="One paragraph per blank line"
                      />
                    </div>
                  )}

                  {featureDraft && (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-semibold text-ink-secondary mb-2">
                          Feature summary
                        </label>
                        <textarea
                          value={featureDraft.summary || ''}
                          onChange={(event) => updateFeatureSummary(event.target.value)}
                          rows={3}
                          disabled={isApproved}
                          className={fieldClass}
                          placeholder="Short section summary"
                        />
                      </div>
                      {featureDraft.subsections.map((sub) => (
                        <div key={sub.title}>
                          <label className="block text-xs font-semibold text-ink-secondary mb-2">
                            {sub.title}
                          </label>
                          <textarea
                            value={sub.body || ''}
                            onChange={(event) =>
                              updateFeatureSubsection(sub.title, event.target.value)
                            }
                            rows={5}
                            disabled={isApproved}
                            className={fieldClass}
                            placeholder={`${sub.title} body`}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}

            {isAfter && (
              <>
                <button
                  type="button"
                  onClick={handleGenerateAfter}
                  disabled={busy || isApproved}
                  className="w-full inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border border-brand/20 bg-brand-50 text-xs font-semibold text-brand hover:bg-brand/10 transition-colors disabled:opacity-50"
                >
                  {generatingAfter ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <ImagePlus className="w-3.5 h-3.5" />
                  )}
                  {afterUrl ? 'Regenerate after image' : 'Generate after image'}
                </button>

                {afterUrl ? (
                  <div className="rounded-xl border border-surface-border bg-surface-muted/40 p-3 space-y-3">
                    <img
                      src={afterUrl}
                      alt="Projected after preview"
                      className="w-full max-h-[min(50vh,22rem)] object-contain rounded-lg border border-surface-border bg-white"
                    />
                    <div>
                      <p className="text-xs font-semibold text-ink">Projected AFTER ready</p>
                      <p className="text-[11px] text-ink-muted break-all mt-1">{afterUrl}</p>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-surface-border px-4 py-8 text-center text-xs text-ink-muted">
                    No projected AFTER yet. Generate one to use it on all protocol/PDF AFTER slots.
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-ink-secondary mb-2">
                    Admin notes
                  </label>
                  <textarea
                    value={adminNotes}
                    onChange={(event) => setAdminNotes(event.target.value)}
                    rows={3}
                    disabled={isApproved}
                    className={fieldClass}
                    placeholder="Internal review notes (not shown to client)"
                  />
                </div>
              </>
            )}
          </div>

          <div className="shrink-0 border-t border-surface-border bg-white dark:bg-surface-card px-4 sm:px-5 py-3 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
            <button
              type="button"
              onClick={() => setApproveConfirmOpen(true)}
              disabled={busy || isApproved}
              className="w-full sm:w-auto px-3 py-2.5 rounded-xl border border-emerald-200 bg-emerald-50 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 transition-colors disabled:opacity-50"
            >
              Approve & release to client
            </button>
            <button
              type="button"
              onClick={() => handleSave('pending_review')}
              disabled={busy || isApproved}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-brand text-white text-xs font-semibold hover:bg-brand-dark transition-colors disabled:opacity-50 shadow-brand"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              Save edits
            </button>
          </div>
        </section>
      </div>

      <ConfirmDialog
        open={approveConfirmOpen}
        title="Approve report?"
        message="This releases the full report and PDF download to the client. This action cannot be undone."
        confirmLabel="Approve"
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
