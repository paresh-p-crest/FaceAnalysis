'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
import {
  cloneProtocolDraft,
  draftSnapshot,
  mergeNarrativesForPdf,
  setClosingParagraphs,
  setFeatureSummary,
  upsertFeatureSubsection,
} from '../../utils/protocolSections'
import { updateAssessmentAdminReview } from '../../utils/apiClient'
import { ProtocolNarrativeEditDock } from './ProtocolNarrativeEditDock'
import QovesProtocolReport from './QovesProtocolReport'

function pickVisibleProtocolSection(scrollRoot) {
  if (!scrollRoot) return null
  const pages = scrollRoot.querySelectorAll('[data-protocol-section]')
  if (!pages.length) return null
  const rootRect = scrollRoot.getBoundingClientRect()
  const anchor = rootRect.top + rootRect.height * 0.35
  let bestId = null
  let bestDist = Infinity
  pages.forEach((el) => {
    const r = el.getBoundingClientRect()
    if (r.bottom < rootRect.top + 8 || r.top > rootRect.bottom - 8) return
    const elAnchor = r.top + Math.min(48, r.height * 0.2)
    const dist = Math.abs(elAnchor - anchor)
    if (dist < bestDist) {
      bestDist = dist
      bestId = el.dataset.protocolSection
    }
  })
  return bestId
}

