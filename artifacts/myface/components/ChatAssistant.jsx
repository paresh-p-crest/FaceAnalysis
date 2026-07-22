'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import ReactMarkdown from 'react-markdown'
import { Bot, Loader2, Send, ShieldCheck, User, ArrowUp } from 'lucide-react'
import { StandalonePageShell } from './StandalonePageShell'

const COMPOSER_MAX_HEIGHT_PX = 128 // matches .chat-composer-input max-height (8rem)

const SUGGESTION_KEYS = [
  'suggestions.priorities',
  'suggestions.skin',
  'suggestions.hairstyle',
  'suggestions.progress',
]

function AssistantMarkdown({ content }) {
  return (
    <div className="assistant-markdown">
      <ReactMarkdown
        components={{
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noopener noreferrer">
              {children}
            </a>
          ),
        }}
      >
        {content || ''}
      </ReactMarkdown>
    </div>
  )
}

function MessageBubble({ message, fullPage = false }) {
  const isUser = message.role === 'user'

  if (fullPage) {
    return (
      <div className={`flex gap-3 sm:gap-4 ${isUser ? 'justify-end' : 'justify-start'}`}>
        {!isUser && (
          <div className="w-8 h-8 rounded-full bg-brand-50 flex items-center justify-center shrink-0 mt-0.5">
            <Bot className="w-4 h-4 text-brand" />
          </div>
        )}
        <div className={`max-w-[85%] text-sm leading-relaxed ${
          isUser
            ? 'rounded-3xl bg-brand text-white px-4 py-2.5'
            : 'text-ink-secondary pt-0.5'
        }`}>
          {isUser ? (
            <p className="whitespace-pre-wrap">{message.content}</p>
          ) : (
            <AssistantMarkdown content={message.content} />
          )}
        </div>
        {isUser && (
          <div className="w-8 h-8 rounded-full bg-surface-warm border border-surface-border flex items-center justify-center shrink-0 mt-0.5">
            <User className="w-4 h-4 text-ink-muted" />
          </div>
        )}
      </div>
    )
  }

  return (
    <div className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser && (
        <div className="w-8 h-8 rounded-lg bg-brand-50 flex items-center justify-center shrink-0">
          <Bot className="w-4 h-4 text-brand" />
        </div>
      )}
      <div className={`max-w-[85%] rounded-2xl px-4 py-3 border text-sm leading-relaxed ${
        isUser
          ? 'bg-brand text-white border-brand'
          : 'bg-white dark:bg-surface-card text-ink-secondary border-surface-border'
      }`}>
        {isUser ? (
          <p className="whitespace-pre-wrap">{message.content}</p>
        ) : (
          <AssistantMarkdown content={message.content} />
        )}
      </div>
      {isUser && (
        <div className="w-8 h-8 rounded-lg bg-surface-warm border border-surface-border flex items-center justify-center shrink-0">
          <User className="w-4 h-4 text-ink-muted" />
        </div>
      )}
    </div>
  )
}

