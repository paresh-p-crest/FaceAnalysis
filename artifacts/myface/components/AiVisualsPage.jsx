'use client'

import { useCallback, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Loader2, Sparkles } from 'lucide-react'
import {
  fetchAssessment,
  fetchMyAssessments,
  generateAssessmentVisuals,
  isBackendApiEnabled,
} from '../utils/apiClient'
import { resolveAssessmentFrontPhoto } from '../utils/assessmentPhotos'
import { userReportReady } from '../utils/reportWorkflow'
import { translateApiError } from '../utils/translateApiError'
import { AiVisualsSection } from './AiVisualsSection'
import { StandalonePageShell } from './StandalonePageShell'
import { ReportDocumentLayout } from './report/ReportDocumentLayout'
import { AI_VISUAL_NAV_GROUPS } from './report/reportNavConfig'

async function loadLatestReadyAssessment() {
  if (!isBackendApiEnabled()) return null
  const items = await fetchMyAssessments(20)
  const list = Array.isArray(items) ? items : []
  const ready = list.find((item) => userReportReady(item)) || list[0]
  if (!ready?.id) return null
  return fetchAssessment(ready.id)
}

/** Standalone `/ai-visuals` — independent of the report modal. */
export default function AiVisualsPage({ onStartAssessment, user = null }) {
  const t = useTranslations('AiVisuals')
  const tErrors = useTranslations('Errors')
  const tHome = useTranslations('Home')
  const [activeType, setActiveType] = useState('hair')
  const [assessment, setAssessment] = useState(null)
  const [aiVisuals, setAiVisuals] = useState(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')
  const [genError, setGenError] = useState('')

  const isAdmin = user?.role === 'admin'

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const full = await loadLatestReadyAssessment()
      setAssessment(full)
      setAiVisuals(full?.aiVisuals || full?.analysis?.aiVisuals || null)
    } catch (err) {
      setError(translateApiError(err, tErrors))
      setAssessment(null)
      setAiVisuals(null)
    } finally {
      setLoading(false)
    }
  }, [tErrors])

  useEffect(() => {
    load()
  }, [load])

  const assessmentId = assessment?.id || null
  const canGenerate = !!assessmentId && isBackendApiEnabled() && isAdmin

  const handleGenerate = useCallback(async () => {
    if (!assessmentId || !canGenerate || generating) return
    setGenerating(true)
    setGenError('')
    try {
      const updated = await generateAssessmentVisuals(assessmentId)
      setAiVisuals(updated?.aiVisuals || null)
      if (updated) setAssessment((prev) => (prev ? { ...prev, ...updated, aiVisuals: updated.aiVisuals } : updated))
    } catch (err) {
      setGenError(err.message || t('needsBackend'))
    } finally {
      setGenerating(false)
    }
  }, [assessmentId, canGenerate, generating, t])

  if (loading) {
    return (
      <StandalonePageShell>
        <div className="tool-page-shell__body flex items-center justify-center qoves-report-layout">
          <div className="text-center py-16">
            <Loader2 className="w-7 h-7 text-brand animate-spin mx-auto mb-3" />
            <p className="text-sm text-ink-muted">{t('loading')}</p>
          </div>
        </div>
      </StandalonePageShell>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center site-navbar-offset bg-surface px-4">
        <div className="max-w-md w-full rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
          <p className="text-sm text-red-700 mb-4">{error}</p>
          <button type="button" onClick={load} className="btn-primary text-sm">
            {tHome('retry')}
          </button>
        </div>
      </div>
    )
  }

  if (!assessment) {
    return (
      <div className="min-h-screen flex items-center justify-center site-navbar-offset bg-surface px-4">
        <div className="max-w-lg w-full rounded-3xl border border-surface-border bg-white p-8 sm:p-10 text-center shadow-card">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full border-2 border-brand/30 bg-brand/5">
            <Sparkles className="h-6 w-6 text-brand" />
          </div>
          <h1 className="font-serif text-2xl sm:text-3xl text-ink tracking-tight mb-2">
            {t('emptyTitle')}
          </h1>
          <p className="text-sm text-ink-secondary leading-relaxed mb-6 max-w-md mx-auto">
            {t('needsReport')}
          </p>
          {onStartAssessment && (
            <button type="button" onClick={onStartAssessment} className="btn-primary">
              <Sparkles className="w-4 h-4" />
              {tHome('startCta')}
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <StandalonePageShell className="text-ink">
      <div className="tool-page-shell__body">
        <ReportDocumentLayout
          activeId={activeType}
          onSelect={setActiveType}
          groups={AI_VISUAL_NAV_GROUPS}
          tNamespace="AiVisuals"
          titleKey="navTitle"
          defaultOpenGroupId="visuals"
          canvasClassName="qoves-report-canvas--tools"
        >
          <AiVisualsSection
            aiVisuals={aiVisuals}
            loading={generating}
            error={genError}
            onGenerate={handleGenerate}
            canGenerate={canGenerate}
            activeType={activeType}
            showGenerate={isAdmin}
            beforeSrc={resolveAssessmentFrontPhoto(assessment)}
          />
        </ReportDocumentLayout>
      </div>
    </StandalonePageShell>
  )
}
