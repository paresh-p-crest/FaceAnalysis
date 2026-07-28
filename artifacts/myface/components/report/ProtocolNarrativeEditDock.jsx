'use client'

import { useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Languages, Loader2, Save, Sparkles } from 'lucide-react'
import {
  generateAssessmentProtocol,
  generateAssessmentProtocolSection,
  regenerateAssessmentNarrativeTranslations,
} from '../../utils/apiClient'
import { PROTOCOL_SECTION_OPTIONS } from '../../utils/protocolSections'
import { translateApiError } from '../../utils/translateApiError'

/** Stable icon slot — avoid swapping lucide roots mid-commit (insertBefore NotFoundError). */
function DockIcon({ busy, IdleIcon }) {
  return (
    <span className="relative inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center">
      <Loader2
        className={`absolute h-3.5 w-3.5 animate-spin ${busy ? 'opacity-100' : 'opacity-0'}`}
        aria-hidden={!busy}
      />
      <IdleIcon
        className={`absolute h-3.5 w-3.5 ${busy ? 'opacity-0' : 'opacity-100'}`}
        aria-hidden={busy}
      />
    </span>
  )
}

/**
 * Lightweight admin dock: section nav + AI generate + Save.
 * Narrative text is edited inline on the HTML protocol pages — not duplicated here.
 */
export function ProtocolNarrativeEditDock({
  assessmentId,
  onSaved,
  sectionId,
  onSectionIdChange,
  dirty = false,
  onSave,
  saving = false,
}) {
  const t = useTranslations('Admin.reviewPanel')
  const tErrors = useTranslations('Errors')
  const tProtocol = useTranslations('Admin.protocolSections')
  const locale = useLocale()

  const [generatingWhole, setGeneratingWhole] = useState(false)
  const [generatingSection, setGeneratingSection] = useState(false)
  const [translating, setTranslating] = useState(false)
  const [error, setError] = useState('')

  const busy = saving || generatingWhole || generatingSection || translating
  // EN is source; only locales with a translation layer (currently de) can retry.
  const canRetryTranslations = locale === 'de'

  /** Notify parent after local busy flag clears — avoids remount during icon commit. */
  const applyUpdate = (updated) => {
    if (!updated) return
    queueMicrotask(() => onSaved?.(updated))
  }

  const confirmDiscardDirty = () => {
    if (!dirty) return true
    return window.confirm(
      'You have unsaved edits. Generate will replace your draft for this section. Continue?'
    )
  }

  const handleGenerateWhole = async () => {
    if (!assessmentId || !confirmDiscardDirty()) return
    setGeneratingWhole(true)
    setError('')
    try {
      const updated = await generateAssessmentProtocol(assessmentId, { force: true })
      setGeneratingWhole(false)
      applyUpdate(updated)
    } catch (err) {
      setError(translateApiError(err, tErrors))
      setGeneratingWhole(false)
    }
  }

  const handleGenerateSection = async () => {
    if (!assessmentId || !confirmDiscardDirty()) return
    setGeneratingSection(true)
    setError('')
    try {
      const updated = await generateAssessmentProtocolSection(assessmentId, sectionId)
      setGeneratingSection(false)
      applyUpdate(updated)
    } catch (err) {
      setError(translateApiError(err, tErrors))
      setGeneratingSection(false)
    }
  }

  const handleRetryTranslations = async () => {
    if (!assessmentId || !canRetryTranslations || !confirmDiscardDirty()) return
    setTranslating(true)
    setError('')
    try {
      const updated = await regenerateAssessmentNarrativeTranslations(assessmentId, locale)
      setTranslating(false)
      applyUpdate(updated)
    } catch (err) {
      setError(translateApiError(err, tErrors))
      setTranslating(false)
    }
  }

  return (
    <div className="report-protocol-edit-dock">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold text-ink font-display">Protocol edit</p>
        {dirty && (
          <span className="text-[10px] font-semibold uppercase tracking-wide text-amber-700">
            Unsaved
          </span>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-[11px] text-red-700">
          {error}
        </div>
      )}

      <label className="sr-only" htmlFor="protocol-viewer-section">
        {t('protocolSectionLabel')}
      </label>
      <select
        id="protocol-viewer-section"
        value={sectionId}
        onChange={(e) => onSectionIdChange?.(e.target.value)}
        disabled={busy}
        className="w-full rounded-lg border border-surface-border bg-white dark:bg-surface-card px-2.5 py-2 text-xs font-semibold text-ink outline-none focus:border-brand disabled:opacity-50"
      >
        {PROTOCOL_SECTION_OPTIONS.map((opt) => (
          <option key={opt.id} value={opt.id}>
            {tProtocol(opt.id)}
          </option>
        ))}
      </select>

      <button
        type="button"
        onClick={handleGenerateSection}
        disabled={busy}
        className="w-full inline-flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-lg border border-brand/20 bg-white text-[11px] font-semibold text-brand hover:bg-brand-50 transition-colors disabled:opacity-50"
      >
        <DockIcon busy={generatingSection} IdleIcon={Sparkles} />
        {t('generateSection')}
      </button>

      <button
        type="button"
        onClick={handleGenerateWhole}
        disabled={busy}
        className="w-full inline-flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-lg border border-brand/20 bg-brand-50 text-[11px] font-semibold text-brand hover:bg-brand/10 transition-colors disabled:opacity-50"
      >
        <DockIcon busy={generatingWhole} IdleIcon={Sparkles} />
        {t('generateWhole')}
      </button>

      {canRetryTranslations ? (
        <div className="space-y-1.5">
          <button
            type="button"
            onClick={handleRetryTranslations}
            disabled={busy}
            className="w-full inline-flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-lg border border-surface-border bg-white text-[11px] font-semibold text-ink hover:bg-surface-warm transition-colors disabled:opacity-50"
            title={t('retryTranslationsHint')}
          >
            <DockIcon busy={translating} IdleIcon={Languages} />
            {t('retryTranslations')}
          </button>
          <p className="text-[10px] leading-snug text-ink-muted px-0.5">
            {t('retryTranslationsDeHint')}
          </p>
        </div>
      ) : (
        <p className="text-[10px] leading-snug text-ink-muted px-0.5">
          {t('retryTranslationsEnHint')}
        </p>
      )}

      <button
        type="button"
        onClick={onSave}
        disabled={busy || !dirty}
        className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-brand text-white text-xs font-semibold hover:bg-brand-dark transition-colors disabled:opacity-50 shadow-brand"
      >
        <DockIcon busy={saving} IdleIcon={Save} />
        {t('saveEdits')}
      </button>
    </div>
  )
}
