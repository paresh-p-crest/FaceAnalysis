'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLocale, useTranslations } from 'next-intl'
import { Image, CircleHelp, Loader2, Sparkles, X } from 'lucide-react'
import { resolveStyleDisplayCopy, resolveStylePanelCopy } from '../utils/aiVisualStyleCopy'
import { coercePhotoUrl } from '../utils/assessmentPhotos'

function ImagePreviewModal({ src, title, onClose, closeLabel }) {
  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  if (!src || typeof document === 'undefined') return null

  return createPortal(
    <div
      className="fixed inset-0 z-[220] flex items-center justify-center p-6 sm:p-10"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
    >
      <div
        className="relative inline-block max-h-full max-w-full"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-0 left-full ml-1.5 report-shell-btn min-w-[36px] px-2.5 z-20"
          aria-label={closeLabel}
        >
          <X className="w-4 h-4" />
        </button>
        <img
          src={src}
          alt={title}
          className="block max-h-[calc(100dvh-5rem)] max-w-[calc(100vw-5.5rem)] w-auto rounded-2xl shadow-elevated object-contain"
        />
      </div>
    </div>,
    document.body,
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

function StyleAboutTooltip({ type, t }) {
  const tooltipId = `ai-visual-about-${type}`
  return (
    <span className="group/about relative inline-flex shrink-0">
      <button
        type="button"
        className="inline-flex items-center gap-1.5 text-sm text-[#758084] transition-colors hover:text-ink-muted"
        aria-describedby={tooltipId}
      >
        <span>{t(`about.${type}.link`)}</span>
        <CircleHelp className="h-3 w-3 shrink-0" strokeWidth={1.5} aria-hidden />
      </button>
      <div
        id={tooltipId}
        role="tooltip"
        className="pointer-events-none invisible absolute right-0 top-full z-30 mt-2 w-[min(calc(100vw-2rem),20rem)] rounded-xl bg-[#4a4f52] px-4 py-3 text-left opacity-0 shadow-xl transition-opacity duration-150 group-hover/about:visible group-hover/about:opacity-100 group-focus-within/about:visible group-focus-within/about:opacity-100 sm:w-80"
      >
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-white/50">
          {t(`about.${type}.tooltipTitle`)}
        </p>
        <p className="mb-2 text-sm font-bold leading-snug text-white">
          {t(`about.${type}.tooltipP1`)}
        </p>
        <p className="text-sm font-bold leading-snug text-white">
          {t(`about.${type}.tooltipP2`)}
        </p>
      </div>
    </span>
  )
}

function StyleSectionHeader({ type, t }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0 flex-1">
        <h3 className="font-sans text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
          {t(`headers.${type}.titleLead`)}{' '}
          <strong className="font-semibold">{t(`headers.${type}.titleAccent`)}</strong>
        </h3>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-muted">
          {t.rich(`headers.${type}.subtitle`, {
            emph: (chunks) => <strong className="font-semibold text-ink-muted">{chunks}</strong>,
          })}
        </p>
      </div>
      <StyleAboutTooltip type={type} t={t} />
    </div>
  )
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

function StylePanelAside({
  type,
  variant,
  t,
  showGenerate,
  canGenerate,
  loading,
  regeneratingStyleId,
  onGenerateStyle,
  className = '',
}) {
  const locale = useLocale()
  const panel = resolveStylePanelCopy(type, variant)
  const { title: displayTitle, explanation } = resolveStyleDisplayCopy(type, variant, t, locale)
  const attrLabel = (key) => (t.has(`panel.attrs.${key}`) ? t(`panel.attrs.${key}`) : key)
  const attrValue = (raw) => (t.has(`panel.values.${raw}`) ? t(`panel.values.${raw}`) : raw)

  return (
    <aside
      className={`flex min-h-full min-w-0 flex-col justify-between self-stretch rounded-2xl border border-surface-border bg-[#f4f6f7] px-4 py-4 sm:px-5 sm:py-5 dark:bg-surface-raised ${className}`.trim()}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h4 className="font-sans text-lg font-semibold text-ink leading-snug">
          {displayTitle}
        </h4>
        <div className="flex items-center gap-2 shrink-0">
          <RegenerateStyleButton
            styleId={variant.styleId}
            show={showGenerate}
            canGenerate={canGenerate}
            loading={loading}
            regeneratingStyleId={regeneratingStyleId}
            onGenerateStyle={onGenerateStyle}
            t={t}
          />
        </div>
      </div>

      {panel ? (
        <>
          <div className="grid grid-cols-2 gap-2">
            {panel.attrKeys.map((key) => (
              <div
                key={key}
                className="rounded-xl border border-surface-border bg-white px-3 py-2.5 shadow-sm dark:bg-surface-card"
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
          <div>
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-ink-muted">
              {t('panel.explanation')}
            </p>
            <p className="text-sm leading-relaxed text-ink-muted">{explanation}</p>
          </div>
        </>
      ) : null}
    </aside>
  )
}

function StyleUnavailableFrame({ aspectRatio, status, error, needBefore, t }) {
  return (
    <div
      className="flex h-full w-full items-center justify-center rounded-xl border border-surface-border bg-surface-warm px-4 text-center dark:bg-surface-raised"
      style={{ aspectRatio: String(aiVisualFrameAspect(aspectRatio)) }}
    >
      <div>
        <Image className="mx-auto mb-2 h-7 w-7 text-brand" />
        <p className="font-sans text-sm font-semibold text-ink mb-1">
          {status === 'blocked' ? t('generationBlocked') : t('promptReady')}
        </p>
        <p className="text-xs text-ink-muted leading-relaxed">
          {error || (needBefore ? t('beforeUnavailable') : t('imageUnavailable'))}
        </p>
      </div>
    </div>
  )
}

/** report-style stacked suggestion rows. Hair: before/after slider. Outfit: after only. */
function StyleSuggestionList({
  type,
  variants,
  beforeSrc = null,
  aspectRatio,
  t,
  onOpenImage,
  showGenerate = false,
  canGenerate = false,
  loading = false,
  regeneratingStyleId = null,
  onGenerateStyle = null,
}) {
  const locale = useLocale()
  if (!variants.length) {
    return (
      <div className="rounded-2xl border border-dashed border-surface-border bg-surface-warm dark:bg-surface-raised p-10 text-center">
        <Image className="w-10 h-10 text-brand mx-auto mb-3" />
        <p className="font-sans text-ink mb-1">{t('emptyTitle')}</p>
        <p className="text-sm text-ink-muted">{t('emptyDescription')}</p>
      </div>
    )
  }

  const useCompare = type === 'hair'

  return (
    <div className="space-y-8">
      {variants.map((variant) => {
        const afterSrc = coercePhotoUrl(variant.imageSrc)
        const { title: displayTitle } = resolveStyleDisplayCopy(type, variant, t, locale)
        const hasCompare = Boolean(useCompare && beforeSrc && afterSrc)
        const hasAfterOnly = Boolean(!useCompare && afterSrc)

        return (
          <article
            key={variantKey(variant)}
            className="grid grid-cols-1 gap-5 sm:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] sm:items-stretch sm:gap-x-4 sm:gap-y-2"
          >
            <div className={`${AI_VISUAL_IMG_FRAME} order-1 min-w-0 sm:col-start-1 sm:row-start-1`}>
              {hasCompare ? (
                <BeforeAfterSlider
                  beforeSrc={beforeSrc}
                  afterSrc={afterSrc}
                  beforeLabel={t('compareBefore')}
                  afterLabel={t('compareAfter')}
                  title={displayTitle}
                  aspectRatio={aspectRatio}
                />
              ) : hasAfterOnly ? (
                <button
                  type="button"
                  onClick={() => onOpenImage(afterSrc, displayTitle)}
                  className="group block w-full overflow-hidden rounded-xl bg-surface-warm text-left dark:bg-surface-raised"
                  style={{ aspectRatio: String(aiVisualFrameAspect(aspectRatio)) }}
                  aria-label={t('openPreview', { title: displayTitle })}
                >
                  <img
                    src={afterSrc}
                    alt={displayTitle}
                    className="h-full w-full object-cover object-center transition-transform duration-200 group-hover:scale-[1.02]"
                  />
                </button>
              ) : (
                <StyleUnavailableFrame
                  aspectRatio={aspectRatio}
                  status={variant.status}
                  error={variant.error}
                  needBefore={useCompare && !beforeSrc}
                  t={t}
                />
              )}
            </div>

            <StylePanelAside
              type={type}
              variant={variant}
              t={t}
              showGenerate={showGenerate}
              canGenerate={canGenerate}
              loading={loading}
              regeneratingStyleId={regeneratingStyleId}
              onGenerateStyle={onGenerateStyle}
              className="order-3 sm:order-2 sm:col-start-2 sm:row-start-1"
            />

            {hasCompare ? (
              <button
                type="button"
                onClick={() => onOpenImage(afterSrc, displayTitle)}
                className="order-2 w-full text-center text-[11px] font-medium text-brand hover:underline sm:order-3 sm:col-start-1 sm:row-start-2"
              >
                {t('openPreviewHint')}
              </button>
            ) : null}
          </article>
        )
      })}
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
  if (typeof value === 'string' && value.includes('-')) {
    const parts = value.split('-').map(Number)
    if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
      return Math.round((parts[0] + parts[1]) / 2)
    }
  }
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
            footnote={null}
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
 * @param {string|null} beforeSrc — original front portrait URL for hair compare + aging
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
  visualAge = null,
}) {
  const t = useTranslations('AiVisuals')
  const variants = aiVisuals?.variants || []
  const [preview, setPreview] = useState(null)
  const aspectRatio = useImageAspectRatio(beforeSrc, 4 / 5)

  const hairVariants = variants.filter((v) => v.type === 'hair')
  const outfitVariants = variants.filter((v) => v.type === 'outfit')
  const agingVariants = variants.filter((v) => v.type === 'aging')

  const openPreview = useCallback((src, title) => {
    setPreview({ src, title })
  }, [])

  const closePreview = useCallback(() => setPreview(null), [])

  const isStyleSection = activeType === 'hair' || activeType === 'outfit' || activeType === 'aging'
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
    <div className={activeType ? 'space-y-6' : 'space-y-6'}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          {isStyleSection ? (
            <StyleSectionHeader type={activeType} t={t} />
          ) : (
            <>
              <div className={`flex items-center gap-2 ${activeType ? 'mb-1' : 'mb-2'}`}>
                <Sparkles className={`${activeType ? 'w-4 h-4' : 'w-5 h-5'} text-brand`} />
                <h3 className={`font-sans font-semibold text-ink ${activeType ? 'text-base' : 'text-lg'}`}>
                  {sectionTitle}
                </h3>
              </div>
              {!activeType && (
                <p className="text-sm text-ink-muted leading-relaxed max-w-2xl">{t('description')}</p>
              )}
              {activeType && t.has(`types.${activeType}`) && (
                <p className="text-xs text-ink-muted leading-relaxed max-w-2xl line-clamp-2">
                  {t(`types.${activeType}`)}
                </p>
              )}
            </>
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
          <StyleSuggestionList
            type={activeType}
            variants={filtered}
            beforeSrc={activeType === 'hair' ? beforeSrc : null}
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
        <div className="space-y-10">
          <section className="space-y-5">
            <h4 className="font-sans text-xl font-semibold text-ink">{t('sections.hair')}</h4>
            <StyleSuggestionList
              type="hair"
              variants={hairVariants}
              beforeSrc={beforeSrc}
              aspectRatio={aspectRatio}
              t={t}
              onOpenImage={openPreview}
              {...styleRegenProps}
            />
          </section>
          <section className="space-y-5">
            <h4 className="font-sans text-xl font-semibold text-ink">{t('sections.outfit')}</h4>
            <StyleSuggestionList
              type="outfit"
              variants={outfitVariants}
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