export function ProtocolDocumentViewer({
  photo,
  photos,
  landmarks,
  cvReport,
  metrics,
  answers,
  user = null,
  assessmentOwner = null,
  eyeAnalysis,
  protocolNarrative,
  featureNarratives = null,
  aiNarrative,
  protocolLoading,
  projectedAfter = null,
  projectedAnalysis = null,
  showAdminEdit = false,
  assessmentId = null,
  adminAssessment = null,
  onNarrativesSaved,
}) {
  const showHtmlPreview = showAdminEdit
  const scrollRef = useRef(null)
  const [building, setBuilding] = useState(false)
  const [buildError, setBuildError] = useState('')
  const [blobUrl, setBlobUrl] = useState(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [sectionId, setSectionId] = useState('overview')
  const [draft, setDraft] = useState(() =>
    cloneProtocolDraft({ protocolNarrative, featureNarratives })
  )
  const [savedKey, setSavedKey] = useState(() =>
    draftSnapshot(cloneProtocolDraft({ protocolNarrative, featureNarratives }))
  )

  const dirty = useMemo(() => draftSnapshot(draft) !== savedKey, [draft, savedKey])

  const displayNarrative = useMemo(
    () => mergeNarrativesForPdf(draft.protocolNarrative, draft.featureNarratives),
    [draft]
  )

  useEffect(() => {
    const next = cloneProtocolDraft({ protocolNarrative, featureNarratives })
    setDraft(next)
    setSavedKey(draftSnapshot(next))
    setSaveError('')
  }, [assessmentId, protocolNarrative, featureNarratives])

  useEffect(() => {
    if (!dirty) return undefined
    const onBeforeUnload = (e) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [dirty])

  const handleEditFeatureSubsection = useCallback((featureId, title, value) => {
    setDraft((prev) => ({
      ...prev,
      featureNarratives: upsertFeatureSubsection(prev.featureNarratives, featureId, title, value),
    }))
  }, [])

  const handleEditFeatureSummary = useCallback((featureId, value) => {
    setDraft((prev) => ({
      ...prev,
      featureNarratives: setFeatureSummary(prev.featureNarratives, featureId, value),
    }))
  }, [])

  const handleEditClosing = useCallback((paragraphs) => {
    setDraft((prev) => ({
      ...prev,
      protocolNarrative: setClosingParagraphs(prev.protocolNarrative, paragraphs),
    }))
  }, [])

  const handleEditOverview = useCallback((summary) => {
    setDraft((prev) => ({
      ...prev,
      protocolNarrative: { ...(prev.protocolNarrative || {}), summary },
    }))
  }, [])

  const handleSave = useCallback(async () => {
    if (!assessmentId || !dirty) return
    setSaving(true)
    setSaveError('')
    try {
      const updated = await updateAssessmentAdminReview(assessmentId, {
        status: adminAssessment?.status || 'pending_review',
        protocolNarrative: draft.protocolNarrative,
        featureNarratives: draft.featureNarratives,
      })
      const next = cloneProtocolDraft(updated)
      setDraft(next)
      setSavedKey(draftSnapshot(next))
      onNarrativesSaved?.(updated)
    } catch (err) {
      console.error('Protocol edit save failed:', err)
      setSaveError(err?.message || 'Could not save edits.')
    } finally {
      setSaving(false)
    }
  }, [assessmentId, adminAssessment?.status, dirty, draft, onNarrativesSaved])

  const handleSectionIdChange = useCallback((id) => {
    setSectionId(id)
    const root = scrollRef.current
    if (!root) return
    root.querySelector(`[data-protocol-section="${id}"]`)?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    })
  }, [])

  useEffect(() => {
    const root = scrollRef.current
    if (!showHtmlPreview || protocolLoading || !root) return undefined
    let raf = 0
    const syncSectionFromScroll = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        const id = pickVisibleProtocolSection(root)
        if (id) setSectionId(id)
      })
    }
    root.addEventListener('scroll', syncSectionFromScroll, { passive: true })
    syncSectionFromScroll()
    return () => {
      root.removeEventListener('scroll', syncSectionFromScroll)
      cancelAnimationFrame(raf)
    }
  }, [showHtmlPreview, protocolLoading])

  const narrativeKey = useMemo(
    () =>
      JSON.stringify({
        pn: displayNarrative,
        photo: photo ? '1' : '0',
        after: projectedAfter?.full || projectedAfter?.url || '',
      }),
    [displayNarrative, photo, projectedAfter]
  )

  const buildPdf = useCallback(async () => {
    if (!photo || !cvReport) return
    setBuilding(true)
    setBuildError('')
    try {
      const { buildMyFacePdf } = await import('../../utils/reportPdf')
      const { blob } = await buildMyFacePdf({
        photo,
        photos,
        cvReport,
        metrics,
        landmarks,
        protocolNarrative: displayNarrative,
        answers,
        eyeAnalysis,
        aiNarrative,
        user,
        assessmentOwner,
        projectedAfter,
        projectedAnalysis,
        assessmentId,
        createdAt: adminAssessment?.createdAt,
        updatedAt: adminAssessment?.updatedAt,
      })
      setBlobUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev)
        return URL.createObjectURL(blob)
      })
    } catch (err) {
      console.error('Protocol PDF preview failed:', err)
      setBuildError(err?.message || 'Could not build protocol PDF preview.')
    } finally {
      setBuilding(false)
    }
  }, [
    photo,
    photos,
    cvReport,
    metrics,
    landmarks,
    displayNarrative,
    answers,
    eyeAnalysis,
    aiNarrative,
    user,
    assessmentOwner,
    projectedAfter,
    projectedAnalysis,
    assessmentId,
    adminAssessment,
  ])

  useEffect(() => {
    if (showHtmlPreview || protocolLoading || !photo || !cvReport) return undefined
    buildPdf()
    return undefined
  }, [showHtmlPreview, narrativeKey, protocolLoading, photo, cvReport, buildPdf])

  useEffect(
    () => () => {
      if (blobUrl) URL.revokeObjectURL(blobUrl)
    },
    [blobUrl]
  )

  if (protocolLoading) {
    return (
      <div className="qoves-protocol-viewer qoves-protocol-viewer--fill flex flex-col items-center justify-center">
        <Loader2 className="w-8 h-8 text-brand animate-spin" />
        <p className="text-ink-muted text-sm font-sans mt-4">Preparing aesthetic protocol…</p>
      </div>
    )
  }

  return (
    <div className="qoves-protocol-viewer qoves-protocol-viewer--fill">
      <div className={`qoves-protocol-layout ${showAdminEdit ? 'qoves-protocol-layout--with-edit' : ''}`}>
        <div
          ref={scrollRef}
          className={`qoves-protocol-scroll ${showHtmlPreview ? 'qoves-protocol-scroll--html' : ''}`}
        >
          {showHtmlPreview ? (
            <>
              <div className={`qoves-protocol-edit-status ${saveError ? 'qoves-protocol-edit-status--error' : ''}`}>
                {saving ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Saving edits…
                  </>
                ) : saveError ? (
                  saveError
                ) : dirty ? (
                  'Unsaved changes — click Save edits in the panel to persist.'
                ) : (
                  'Click overview, feature, or closing text to edit. Save in the panel when ready.'
                )}
              </div>
              <QovesProtocolReport
                photo={photo}
                photos={photos}
                landmarks={landmarks}
                cvReport={cvReport}
                metrics={metrics}
                answers={answers}
                user={user}
                assessmentOwner={assessmentOwner}
                eyeAnalysis={eyeAnalysis}
                protocolNarrative={displayNarrative}
                aiNarrative={aiNarrative}
                projectedAfter={projectedAfter}
                projectedAnalysis={projectedAnalysis}
                assessmentId={assessmentId}
                createdAt={adminAssessment?.createdAt}
                updatedAt={adminAssessment?.updatedAt}
                paginated={false}
                editable
                onEditFeatureSubsection={handleEditFeatureSubsection}
                onEditFeatureSummary={handleEditFeatureSummary}
                onEditClosing={handleEditClosing}
                onEditOverview={handleEditOverview}
              />
            </>
          ) : (
            <>
              {building && !blobUrl && (
                <div className="flex flex-col items-center justify-center flex-1 gap-4">
                  <Loader2 className="w-8 h-8 text-brand animate-spin" />
                  <p className="text-ink-muted text-sm font-sans">Building protocol PDF…</p>
                </div>
              )}
              {buildError && (
                <div className="m-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  {buildError}
                </div>
              )}
              {blobUrl && (
                <iframe
                  title="Protocol PDF"
                  src={blobUrl}
                  className="qoves-protocol-pdf-frame"
                />
              )}
            </>
          )}
        </div>

        {showAdminEdit && assessmentId && adminAssessment && (
          <ProtocolNarrativeEditDock
            assessmentId={assessmentId}
            onSaved={onNarrativesSaved}
            sectionId={sectionId}
            onSectionIdChange={handleSectionIdChange}
            dirty={dirty}
            onSave={handleSave}
            saving={saving}
          />
        )}
      </div>
    </div>
  )
}
