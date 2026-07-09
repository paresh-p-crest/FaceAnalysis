import { useEffect, useState } from 'react'
import { Bot, Loader2, Send, ShieldCheck, User } from 'lucide-react'

const SUGGESTIONS = [
  'What are my top improvement priorities?',
  'What should I focus on for skin quality?',
  'Which hairstyle direction fits my face shape?',
  'How should I track progress over 30 days?',
]

function MessageBubble({ message }) {
  const isUser = message.role === 'user'
  return (
    <div className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser && (
        <div className="w-8 h-8 rounded-lg bg-brand-50 flex items-center justify-center shrink-0">
          <Bot className="w-4 h-4 text-brand" />
        </div>
      )}
      <div className={`max-w-[78%] rounded-2xl px-4 py-3 border text-sm leading-relaxed ${
        isUser
          ? 'bg-brand text-white border-brand'
          : 'bg-white dark:bg-surface-card text-ink-secondary border-surface-border'
      }`}>
        <p className="whitespace-pre-wrap">{message.content}</p>
      </div>
      {isUser && (
        <div className="w-8 h-8 rounded-lg bg-surface-warm border border-surface-border flex items-center justify-center shrink-0">
          <User className="w-4 h-4 text-ink-muted" />
        </div>
      )}
    </div>
  )
}

export function BeautyAssistantSection({ assessmentId, canUseAssistant, onLoad, onSend }) {
  const [conversation, setConversation] = useState(null)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')

  const load = async () => {
    if (!canUseAssistant) return
    setLoading(true)
    setError('')
    try {
      setConversation(await onLoad())
    } catch (err) {
      setError(err.message || 'Could not load assistant')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [assessmentId, canUseAssistant])

  const submit = async (text = message) => {
    const trimmed = text.trim()
    if (!trimmed || sending || !canUseAssistant) return
    setSending(true)
    setError('')
    setMessage('')
    try {
      setConversation(await onSend(trimmed))
    } catch (err) {
      setError(err.message || 'Assistant unavailable')
      setMessage(trimmed)
    } finally {
      setSending(false)
    }
  }

  const messages = conversation?.messages || []

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Bot className="w-5 h-5 text-brand" />
            <h3 className="font-display text-lg font-semibold text-ink">Beauty Assistant</h3>
          </div>
          <p className="text-sm text-ink-muted leading-relaxed max-w-2xl">
            Ask questions about this report. Answers are grounded on the stored cvReport and do not create new measurements.
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 text-[10px] px-2 py-1 rounded-md border bg-brand-50 text-brand border-brand/20 font-semibold">
          <ShieldCheck className="w-3 h-3" />
          Grounded with your data
        </span>
      </div>

      {!canUseAssistant && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
          Beauty Assistant is available after sign in and payment for backend-saved reports.
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </div>
      )}

      <div className="rounded-2xl border border-surface-border bg-surface-warm dark:bg-surface-raised min-h-[360px] p-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 className="w-6 h-6 animate-spin text-brand" />
            <p className="text-sm text-ink-muted">Loading assistant...</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="py-10">
            <div className="text-center mb-6">
              <Bot className="w-10 h-10 text-brand mx-auto mb-3" />
              <p className="font-display text-ink mb-1">Ask your first question</p>
              <p className="text-sm text-ink-muted">Start with one of these report-grounded prompts.</p>
            </div>
            <div className="grid sm:grid-cols-2 gap-2">
              {SUGGESTIONS.map((item) => (
                <button
                  key={item}
                  onClick={() => submit(item)}
                  disabled={!canUseAssistant || sending}
                  className="text-left rounded-xl border border-surface-border bg-white dark:bg-surface-card px-3 py-2 text-xs text-ink-secondary hover:text-brand hover:border-brand/30 transition-colors disabled:opacity-50"
                >
                  {item}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4 max-h-[460px] overflow-y-auto pr-1">
            {messages.map((item, index) => (
              <MessageBubble key={`${item.role}-${index}-${item.createdAt || ''}`} message={item} />
            ))}
          </div>
        )}
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault()
          submit()
        }}
        className="flex gap-2"
      >
        <input
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          disabled={!canUseAssistant || sending}
          placeholder="Ask about your report..."
          className="input-field flex-1"
        />
        <button
          type="submit"
          disabled={!canUseAssistant || sending || !message.trim()}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-brand text-white text-sm font-semibold shadow-brand hover:bg-brand-dark disabled:opacity-50"
        >
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          Send
        </button>
      </form>
    </div>
  )
}
