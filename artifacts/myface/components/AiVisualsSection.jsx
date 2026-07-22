'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { ChevronRight, Image, Loader2, Sparkles, X } from 'lucide-react'

const CARD_GRID = 'grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4'

function ImagePreviewModal({ src, title, onClose, closeLabel }) {
  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  if (!src) return null

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 sm:p-8"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute top-4 right-4 report-shell-btn min-w-[36px] px-2.5 z-10"
        aria-label={closeLabel}
      >
        <X className="w-4 h-4" />
      </button>
      <img
        src={src}
        alt={title}
        className="max-h-[85vh] max-w-full w-auto rounded-2xl shadow-elevated object-contain"
        onClick={(event) => event.stopPropagation()}
      />
    </div>
  )
}

function useImageAspectRatio(src, fallback = 3 / 4) {
  const [ratio, setRatio] = useState(fallback)

  useEffect(() => {
    if (!src) {
      setRatio(fallback)
      return undefined
    }
    let cancelled = false
    const img = new window.Image()
    img.onload = () => {
      if (cancelled) return
      if (img.naturalWidth > 0 && img.naturalHeight > 0) {
        setRatio(img.naturalWidth / img.naturalHeight)
      }
    }
    img.onerror = () => {
      if (!cancelled) setRatio(fallback)
    }
    img.src = src
    return () => {
      cancelled = true
    }
  }, [src, fallback])

  return ratio
}

/** Drag slider: left reveals before, right reveals after. `position` = % width showing before. */
function BeforeAfterSlider({ beforeSrc, afterSrc, beforeLabel, afterLabel, title, aspectRatio }) {
  const containerRef = useRef(null)
  const draggingRef = useRef(false)
  const [position, setPosition] = useState(50)

  const setFromClientX = useCallback((clientX) => {
    const el = containerRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    if (rect.width <= 0) return
    const next = ((clientX - rect.left) / rect.width) * 100
    setPosition(Math.min(100, Math.max(0, next)))
  }, [])

  useEffect(() => {
    const onMove = (event) => {
      if (!draggingRef.current) return
      const point = event.touches?.[0] || event
      setFromClientX(point.clientX)
    }
    const onUp = () => {
      draggingRef.current = false
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('touchmove', onMove, { passive: true })
    window.addEventListener('touchend', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('touchmove', onMove)
      window.removeEventListener('touchend', onUp)
    }
  }, [setFromClientX])

  const startDrag = useCallback((event) => {
    draggingRef.current = true
    const point = event.touches?.[0] || event
    setFromClientX(point.clientX)
  }, [setFromClientX])

  if (!beforeSrc || !afterSrc) return null

  return (
    <div
      ref={containerRef}
      className="relative w-full cursor-ew-resize select-none overflow-hidden rounded-xl bg-surface-warm touch-none"
      style={{ aspectRatio: String(aspectRatio || 0.75) }}
      onPointerDown={startDrag}
      onTouchStart={startDrag}
      role="img"
      aria-label={title}
    >
      <img
        src={afterSrc}
        alt={afterLabel}
        className="absolute inset-0 h-full w-full object-cover object-center"
        draggable={false}
      />
      <img
        src={beforeSrc}
        alt={beforeLabel}
        className="absolute inset-0 h-full w-full object-cover object-center"
        style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}
        draggable={false}
      />

      <span className="pointer-events-none absolute left-3 top-3 rounded-md bg-black/45 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-white">
        {beforeLabel}
      </span>
      <span className="pointer-events-none absolute right-3 top-3 rounded-md bg-black/45 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-white">
        {afterLabel}
      </span>

      <div
        className="pointer-events-none absolute inset-y-0 w-0.5 bg-white shadow-sm"
        style={{ left: `${position}%`, transform: 'translateX(-50%)' }}
      >
        <div className="absolute left-1/2 top-1/2 flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white bg-white shadow-md">
          <span className="text-[10px] font-bold tracking-tighter text-ink-muted" aria-hidden>
            ◂ ▸
          </span>
        </div>
      </div>

      <input
        type="range"
        min={0}
        max={100}
        value={position}
        onChange={(event) => setPosition(Number(event.target.value))}
        className="absolute inset-0 z-10 h-full w-full cursor-ew-resize opacity-0"
        aria-label={title}
      />
    </div>
  )
}

