'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Loader2, Save, Sparkles } from 'lucide-react'
import {
  generateAssessmentProtocol,
  generateAssessmentProtocolSection,
} from '../../utils/apiClient'
import { PROTOCOL_SECTION_OPTIONS } from '../../utils/protocolSections'
import { translateApiError } from '../../utils/translateApiError'

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

  const [generatingWhole, setGeneratingWhole] = useState(false)
  const [generatingSection, setGeneratingSection] = useState(false)
  const [error, setError] = useState('')

  const busy = saving || generatingWhole || generatingSection

  const applyUpdate = (updated) => {
    if (!updated) return
    onSaved?.(updated)
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
      applyUpdate(await generateAssessmentProtocol(assessmentId, { force: true }))
    } catch (err) {
      setError(translateApiError(err, tErrors))
    } finally {
      setGeneratingWhole(false)
    }
  }

  const handleGenerateSection = async () => {
    if (!assessmentId || !confirmDiscardDirty()) return
    setGeneratingSection(true)
    setError('')
    try {
      applyUpdate(await generateAssessmentProtocolSection(assessmentId, sectionId))
    } catch (err) {
      setError(translateApiError(err, tErrors))
    } finally {
      setGeneratingSection(false)
    }
  }

  return (
    <div className="qoves-protocol-edit-dock">
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
        {generatingSection ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
        {t('generateSection')}
      </button>

      <button
        type="button"
        onClick={handleGenerateWhole}
        disabled={busy}
        className="w-full inline-flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-lg border border-brand/20 bg-brand-50 text-[11px] font-semibold text-brand hover:bg-brand/10 transition-colors disabled:opacity-50"
      >
        {generatingWhole ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
        {t('generateWhole')}
      </button>

      <button
        type="button"
        onClick={onSave}
        disabled={busy || !dirty}
        className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-brand text-white text-xs font-semibold hover:bg-brand-dark transition-colors disabled:opacity-50 shadow-brand"
      >
        {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
        {t('saveEdits')}
      </button>
    </div>
  )
}
