'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { ChevronRight, Image, Loader2, Sparkles, X } from 'lucide-react'
import { resolveStylePanelCopy } from '../utils/aiVisualStyleCopy'

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

function variantKey(variant) {
  return `${variant.type}:${variant.styleId || variant.title}`
}

function StyleCompareHero({ type, variants, beforeSrc, aspectRatio, t, onOpenImage }) {
  const recommendedKey = useMemo(() => {
    const ready = variants.find((v) => v.imageSrc)
    return variantKey(ready || variants[0] || { type, title: '' })
  }, [variants, type])

  const [selectedKey, setSelectedKey] = useState(recommendedKey)

  useEffect(() => {
    setSelectedKey(recommendedKey)
  }, [recommendedKey])

  const selected = useMemo(() => {
    const found = variants.find((v) => variantKey(v) === selectedKey)
    return found || variants.find((v) => v.imageSrc) || variants[0] || null
  }, [variants, selectedKey])

  const panel = useMemo(
    () => (selected ? resolveStylePanelCopy(type, selected) : null),
    [type, selected],
  )

  if (!variants.length || !selected) {
    return (
      <div className="rounded-2xl border border-dashed border-surface-border bg-surface-warm dark:bg-surface-raised p-10 text-center">
        <Image className="w-10 h-10 text-brand mx-auto mb-3" />
        <p className="font-sans text-ink mb-1">{t('emptyTitle')}</p>
        <p className="text-sm text-ink-muted">{t('emptyDescription')}</p>
      </div>
    )
  }

  const hasCompare = Boolean(beforeSrc && selected.imageSrc)
  const isQovesChoice = variantKey(selected) === recommendedKey
  const attrLabel = (key) => (t.has(`panel.attrs.${key}`) ? t(`panel.attrs.${key}`) : key)
  const attrValue = (raw) => (t.has(`panel.values.${raw}`) ? t(`panel.values.${raw}`) : raw)

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-stretch">
        <div className="w-full max-w-sm shrink-0">
          {hasCompare ? (
            <BeforeAfterSlider
              beforeSrc={beforeSrc}
              afterSrc={selected.imageSrc}
              beforeLabel={t('compareBefore')}
              afterLabel={t('compareAfter')}
              title={selected.title}
              aspectRatio={aspectRatio}
            />
          ) : (
            <div
              className="flex h-full w-full items-center justify-center rounded-xl border border-surface-border bg-surface-warm px-4 text-center dark:bg-surface-raised"
              style={{ aspectRatio: String(aspectRatio || 0.75) }}
            >
              <div>
                <Image className="mx-auto mb-2 h-7 w-7 text-brand" />
                <p className="font-sans text-sm font-semibold text-ink mb-1">
                  {selected.status === 'blocked' ? t('generationBlocked') : t('promptReady')}
                </p>
                <p className="text-xs text-ink-muted leading-relaxed">
                  {selected.error || (!beforeSrc ? t('beforeUnavailable') : t('imageUnavailable'))}
                </p>
              </div>
            </div>
          )}
        </div>

        <aside className="flex min-w-0 w-full flex-1 flex-col rounded-2xl border border-surface-border bg-white p-4 shadow-soft dark:bg-surface-card sm:p-5">
          <div className="mb-3 flex items-start justify-between gap-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted">
              {t('panel.recommended')}
            </p>
            {isQovesChoice ? (
              <span className="shrink-0 rounded-md border border-brand/25 bg-brand-50 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-brand">
                {t('panel.qovesChoice')}
              </span>
            ) : null}
          </div>
          <h4 className="mb-4 font-sans text-base font-semibold text-ink leading-snug">
            {selected.title}
          </h4>

          {panel ? (
            <div className="flex min-h-0 flex-1 flex-col gap-4">
              <div className="grid grid-cols-2 gap-2">
                {panel.attrKeys.map((key) => (
                  <div
                    key={key}
                    className="rounded-xl border border-surface-border bg-surface-warm/60 px-3 py-2.5 dark:bg-surface-raised"
                  >
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted">
                      {attrLabel(key)}
                    </p>
                    <p className="mt-1 font-sans text-sm font-semibold text-ink">
                      {attrValue(panel.attrs[key])}
                    </p>
                  </div>
                ))}
              </div>
              <div className="mt-auto">
                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-ink-muted">
                  {t('panel.explanation')}
                </p>
                <p className="text-sm leading-relaxed text-ink-muted">{panel.explanation}</p>
              </div>
            </div>
          ) : null}
        </aside>
      </div>

      <div className="w-full max-w-sm space-y-3">
        {hasCompare ? (
          <button
            type="button"
            onClick={() => onOpenImage(selected.imageSrc, selected.title)}
            className="w-full text-center text-[11px] font-medium text-brand hover:underline"
          >
            {t('openPreviewHint')}
          </button>
        ) : null}

        <div className="flex flex-wrap items-center gap-3" role="listbox" aria-label={t(`sections.${type}`)}>
          {variants.map((variant) => {
            const key = variantKey(variant)
            const selectedThumb = key === variantKey(selected)
            const thumbSrc = variant.imageSrc
            return (
              <button
                key={key}
                type="button"
                role="option"
                aria-selected={selectedThumb}
                aria-label={t('panel.selectStyle', { title: variant.title })}
                disabled={!thumbSrc}
                onClick={() => thumbSrc && setSelectedKey(key)}
                className={`relative h-14 w-14 shrink-0 overflow-hidden rounded-full border-2 transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 disabled:cursor-not-allowed disabled:opacity-40 ${
                  selectedThumb
                    ? 'border-brand ring-2 ring-brand/35'
                    : 'border-surface-border hover:border-brand/50'
                }`}
              >
                {thumbSrc ? (
                  <img src={thumbSrc} alt="" className="h-full w-full object-cover object-center" />
                ) : (
                  <span className="flex h-full w-full items-center justify-center bg-surface-warm text-[10px] text-ink-muted">
                    —
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>
    </div>
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

function AgingProgressionGrid({ beforeSrc, variants, aspectRatio, t, onOpenImage }) {
  const agedStages = useMemo(() => {
    return (variants || [])
      .map((v) => ({ ...v, years: agingYears(v) }))
      .filter((v) => v.years != null)
      .sort((a, b) => a.years - b.years)
  }, [variants])

  const defaultKey = useMemo(() => {
    const ready = agedStages.find((v) => v.imageSrc)
    return ready ? (ready.styleId || `aging_${ready.years}`) : agedStages[0]
      ? (agedStages[0].styleId || `aging_${agedStages[0].years}`)
      : null
  }, [agedStages])

  const [selectedKey, setSelectedKey] = useState(defaultKey)

  useEffect(() => {
    setSelectedKey(defaultKey)
  }, [defaultKey])

  const selected = useMemo(() => {
    const found = agedStages.find((v) => (v.styleId || `aging_${v.years}`) === selectedKey)
    return found || agedStages.find((v) => v.imageSrc) || agedStages[0] || null
  }, [agedStages, selectedKey])

  if (!beforeSrc && !agedStages.length) {
    return (
      <div className="rounded-2xl border border-dashed border-surface-border bg-surface-warm dark:bg-surface-raised p-10 text-center">
        <Image className="w-10 h-10 text-brand mx-auto mb-3" />
        <p className="font-sans text-ink mb-1">{t('emptyTitle')}</p>
        <p className="text-sm text-ink-muted">{t('emptyDescription')}</p>
      </div>
    )
  }

  const afterTitle = selected
    ? selected.title || t('agePlusBadge', { years: selected.years })
    : t('sections.aging')

  return (
    <div className="flex justify-center">
      <div
        className={`inline-grid items-start justify-items-center gap-x-3 gap-y-3 sm:gap-x-5 ${
          beforeSrc && selected
            ? 'grid-cols-[minmax(0,24rem)_auto_minmax(0,24rem)]'
            : 'grid-cols-1'
        }`}
      >
        {beforeSrc ? (
          <article className="col-start-1 row-start-1 flex w-full max-w-sm flex-col overflow-hidden rounded-2xl border border-surface-border bg-white shadow-soft dark:bg-surface-card">
            <div className="flex items-center justify-between gap-2 px-3.5 pt-3.5">
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-700">
                {t('ageCurrentBadge')}
              </span>
              <span className="truncate text-[11px] font-medium text-slate-500">{t('ageCurrentMeta')}</span>
            </div>
            <button
              type="button"
              onClick={() => onOpenImage(beforeSrc, t('ageCurrentTitle'))}
              className="group relative mx-2 mb-2 mt-2 w-[calc(100%-1rem)] overflow-hidden rounded-xl bg-surface-warm text-left"
              style={{ aspectRatio: String(aspectRatio || 0.75) }}
              aria-label={t('openPreview', { title: t('ageCurrentTitle') })}
            >
              <img
                src={beforeSrc}
                alt={t('ageCurrentTitle')}
                className="h-full w-full object-cover object-center transition-transform duration-200 group-hover:scale-[1.02]"
              />
            </button>
          </article>
        ) : null}

        {beforeSrc && selected ? (
          <div className="col-start-2 row-start-1 flex items-center self-center" aria-hidden>
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand/15 text-brand">
              <ChevronRight className="h-4 w-4" strokeWidth={2.5} />
            </span>
          </div>
        ) : null}

        {selected ? (
          <article className={`${beforeSrc ? 'col-start-3' : 'col-start-1'} row-start-1 flex w-full max-w-sm flex-col overflow-hidden rounded-2xl border border-surface-border bg-white shadow-soft dark:bg-surface-card`}>
            <div className="flex items-center justify-between gap-2 px-3.5 pt-3.5">
              <span className="rounded-full bg-sky-100 px-2.5 py-1 text-[11px] font-semibold text-sky-700">
                {t('agePlusBadge', { years: selected.years })}
              </span>
              <span className="truncate text-[11px] font-medium text-sky-600">
                {t('agePlusMeta', { years: selected.years })}
              </span>
            </div>
            {selected.imageSrc ? (
              <button
                type="button"
                onClick={() => onOpenImage(selected.imageSrc, afterTitle)}
                className="group relative mx-2 mb-2 mt-2 w-[calc(100%-1rem)] overflow-hidden rounded-xl bg-surface-warm text-left"
                style={{ aspectRatio: String(aspectRatio || 0.75) }}
                aria-label={t('openPreview', { title: afterTitle })}
              >
                <img
                  src={selected.imageSrc}
                  alt={afterTitle}
                  className="h-full w-full object-cover object-center transition-transform duration-200 group-hover:scale-[1.02]"
                />
              </button>
            ) : (
              <div
                className="mx-2 mb-2 mt-2 flex w-[calc(100%-1rem)] items-center justify-center rounded-xl bg-surface-warm px-4 text-center"
                style={{ aspectRatio: String(aspectRatio || 0.75) }}
              >
                <p className="text-xs text-ink-muted">{t('imageUnavailable')}</p>
              </div>
            )}
          </article>
        ) : null}

        {selected ? (
          <div
            className={`${beforeSrc ? 'col-start-3' : 'col-start-1'} row-start-2 flex w-full max-w-sm flex-wrap items-center justify-center gap-3 px-1`}
            role="listbox"
            aria-label={t('sections.aging')}
          >
            {agedStages.map((stage) => {
              const key = stage.styleId || `aging_${stage.years}`
              const isSelected = key === (selected.styleId || `aging_${selected.years}`)
              const label = t('agePlusMeta', { years: stage.years })
              return (
                <button
                  key={key}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  aria-label={t('agePlusBadge', { years: stage.years })}
                  disabled={!stage.imageSrc}
                  onClick={() => stage.imageSrc && setSelectedKey(key)}
                  className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full border-2 text-xs font-semibold transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 disabled:cursor-not-allowed disabled:opacity-40 ${
                    isSelected
                      ? 'border-brand bg-brand-50 text-brand ring-2 ring-brand/35'
                      : 'border-surface-border bg-white text-ink-muted hover:border-brand/50 dark:bg-surface-card'
                  }`}
                >
                  {label}
                </button>
              )
            })}
          </div>
        ) : null}
      </div>
    </div>
  )
}

/**
 * @param {string|null} activeType — when set (hair|outfit|aging), show only that category
 * @param {string|null} beforeSrc — original front portrait URL for comparisons
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
          <StyleCompareHero
            type={activeType}
            variants={filtered}
            beforeSrc={beforeSrc}
            aspectRatio={aspectRatio}
            t={t}
            onOpenImage={openPreview}
          />
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
            <StyleCompareHero
              type="hair"
              variants={hairVariants}
              beforeSrc={beforeSrc}
              aspectRatio={aspectRatio}
              t={t}
              onOpenImage={openPreview}
            />
          </section>
          <section className="space-y-3">
            <h4 className="font-sans text-sm font-semibold text-ink">{t('sections.outfit')}</h4>
            <StyleCompareHero
              type="outfit"
              variants={outfitVariants}
              beforeSrc={beforeSrc}
              aspectRatio={aspectRatio}
              t={t}
              onOpenImage={openPreview}
            />
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