function CompareVariantCard({ variant, beforeSrc, aspectRatio, t, onOpenImage }) {
  const typeCopyKey = `types.${variant.type}`
  const hasImage = Boolean(variant.imageSrc) && Boolean(beforeSrc)

  return (
    <article className="flex h-full flex-col overflow-hidden rounded-2xl border border-surface-border bg-white dark:bg-surface-card shadow-soft max-w-sm w-full">
      {hasImage ? (
        <div className="border-b border-surface-border p-2">
          <BeforeAfterSlider
            beforeSrc={beforeSrc}
            afterSrc={variant.imageSrc}
            beforeLabel={t('compareBefore')}
            afterLabel={t('compareAfter')}
            title={variant.title}
            aspectRatio={aspectRatio}
          />
          <button
            type="button"
            onClick={() => onOpenImage(variant.imageSrc, variant.title)}
            className="mt-2 w-full text-center text-[11px] font-medium text-brand hover:underline"
          >
            {t('openPreviewHint')}
          </button>
        </div>
      ) : (
        <div
          className="flex w-full items-center justify-center border-b border-surface-border bg-surface-warm px-4 text-center dark:bg-surface-raised"
          style={{ aspectRatio: String(aspectRatio || 0.75) }}
        >
          <div>
            <Image className="mx-auto mb-2 h-7 w-7 text-brand" />
            <p className="font-sans text-sm font-semibold text-ink mb-1">
              {variant.status === 'blocked' ? t('generationBlocked') : t('promptReady')}
            </p>
            <p className="text-xs text-ink-muted leading-relaxed line-clamp-2">
              {variant.error || (!beforeSrc ? t('beforeUnavailable') : t('imageUnavailable'))}
            </p>
          </div>
        </div>
      )}

      <div className="flex flex-1 flex-col p-3">
        <div className="mb-1.5 flex items-start justify-between gap-2">
          <p className="font-sans text-sm font-semibold text-ink line-clamp-2">
            {variant.title}
          </p>
          <span
            className={`shrink-0 text-[10px] px-2 py-0.5 rounded-full border font-semibold uppercase tracking-wide ${
              hasImage
                ? 'bg-brand-50 text-brand border-brand/20'
                : 'bg-surface-warm text-ink-muted border-surface-border'
            }`}
          >
            {variant.status}
          </span>
        </div>
        <p className="text-xs text-ink-muted leading-relaxed mb-2 line-clamp-2">
          {t.has(typeCopyKey) ? t(typeCopyKey) : t('types.default')}
        </p>
        <details className="mt-auto text-[11px] text-ink-muted">
          <summary className="cursor-pointer font-semibold text-brand">{t('viewPrompt')}</summary>
          <p className="mt-2 leading-relaxed">{variant.prompt}</p>
        </details>
      </div>
    </article>
  )
}

function agingYears(variant) {
  if (typeof variant?.years === 'number') return variant.years
  const fromId = String(variant?.styleId || '').match(/aging_(\d+)/i)
  if (fromId) return Number(fromId[1])
  const fromTitle = String(variant?.title || '').match(/\+(\d+)/)
  if (fromTitle) return Number(fromTitle[1])
  return null
}

const AGE_THEMES = [
  { badge: 'bg-slate-100 text-slate-700', meta: 'text-slate-500' },
  { badge: 'bg-sky-100 text-sky-700', meta: 'text-sky-600' },
  { badge: 'bg-brand-100 text-brand', meta: 'text-brand' },
  { badge: 'bg-emerald-100 text-emerald-700', meta: 'text-emerald-600' },
]