function TypingBubble({ fullPage = false }) {
  if (fullPage) {
    return (
      <div className="flex gap-3 sm:gap-4 justify-start" aria-live="polite" aria-label="Assistant is typing">
        <div className="w-8 h-8 rounded-full bg-brand-50 flex items-center justify-center shrink-0">
          <Bot className="w-4 h-4 text-brand" />
        </div>
        <div className="pt-1">
          <Loader2 className="w-4 h-4 animate-spin text-brand" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex gap-3 justify-start" aria-live="polite" aria-label="Assistant is typing">
      <div className="w-8 h-8 rounded-lg bg-brand-50 flex items-center justify-center shrink-0">
        <Bot className="w-4 h-4 text-brand" />
      </div>
      <div className="rounded-2xl px-4 py-3 border bg-white dark:bg-surface-card border-surface-border">
        <div className="flex items-center gap-2 text-sm text-ink-muted">
          <Loader2 className="w-4 h-4 animate-spin text-brand" />
        </div>
      </div>
    </div>
  )
}

export function ChatAssistant({ assessmentId, canUseAssistant, onLoad, onSend, fullPage = false }) {
  const t = useTranslations('Assistant')
  const [conversation, setConversation] = useState(null)
  const [pendingUserMessage, setPendingUserMessage] = useState(null)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const scrollRef = useRef(null)
  const inputRef = useRef(null)

  const syncComposerHeight = useCallback(() => {
    const el = inputRef.current
    if (!el) return
    el.style.height = 'auto'
    const next = Math.min(el.scrollHeight, COMPOSER_MAX_HEIGHT_PX)
    el.style.height = `${next}px`
    el.style.overflowY = el.scrollHeight > COMPOSER_MAX_HEIGHT_PX ? 'auto' : 'hidden'
  }, [])

  const handleMessageChange = (event) => {
    setMessage(event.target.value)
    requestAnimationFrame(syncComposerHeight)
  }

  useEffect(() => {
    if (!fullPage) return
    syncComposerHeight()
  }, [message, fullPage, syncComposerHeight])

  const load = async () => {
    if (!canUseAssistant) return
    setLoading(true)
    setError('')
    try {
      setConversation(await onLoad())
      setPendingUserMessage(null)
    } catch (err) {
      setError(err.message || t('loadFailed'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [assessmentId, canUseAssistant])

  const serverMessages = conversation?.messages || []
  const messages = pendingUserMessage
    ? [...serverMessages, pendingUserMessage]
    : serverMessages

  useEffect(() => {
    if (!fullPage || loading) return
    const el = scrollRef.current
    if (el) el.scrollTop = 0
  }, [loading, fullPage, assessmentId])

  useEffect(() => {
    if (fullPage) return

    const el = scrollRef.current
    if (!el || loading) return

    if (el.scrollHeight <= el.clientHeight) {
      el.scrollTop = 0
      return
    }
    el.scrollTop = el.scrollHeight
  }, [messages.length, sending, loading, fullPage])

  const scrollToLatest = () => {
    requestAnimationFrame(() => {
      const el = scrollRef.current
      if (el) el.scrollTop = el.scrollHeight
    })
  }

  const submit = async (text = message) => {
    const trimmed = text.trim()
    if (!trimmed || sending || !canUseAssistant) return

    const optimistic = {
      role: 'user',
      content: trimmed,
      createdAt: new Date().toISOString(),
      pending: true,
    }

    setSending(true)
    setError('')
    setMessage('')
    setPendingUserMessage(optimistic)
    requestAnimationFrame(() => inputRef.current?.focus())

    try {
      const updated = await onSend(trimmed)
      setConversation(updated)
      setPendingUserMessage(null)
    } catch (err) {
      setError(err.message || t('unavailable'))
      setPendingUserMessage(null)
      setMessage(trimmed)
    } finally {
      setSending(false)
      if (fullPage) scrollToLatest()
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }

  const handleComposerKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      submit()
    }
  }

  const showEmpty = !loading && messages.length === 0 && !sending

  // Full page: ChatGPT-style dock — messages scroll, floating pill composer
  if (fullPage) {
    return (
      <StandalonePageShell className="text-ink">
        <div className="tool-page-shell__body">
          <div className="qoves-report-layout flex-1 min-h-0 h-full">
            <main className="qoves-report-canvas qoves-report-canvas--chat min-w-0">
              <div className="chat-page-shell__body">
          <div
            ref={scrollRef}
            className="chat-page-shell__messages"
          >
            <div className="chat-page-shell__thread space-y-4">
              {!canUseAssistant && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                  {t('needsBackend')}
                </div>
              )}
              {error && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  {error}
                </div>
              )}
              {loading ? (
                <div className="flex flex-col items-center gap-3 py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-brand" />
                  <p className="text-sm text-ink-muted">{t('loading')}</p>
                </div>
              ) : showEmpty ? (
                <div className="pt-2">
                  <div className="text-center mb-6 max-w-md mx-auto">
                    <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-brand-50">
                      <Bot className="w-6 h-6 text-brand" />
                    </div>
                    <p className="font-display text-xl text-ink mb-2">{t('emptyTitle')}</p>
                    <p className="text-sm text-ink-muted">{t('emptySubtitle')}</p>
                  </div>
                  <div className="grid w-full max-w-xl mx-auto sm:grid-cols-2 gap-2">
                  {SUGGESTION_KEYS.map((key) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => submit(t(key))}
                      disabled={!canUseAssistant || sending}
                      className="text-left rounded-2xl border border-surface-border bg-white px-4 py-3 text-sm text-ink-secondary hover:text-brand hover:border-brand/30 transition-colors disabled:opacity-50 disabled:pointer-events-none"
                    >
                      {t(key)}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-6 sm:space-y-8 pb-4">
                {messages.map((item, index) => (
                  <MessageBubble
                    key={`${item.role}-${index}-${item.createdAt || item.content?.slice(0, 24) || ''}`}
                    message={item}
                    fullPage
                  />
                ))}
                {sending && <TypingBubble fullPage />}
              </div>
            )}
            </div>
          </div>

          <div className="chat-page-shell__composer">
            <div className="chat-composer-dock">
              <form
                onSubmit={(event) => {
                  event.preventDefault()
                  submit()
                }}
                className="chat-composer-pill"
              >
                <textarea
                  ref={inputRef}
                  rows={1}
                  value={message}
                  onChange={handleMessageChange}
                  onKeyDown={handleComposerKeyDown}
                  disabled={!canUseAssistant || sending}
                  placeholder={sending ? t('placeholderSending') : t('placeholderShort')}
                  className="chat-composer-input"
                  aria-label={t('inputAria')}
                />
                <button
                  type="submit"
                  disabled={!canUseAssistant || sending || !message.trim()}
                  className="chat-composer-send"
                  aria-label={t('send')}
                >
                  {sending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <ArrowUp className="w-4 h-4" />
                  )}
                </button>
              </form>
            </div>
          </div>
        </div>
            </main>
          </div>
        </div>
      </StandalonePageShell>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Bot className="w-5 h-5 text-brand" />
          <h3 className="font-display text-lg font-semibold text-ink">{t('title')}</h3>
        </div>
        <span className="inline-flex items-center gap-1.5 text-[10px] px-2 py-1 rounded-md border bg-brand-50 text-brand border-brand/20 font-semibold">
          <ShieldCheck className="w-3 h-3" />
          {t('groundedBadge')}
        </span>
      </div>

      {!canUseAssistant && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
          {t('needsBackend')}
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </div>
      )}

      <div className="h-[min(26rem,62vh)] sm:h-[min(32rem,68vh)] lg:h-[min(36rem,72vh)] w-full rounded-2xl border border-surface-border bg-surface-warm dark:bg-surface-raised flex flex-col overflow-hidden">
        <div
          ref={scrollRef}
          className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-3 sm:p-5 lg:p-6"
        >
          {loading ? (
            <div className="flex flex-col items-center justify-center h-full gap-3">
              <Loader2 className="w-6 h-6 animate-spin text-brand" />
              <p className="text-sm text-ink-muted">{t('loading')}</p>
            </div>
          ) : showEmpty ? (
            <div className="py-6">
              <div className="text-center mb-6">
                <Bot className="w-10 h-10 text-brand mx-auto mb-3" />
                <p className="font-display text-ink mb-1">{t('emptyTitle')}</p>
                <p className="text-sm text-ink-muted">{t('emptySubtitle')}</p>
              </div>
              <div className="grid sm:grid-cols-2 gap-2">
                {SUGGESTION_KEYS.map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => submit(t(key))}
                    disabled={!canUseAssistant || sending}
                    className="text-left rounded-xl border border-surface-border bg-white dark:bg-surface-card px-3 py-2 text-xs text-ink-secondary hover:text-brand hover:border-brand/30 transition-colors disabled:opacity-50 disabled:pointer-events-none"
                  >
                    {t(key)}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((item, index) => (
                <MessageBubble
                  key={`${item.role}-${index}-${item.createdAt || item.content?.slice(0, 24) || ''}`}
                  message={item}
                />
              ))}
              {sending && <TypingBubble />}
            </div>
          )}
        </div>

        <form
          onSubmit={(event) => {
            event.preventDefault()
            submit()
          }}
          className="shrink-0 border-t border-surface-border bg-white/80 dark:bg-surface-card/80 backdrop-blur-sm p-3 sm:p-4 flex gap-2 sm:gap-3"
        >
          <input
            ref={inputRef}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            disabled={!canUseAssistant}
            placeholder={sending ? t('placeholderSending') : t('placeholder')}
            className="input-field flex-1"
            aria-label={t('inputAria')}
          />
          <button
            type="submit"
            disabled={!canUseAssistant || sending || !message.trim()}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-brand text-white text-sm font-semibold shadow-brand hover:bg-brand-dark disabled:opacity-50 min-w-[6.5rem]"
          >
            {sending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {t('sending')}
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                {t('send')}
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  )
}
