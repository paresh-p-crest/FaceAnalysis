'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Image, Loader2, Sparkles, X } from 'lucide-react'
import { resolveStylePanelCopy } from '../utils/aiVisualStyleCopy'
import { coercePhotoUrl } from '../utils/assessmentPhotos'

/** Title-case each alphabetic run (Professional/Business, Smart-Casual). */
function titleCaseLabel(value) {
  return String(value || '').replace(/[A-Za-z]+/g, (word) => (
    word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
  ))
}

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

function useImageAspectRatio(src, fallback = 4 / 5) {
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

/** Slightly shorter than natural portrait so hair/outfit/aging frames match and aren't overly tall. */
function aiVisualFrameAspect(ratio) {
  const base = Number(ratio)
  const safe = Number.isFinite(base) && base > 0 ? base : 0.8
  return Math.min(Math.max(safe, 0.78) * 1.08, 0.92)
}

const AI_VISUAL_IMG_FRAME = 'w-full max-w-[22rem] shrink-0'

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
      style={{ aspectRatio: String(aiVisualFrameAspect(aspectRatio)) }}
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

function RegenerateStyleButton({
  styleId,
  show,
  canGenerate,
  loading,
  regeneratingStyleId,
  onGenerateStyle,
  t,
}) {
  if (!show || !styleId || !onGenerateStyle) return null
  const busy = loading || !!regeneratingStyleId
  const thisBusy = regeneratingStyleId === styleId
  return (
    <button
      type="button"
      onClick={() => onGenerateStyle(styleId)}
      disabled={!canGenerate || busy}
      className="report-shell-btn shrink-0 text-xs"
      title={!canGenerate ? t('needsBackend') : t('regenerateStyleTitle')}
    >
      {thisBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
      {t('regenerateStyle')}
    </button>
  )
}

function StyleCompareHero({
  type,
  variants,
  beforeSrc,
  aspectRatio,
  t,
  onOpenImage,
  showGenerate = false,
  canGenerate = false,
  loading = false,
  regeneratingStyleId = null,
  onGenerateStyle = null,
}) {
  const recommendedKey = useMemo(() => {
    const ready = variants.find((v) => coercePhotoUrl(v.imageSrc))
    return variantKey(ready || variants[0] || { type, title: '' })
  }, [variants, type])

  const [selectedKey, setSelectedKey] = useState(recommendedKey)

  useEffect(() => {
    setSelectedKey(recommendedKey)
  }, [recommendedKey])

  const selected = useMemo(() => {
    const found = variants.find((v) => variantKey(v) === selectedKey)
    return found || variants.find((v) => coercePhotoUrl(v.imageSrc)) || variants[0] || null
  }, [variants, selectedKey])

  const selectedAfterSrc = selected ? coercePhotoUrl(selected.imageSrc) : null

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

  const hasCompare = Boolean(beforeSrc && selectedAfterSrc)
  const isQovesChoice = variantKey(selected) === recommendedKey
  const displayTitle = type === 'outfit' ? titleCaseLabel(selected.title) : selected.title
  const attrLabel = (key) => (t.has(`panel.attrs.${key}`) ? t(`panel.attrs.${key}`) : key)
  const attrValue = (raw) => (t.has(`panel.values.${raw}`) ? t(`panel.values.${raw}`) : raw)

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-stretch">
        <div className={`${AI_VISUAL_IMG_FRAME}`}>
          {hasCompare ? (
            <BeforeAfterSlider
              beforeSrc={beforeSrc}
              afterSrc={selectedAfterSrc}
              beforeLabel={t('compareBefore')}
              afterLabel={t('compareAfter')}
              title={displayTitle}
              aspectRatio={aspectRatio}
            />
          ) : (
            <div
              className="flex h-full w-full items-center justify-center rounded-xl border border-surface-border bg-surface-warm px-4 text-center dark:bg-surface-raised"
              style={{ aspectRatio: String(aiVisualFrameAspect(aspectRatio)) }}
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
            <div className="flex items-center gap-2 shrink-0">
              {isQovesChoice ? (
                <span className="rounded-md border border-brand/25 bg-brand-50 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-brand">
                  {t('panel.qovesChoice')}
                </span>
              ) : null}
              <RegenerateStyleButton
                styleId={selected.styleId}
                show={showGenerate}
                canGenerate={canGenerate}
                loading={loading}
                regeneratingStyleId={regeneratingStyleId}
                onGenerateStyle={onGenerateStyle}
                t={t}
              />
            </div>
          </div>
          <h4 className="mb-4 font-sans text-base font-semibold text-ink leading-snug">
            {displayTitle}
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

      <div className={`${AI_VISUAL_IMG_FRAME} space-y-3`}>
        {hasCompare ? (
          <button
            type="button"
            onClick={() => onOpenImage(selectedAfterSrc, displayTitle)}
            className="w-full text-center text-[11px] font-medium text-brand hover:underline"
          >
            {t('openPreviewHint')}
          </button>
        ) : null}

        <div className="flex flex-wrap items-center gap-3" role="listbox" aria-label={t(`sections.${type}`)}>
          {variants.map((variant) => {
            const key = variantKey(variant)
            const selectedThumb = key === variantKey(selected)
            const thumbSrc = coercePhotoUrl(variant.imageSrc)
            const thumbTitle = type === 'outfit' ? titleCaseLabel(variant.title) : variant.title
            return (
              <button
                key={key}
                type="button"
                role="option"
                aria-selected={selectedThumb}
                aria-label={t('panel.selectStyle', { title: thumbTitle })}
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

function parseVisualAge(value) {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null
}

function AgingStackRow({
  imageSrc,
  aspectRatio,
  label,
  ageNumber,
  tag,
  blurb,
  footnote = null,
  previewTitle,
  onOpenImage,
  t,
  regen = null,
}) {
  const frameClass =
    `relative ${AI_VISUAL_IMG_FRAME} overflow-hidden rounded-xl bg-surface-warm dark:bg-surface-raised`

  return (
    <article className="flex w-full flex-col overflow-hidden rounded-2xl border border-surface-border bg-white shadow-soft dark:bg-surface-card sm:flex-row sm:items-stretch">
      {imageSrc ? (
        <button
          type="button"
          onClick={() => onOpenImage(imageSrc, previewTitle)}
          className={`group text-left ${frameClass}`}
          style={{ aspectRatio: String(aiVisualFrameAspect(aspectRatio)) }}
          aria-label={t('openPreview', { title: previewTitle })}
        >
          <img
            src={imageSrc}
            alt={previewTitle}
            className="h-full w-full object-cover object-center transition-transform duration-200 group-hover:scale-[1.02]"
          />
        </button>
      ) : (
        <div
          className={`flex items-center justify-center border border-dashed border-surface-border ${frameClass}`}
          style={{ aspectRatio: String(aiVisualFrameAspect(aspectRatio)) }}
        >
          <p className="px-4 text-center text-xs text-ink-muted">{t('imageUnavailable')}</p>
        </div>
      )}

      <div className="relative flex min-h-[7rem] min-w-0 flex-1 flex-col items-center justify-center gap-1.5 px-5 py-5 text-center sm:min-h-0">
        {regen}
        <p className="text-xs font-medium text-ink-muted">{label}</p>
        {ageNumber != null ? (
          <p className="font-sans text-4xl font-semibold tracking-tight text-ink sm:text-5xl">{ageNumber}</p>
        ) : null}
        {tag ? (
          <p className="text-sm font-semibold text-brand">{tag}</p>
        ) : null}
        {blurb ? (
          <p className="max-w-[16rem] text-xs leading-relaxed text-ink-muted">{blurb}</p>
        ) : null}
        {footnote ? (
          <p className="absolute bottom-2.5 right-3 max-w-[70%] text-right text-[9px] leading-snug text-ink-faint">
            {footnote}
          </p>
        ) : null}
      </div>
    </article>
  )
}

function AgingProgressionGrid({
  beforeSrc,
  variants,
  aspectRatio,
  visualAge = null,
  t,
  onOpenImage,
  showGenerate = false,
  canGenerate = false,
  loading = false,
  regeneratingStyleId = null,
  onGenerateStyle = null,
}) {
  const baseAge = parseVisualAge(visualAge)

  const agedStages = useMemo(() => {
    return (variants || [])
      .map((v) => ({ ...v, years: agingYears(v) }))
      .filter((v) => v.years != null)
      .sort((a, b) => a.years - b.years)
  }, [variants])

  if (!beforeSrc && !agedStages.length) {
    return (
      <div className="rounded-2xl border border-dashed border-surface-border bg-surface-warm dark:bg-surface-raised p-10 text-center">
        <Image className="w-10 h-10 text-brand mx-auto mb-3" />
        <p className="font-sans text-ink mb-1">{t('emptyTitle')}</p>
        <p className="text-sm text-ink-muted">{t('emptyDescription')}</p>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-3">
      {beforeSrc ? (
        <AgingStackRow
          imageSrc={beforeSrc}
          aspectRatio={aspectRatio}
          label={t('ageCurrentBadge')}
          ageNumber={baseAge}
          tag={t('ageCurrentTag')}
          blurb={
            baseAge != null
              ? t('ageCurrentBlurb', { age: baseAge })
              : t('ageCurrentBlurbNoAge')
          }
          previewTitle={t('ageCurrentTitle')}
          onOpenImage={onOpenImage}
          t={t}
        />
      ) : null}

      {agedStages.map((stage) => {
        const styleId = stage.styleId || `aging_${stage.years}`
        const stageSrc = coercePhotoUrl(stage.imageSrc)
        const projectedAge = baseAge != null ? baseAge + stage.years : null
        const label = t('agePlusBadge', { years: stage.years })
        const previewTitle = stage.title || label
        const tagKey =
          stage.years <= 3
            ? 'agePlusTagNear'
            : stage.years <= 5
              ? 'agePlusTagMid'
              : 'agePlusTagFar'
        return (
          <AgingStackRow
            key={styleId}
            imageSrc={stageSrc}
            aspectRatio={aspectRatio}
            label={label}
            ageNumber={projectedAge}
            tag={t(tagKey)}
            blurb={
              projectedAge != null
                ? t('agePlusBlurb', { age: projectedAge, years: stage.years })
                : t('agePlusBlurbNoAge', { years: stage.years })
            }
            footnote={t('ageEducationalNote')}
            previewTitle={previewTitle}
            onOpenImage={onOpenImage}
            t={t}
            regen={(
              <div className="absolute right-3 top-3">
                <RegenerateStyleButton
                  styleId={styleId}
                  show={showGenerate}
                  canGenerate={canGenerate}
                  loading={loading}
                  regeneratingStyleId={regeneratingStyleId}
                  onGenerateStyle={onGenerateStyle}
                  t={t}
                />
              </div>
            )}
          />
        )
      })}
    </div>
  )
}

/**
 * @param {string|null} activeType — when set (hair|outfit|aging), show only that category
 * @param {string|null} beforeSrc — original front portrait URL for hair/aging comparisons
 * @param {string|null} outfitBeforeSrc — white-tee baseline for outfit comparisons (falls back to beforeSrc)
 * @param {number|null} visualAge — CV visual age for aging stack labels
 */
export function AiVisualsSection({
  aiVisuals,
  loading,
  error,
  onGenerate,
  onGenerateStyle = null,
  regeneratingStyleId = null,
  canGenerate,
  activeType = null,
  showGenerate = false,
  beforeSrc = null,
  outfitBeforeSrc = null,
  visualAge = null,
}) {
  const t = useTranslations('AiVisuals')
  const variants = aiVisuals?.variants || []
  const [preview, setPreview] = useState(null)
  const outfitCompareBefore = outfitBeforeSrc || beforeSrc
  const compareBeforeSrc =
    activeType === 'outfit' ? outfitCompareBefore : beforeSrc
  const aspectRatio = useImageAspectRatio(compareBeforeSrc || beforeSrc, 4 / 5)

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

  const styleRegenProps = {
    showGenerate,
    canGenerate,
    loading,
    regeneratingStyleId,
    onGenerateStyle,
  }

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
            {loading && !regeneratingStyleId ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
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
          visualAge={visualAge}
          t={t}
          onOpenImage={openPreview}
          {...styleRegenProps}
        />
      ) : filtered ? (
        filtered.length > 0 ? (
          <StyleCompareHero
            type={activeType}
            variants={filtered}
            beforeSrc={activeType === 'outfit' ? outfitCompareBefore : beforeSrc}
            aspectRatio={aspectRatio}
            t={t}
            onOpenImage={openPreview}
            {...styleRegenProps}
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
              {...styleRegenProps}
            />
          </section>
          <section className="space-y-3">
            <h4 className="font-sans text-sm font-semibold text-ink">{t('sections.outfit')}</h4>
            <StyleCompareHero
              type="outfit"
              variants={outfitVariants}
              beforeSrc={outfitCompareBefore}
              aspectRatio={aspectRatio}
              t={t}
              onOpenImage={openPreview}
              {...styleRegenProps}
            />
          </section>
          <section className="space-y-3">
            <h4 className="font-sans text-sm font-semibold text-ink">{t('sections.aging')}</h4>
            <AgingProgressionGrid
              beforeSrc={beforeSrc}
              variants={agingVariants}
              aspectRatio={aspectRatio}
              visualAge={visualAge}
              t={t}
              onOpenImage={openPreview}
              {...styleRegenProps}
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