function AgingProgressionGrid({ beforeSrc, variants, aspectRatio, t, onOpenImage }) {
  const stages = useMemo(() => {
    const withYears = (variants || [])
      .map((v) => ({ ...v, years: agingYears(v) }))
      .filter((v) => v.imageSrc && v.years != null)
      .sort((a, b) => a.years - b.years)

    const list = []
    if (beforeSrc) {
      list.push({
        key: 'current',
        badge: t('ageCurrentBadge'),
        meta: t('ageCurrentMeta'),
        imageSrc: beforeSrc,
        title: t('ageCurrentTitle'),
      })
    }
    withYears.forEach((v) => {
      list.push({
        key: v.styleId || `aging_${v.years}`,
        badge: t('agePlusBadge', { years: v.years }),
        meta: t('agePlusMeta', { years: v.years }),
        imageSrc: v.imageSrc,
        title: v.title || t('agePlusBadge', { years: v.years }),
      })
    })
    return list
  }, [beforeSrc, variants, t])

  if (!stages.length) {
    return (
      <div className="rounded-2xl border border-dashed border-surface-border bg-surface-warm dark:bg-surface-raised p-10 text-center">
        <Image className="w-10 h-10 text-brand mx-auto mb-3" />
        <p className="font-sans text-ink mb-1">{t('emptyTitle')}</p>
        <p className="text-sm text-ink-muted">{t('emptyDescription')}</p>
      </div>
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-y-6">
      {stages.map((stage, index) => {
        const theme = AGE_THEMES[index % AGE_THEMES.length]
        return (
          <div key={stage.key} className="flex items-center">
            <article className="flex w-full max-w-sm flex-col overflow-hidden rounded-2xl border border-surface-border bg-white shadow-soft dark:bg-surface-card">
              <div className="flex items-center justify-between gap-2 px-3.5 pt-3.5">
                <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${theme.badge}`}>
                  {stage.badge}
                </span>
                <span className={`truncate text-[11px] font-medium ${theme.meta}`}>{stage.meta}</span>
              </div>
              <button
                type="button"
                onClick={() => onOpenImage(stage.imageSrc, stage.title)}
                className="group relative mx-2 mb-2 mt-2 w-[calc(100%-1rem)] overflow-hidden rounded-xl bg-surface-warm text-left"
                style={{ aspectRatio: String(aspectRatio || 0.75) }}
                aria-label={t('openPreview', { title: stage.title })}
              >
                <img
                  src={stage.imageSrc}
                  alt={stage.title}
                  className="h-full w-full object-cover object-center transition-transform duration-200 group-hover:scale-[1.02]"
                />
              </button>
            </article>
            {index < stages.length - 1 ? (
              <div className="mx-3 flex shrink-0 items-center self-center sm:mx-5" aria-hidden>
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand/15 text-brand">
                  <ChevronRight className="h-4 w-4" strokeWidth={2.5} />
                </span>
              </div>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}

/**
 * @param {string|null} activeType — when set (hair|outfit|aging), show only that category
 * @param {string|null} beforeSrc — original before/front photo for comparisons
 */
export function AiVisualsSection({
  aiVisuals,
  loading,
  error,
  onGenerate,
  canGenerate,
  activeType = null,
  showGenerate = false,
  beforeSrc = null,
}) {
  const t = useTranslations('AiVisuals')
  const variants = aiVisuals?.variants || []
  const [preview, setPreview] = useState(null)
  const aspectRatio = useImageAspectRatio(beforeSrc, 3 / 4)

  const hairVariants = variants.filter((v) => v.type === 'hair')
  const outfitVariants = variants.filter((v) => v.type === 'outfit')
  const agingVariants = variants.filter((v) => v.type === 'aging')

  const openPreview = useCallback((src, title) => {
    setPreview({ src, title })
  }, [])

  const closePreview = useCallback(() => setPreview(null), [])

  const sectionTitle = activeType ? t(`sections.${activeType}`) : t('title')
  const filtered =
    activeType === 'hair'
      ? hairVariants
      : activeType === 'outfit'
        ? outfitVariants
        : activeType === 'aging'
          ? agingVariants
          : null

  return (
    <div className={activeType ? 'space-y-4' : 'space-y-6'}>
      <div className={`flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 ${activeType ? 'sm:items-center' : 'gap-4'}`}>
        <div>
          <div className={`flex items-center gap-2 ${activeType ? 'mb-1' : 'mb-2'}`}>
            <Sparkles className={`${activeType ? 'w-4 h-4' : 'w-5 h-5'} text-brand`} />
            <h3 className={`font-sans font-semibold text-ink ${activeType ? 'text-base' : 'text-lg'}`}>{sectionTitle}</h3>
          </div>
          {!activeType && (
            <p className="text-sm text-ink-muted leading-relaxed max-w-2xl">{t('description')}</p>
          )}
          {activeType && t.has(`types.${activeType}`) && (
            <p className="text-xs text-ink-muted leading-relaxed max-w-2xl line-clamp-2">{t(`types.${activeType}`)}</p>
          )}
        </div>
        {showGenerate && (
          <button
            type="button"
            onClick={onGenerate}
            disabled={!canGenerate || loading}
            className="report-shell-btn-primary shrink-0"
            title={!canGenerate ? t('needsBackend') : t('generateTitle')}
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {variants.length ? t('regenerate') : t('generate')}
          </button>
        )}
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </div>
      )}

      {variants.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-surface-border bg-surface-warm dark:bg-surface-raised p-10 text-center">
          <Image className="w-10 h-10 text-brand mx-auto mb-3" />
          <p className="font-sans text-ink mb-1">{t('emptyTitle')}</p>
          <p className="text-sm text-ink-muted">{t('emptyDescription')}</p>
        </div>
      ) : activeType === 'aging' ? (
        <AgingProgressionGrid
          beforeSrc={beforeSrc}
          variants={agingVariants}
          aspectRatio={aspectRatio}
          t={t}
          onOpenImage={openPreview}
        />
      ) : filtered ? (
        filtered.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 justify-items-start sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map((variant) => (
              <CompareVariantCard
                key={`${variant.type}:${variant.styleId || variant.title}`}
                variant={variant}
                beforeSrc={beforeSrc}
                aspectRatio={aspectRatio}
                t={t}
                onOpenImage={openPreview}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-surface-border bg-surface-warm dark:bg-surface-raised p-10 text-center">
            <Image className="w-10 h-10 text-brand mx-auto mb-3" />
            <p className="font-sans text-ink mb-1">{t('emptyTitle')}</p>
            <p className="text-sm text-ink-muted">{t('emptyDescription')}</p>
          </div>
        )
      ) : (
        <div className="space-y-8">
          <section className="space-y-3">
            <h4 className="font-sans text-sm font-semibold text-ink">{t('sections.hair')}</h4>
            <div className={CARD_GRID}>
              {hairVariants.map((variant) => (
                <CompareVariantCard
                  key={`${variant.type}:${variant.styleId || variant.title}`}
                  variant={variant}
                  beforeSrc={beforeSrc}
                  aspectRatio={aspectRatio}
                  t={t}
                  onOpenImage={openPreview}
                />
              ))}
            </div>
          </section>
          <section className="space-y-3">
            <h4 className="font-sans text-sm font-semibold text-ink">{t('sections.outfit')}</h4>
            <div className={CARD_GRID}>
              {outfitVariants.map((variant) => (
                <CompareVariantCard
                  key={`${variant.type}:${variant.styleId || variant.title}`}
                  variant={variant}
                  beforeSrc={beforeSrc}
                  aspectRatio={aspectRatio}
                  t={t}
                  onOpenImage={openPreview}
                />
              ))}
            </div>
          </section>
          <section className="space-y-3">
            <h4 className="font-sans text-sm font-semibold text-ink">{t('sections.aging')}</h4>
            <AgingProgressionGrid
              beforeSrc={beforeSrc}
              variants={agingVariants}
              aspectRatio={aspectRatio}
              t={t}
              onOpenImage={openPreview}
            />
          </section>
        </div>
      )}

      <ImagePreviewModal
        src={preview?.src}
        title={preview?.title}
        onClose={closePreview}
        closeLabel={t('closePreview')}
      />
    </div>
  )
}
