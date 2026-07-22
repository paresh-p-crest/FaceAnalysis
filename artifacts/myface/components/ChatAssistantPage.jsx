'use client'

import { useCallback, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Bot, Loader2, Sparkles } from 'lucide-react'
import {
  fetchAssistantConversation,
  isBackendApiEnabled,
  sendAssistantMessage,
} from '../utils/apiClient'
import { fetchLatestSubmittedAssessment } from '../utils/latestAssessment'
import { translateApiError } from '../utils/translateApiError'
import { ChatAssistant } from './ChatAssistant'
import { StandalonePageShell } from './StandalonePageShell'

/** Standalone `/chat` — full-page assistant, independent of the report modal. */
export default function ChatAssistantPage({ onStartAssessment }) {
  const t = useTranslations('Assistant')
  const tErrors = useTranslations('Errors')
  const tHome = useTranslations('Home')
  const [assessment, setAssessment] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const full = await fetchLatestSubmittedAssessment()
      setAssessment(full)
    } catch (err) {
      setError(translateApiError(err, tErrors))
      setAssessment(null)
    } finally {
      setLoading(false)
    }
  }, [tErrors])

  useEffect(() => {
    load()
  }, [load])

  const assessmentId = assessment?.id || null
  const canUseAssistant = !!assessmentId && isBackendApiEnabled()

  const handleLoad = useCallback(async () => {
    if (!assessmentId || !isBackendApiEnabled()) return { messages: [] }
    return fetchAssistantConversation(assessmentId)
  }, [assessmentId])

  const handleSend = useCallback(async (message) => {
    if (!assessmentId || !isBackendApiEnabled()) return { messages: [] }
    return sendAssistantMessage(assessmentId, message)
  }, [assessmentId])

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
            <Bot className="h-6 w-6 text-brand" />
          </div>
          <h1 className="font-serif text-2xl sm:text-3xl text-ink tracking-tight mb-2">
            {t('title')}
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
    <ChatAssistant
      assessmentId={assessmentId}
      canUseAssistant={canUseAssistant}
      onLoad={handleLoad}
      onSend={handleSend}
      fullPage
    />
  )
}
