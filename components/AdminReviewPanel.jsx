import { useEffect, useMemo, useState } from 'react'
import { Loader2, Save, ShieldCheck, Sparkles, X } from 'lucide-react'
import { generateAssessmentNarrative, updateAssessmentAdminReview } from '../utils/apiClient'
import { normalizeReportStatus } from '../utils/reportWorkflow'
import ConfirmDialog from './ConfirmDialog'

function asLines(value) {
  return Array.isArray(value) ? value.join('\n') : ''
}

function fromLines(value) {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
}

function applyNarrativeToForm(content, setters) {
  setters.setSummary(content.summary || '')
  setters.setStrengths(asLines(content.strengths))
  setters.setFocusAreas(asLines(content.focusAreas))
  setters.setRecommendations(asLines(content.recommendations))
  setters.setDisclaimer(
    content.disclaimer ||
      'Educational aesthetic guidance only. This is not medical advice, diagnosis, or a treatment plan.'
  )
}

export default function AdminReviewPanel({ assessment, onClose, onSaved, embedded = false }) {
  const narrativeContent = useMemo(() => assessment?.aiNarrative?.content || {}, [assessment])

  const [adminNotes, setAdminNotes] = useState(assessment?.adminNotes || '')
  const [summary, setSummary] = useState(narrativeContent.summary || '')
  const [strengths, setStrengths] = useState(asLines(narrativeContent.strengths))
  const [focusAreas, setFocusAreas] = useState(asLines(narrativeContent.focusAreas))
  const [recommendations, setRecommendations] = useState(asLines(narrativeContent.recommendations))
  const [disclaimer, setDisclaimer] = useState(
    narrativeContent.disclaimer ||
      'Educational aesthetic guidance only. This is not medical advice, diagnosis, or a treatment plan.'
  )
  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')
  const [approveConfirmOpen, setApproveConfirmOpen] = useState(false)

  const status = normalizeReportStatus(assessment?.status)
  const isApproved = status === 'approved'

  useEffect(() => {
    if (!assessment) return
    const content = assessment.aiNarrative?.content || {}
    setAdminNotes(assessment.adminNotes || '')
    applyNarrativeToForm(content, {
      setSummary,
      setStrengths,
      setFocusAreas,
      setRecommendations,
      setDisclaimer,
    })
    setError('')
  }, [assessment?.id])

  if (!assessment) return null

  const buildPayload = (nextStatus = status) => ({
    status: nextStatus,
    adminNotes,
    aiNarrative: {
      ...(assessment.aiNarrative || {}),
      source: 'admin',
      content: {
        ...narrativeContent,
        summary,
        strengths: fromLines(strengths),
        focusAreas: fromLines(focusAreas),
        recommendations: fromLines(recommendations),
        disclaimer,
      },
    },
  })

  const handleSave = async (nextStatus = 'pending_review') => {
    setSaving(true)
    setError('')
    try {
      const updated = await updateAssessmentAdminReview(assessment.id, buildPayload(nextStatus))
      onSaved?.(updated)
    } catch (err) {
      setError(err.message || 'Could not save review')
    } finally {
      setSaving(false)
    }
  }

  const handleGenerateNarrative = async () => {
    setGenerating(true)
    setError('')
    try {
      const updated = await generateAssessmentNarrative(assessment.id)
      const content = updated?.aiNarrative?.content || {}
      applyNarrativeToForm(content, {
        setSummary,
        setStrengths,
        setFocusAreas,
        setRecommendations,
        setDisclaimer,
      })
      onSaved?.(updated)
    } catch (err) {
      setError(err.message || 'Could not generate AI narrative')
    } finally {
      setGenerating(false)
    }
  }

  const handleApprove = () => setApproveConfirmOpen(true)

  const confirmApprove = async () => {
    setApproveConfirmOpen(false)
    await handleSave('approved')
  }

  return (
    <>
    <section className="mt-5 bg-white dark:bg-surface-card rounded-2xl border border-brand/20 shadow-card overflow-hidden">
      <div className="px-5 py-4 border-b border-surface-border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-brand-50 flex items-center justify-center">
            <ShieldCheck className="w-4 h-4 text-brand" />
          </div>
          <div>
            <h3 className="font-display text-base font-semibold text-ink tracking-tight">
              Review report — {assessment.id.slice(-6)}
            </h3>
            <p className="text-xs text-ink-muted">
              Generate or edit AI narrative, save changes, then approve to release the report and PDF to the client.
            </p>
          </div>
        </div>
        {!embedded && (
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl border border-surface-border text-ink-muted hover:text-ink hover:border-brand/30 inline-flex items-center justify-center transition-colors"
            aria-label="Close admin review"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="p-5 space-y-4">
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {error}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <span className={`inline-flex px-2 py-0.5 rounded-md border text-[10px] font-semibold ${
            isApproved
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
              : 'bg-amber-50 text-amber-700 border-amber-200'
          }`}>
            {isApproved ? 'Approved' : 'Pending review'}
          </span>
          <button
            type="button"
            onClick={handleGenerateNarrative}
            disabled={generating || saving}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-brand/20 bg-brand-50 text-xs font-semibold text-brand hover:bg-brand/10 transition-colors disabled:opacity-50"
          >
            {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
            Generate AI narrative
          </button>
        </div>

        <div>
          <label className="block text-xs font-semibold text-ink-secondary mb-2">Admin notes</label>
          <textarea
            value={adminNotes}
            onChange={(event) => setAdminNotes(event.target.value)}
            rows={3}
            className="w-full rounded-xl border border-surface-border bg-white dark:bg-surface-card px-3 py-2 text-sm text-ink outline-none focus:border-brand resize-y"
            placeholder="Internal review notes (not shown to client)"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-ink-secondary mb-2">Executive summary</label>
          <textarea
            value={summary}
            onChange={(event) => setSummary(event.target.value)}
            rows={4}
            className="w-full rounded-xl border border-surface-border bg-white dark:bg-surface-card px-3 py-2 text-sm text-ink outline-none focus:border-brand resize-y"
            placeholder="Client-facing summary based on measured CV report"
          />
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-ink-secondary mb-2">Strengths</label>
            <textarea
              value={strengths}
              onChange={(event) => setStrengths(event.target.value)}
              rows={5}
              className="w-full rounded-xl border border-surface-border bg-white dark:bg-surface-card px-3 py-2 text-sm text-ink outline-none focus:border-brand resize-y"
              placeholder="One item per line"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-ink-secondary mb-2">Focus areas</label>
            <textarea
              value={focusAreas}
              onChange={(event) => setFocusAreas(event.target.value)}
              rows={5}
              className="w-full rounded-xl border border-surface-border bg-white dark:bg-surface-card px-3 py-2 text-sm text-ink outline-none focus:border-brand resize-y"
              placeholder="One item per line"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-ink-secondary mb-2">Recommendations</label>
            <textarea
              value={recommendations}
              onChange={(event) => setRecommendations(event.target.value)}
              rows={5}
              className="w-full rounded-xl border border-surface-border bg-white dark:bg-surface-card px-3 py-2 text-sm text-ink outline-none focus:border-brand resize-y"
              placeholder="One item per line"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-ink-secondary mb-2">Client disclaimer</label>
          <textarea
            value={disclaimer}
            onChange={(event) => setDisclaimer(event.target.value)}
            rows={2}
            className="w-full rounded-xl border border-surface-border bg-white dark:bg-surface-card px-3 py-2 text-sm text-ink outline-none focus:border-brand resize-y"
          />
        </div>

        <div className="flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={handleApprove}
            disabled={saving || generating || isApproved}
            className="px-3 py-2 rounded-xl border border-emerald-200 bg-emerald-50 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 transition-colors disabled:opacity-50"
          >
            Approve & release to client
          </button>
          <button
            type="button"
            onClick={() => handleSave('pending_review')}
            disabled={saving || generating || isApproved}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-brand text-white text-xs font-semibold hover:bg-brand-dark transition-colors disabled:opacity-50 shadow-brand"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Save edits
          </button>
        </div>
      </div>
    </section>
    <ConfirmDialog
      open={approveConfirmOpen}
      title="Approve report?"
      message="This releases the full report and PDF download to the client. This action cannot be undone."
      confirmLabel="Approve"
      onConfirm={confirmApprove}
      onCancel={() => setApproveConfirmOpen(false)}
    />
    </>
  )
}
