'use client'

import { useTranslations } from 'next-intl'
import { Image, Loader2, Sparkles } from 'lucide-react'

function VariantCard({ variant, t }) {
  const typeCopyKey = `types.${variant.type}`
  return (
    <div className="rounded-2xl border border-surface-border bg-surface-warm dark:bg-surface-raised overflow-hidden">
      <div className="aspect-square bg-white dark:bg-surface-card flex items-center justify-center border-b border-surface-border">
        {variant.imageSrc ? (
          <img src={variant.imageSrc} alt={variant.title} className="w-full h-full object-cover" />
        ) : (
          <div className="text-center px-5">
            <Image className="w-8 h-8 text-brand mx-auto mb-3" />
            <p className="text-sm font-display font-semibold text-ink mb-1">
              {variant.status === 'blocked' ? t('generationBlocked') : t('promptReady')}
            </p>
            <p className="text-xs text-ink-muted leading-relaxed">
              {variant.error || t('imageUnavailable')}
            </p>
          </div>
        )}
      </div>
      <div className="p-4">
        <div className="flex items-center justify-between gap-3 mb-2">
          <p className="text-sm font-display font-semibold text-ink">{variant.title}</p>
          <span className={`text-[10px] px-2 py-0.5 rounded-md border font-semibold ${
            variant.imageSrc
              ? 'bg-brand-50 text-brand border-brand/20'
              : 'bg-white dark:bg-surface-card text-ink-muted border-surface-border'
          }`}>
            {variant.status}
          </span>
        </div>
        <p className="text-xs text-ink-muted leading-relaxed mb-3">
          {t.has(typeCopyKey) ? t(typeCopyKey) : t('types.default')}
        </p>
        <details className="text-[11px] text-ink-muted">
          <summary className="cursor-pointer text-brand font-semibold">{t('viewPrompt')}</summary>
          <p className="mt-2 leading-relaxed">{variant.prompt}</p>
        </details>
      </div>
    </div>
  )
}

export function AiVisualsSection({ aiVisuals, loading, error, onGenerate, canGenerate }) {
  const t = useTranslations('AiVisuals')
  const variants = aiVisuals?.variants || []

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-5 h-5 text-brand" />
            <h3 className="font-display text-lg font-semibold text-ink">{t('title')}</h3>
          </div>
          <p className="text-sm text-ink-muted leading-relaxed max-w-2xl">
            {t('description')}
          </p>
        </div>
        <button
          type="button"
          onClick={onGenerate}
          disabled={!canGenerate || loading}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-brand text-white hover:bg-brand-dark shadow-brand transition-colors disabled:opacity-50 disabled:pointer-events-none"
          title={!canGenerate ? t('needsBackend') : t('generateTitle')}
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          {variants.length ? t('regenerate') : t('generate')}
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </div>
      )}

      {variants.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-surface-border bg-surface-warm dark:bg-surface-raised p-10 text-center">
          <Image className="w-10 h-10 text-brand mx-auto mb-3" />
          <p className="font-display text-ink mb-1">{t('emptyTitle')}</p>
          <p className="text-sm text-ink-muted">{t('emptyDescription')}</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-3 gap-4">
          {variants.map((variant) => (
            <VariantCard key={variant.type} variant={variant} t={t} />
          ))}
        </div>
      )}
    </div>
  )
}
