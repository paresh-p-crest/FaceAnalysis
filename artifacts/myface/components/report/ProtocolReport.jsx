'use client'

import { useLocale, useTranslations } from 'next-intl'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { normalizeToJpegDataUrl } from '../../utils/aestheticProjection'
import {
  resolveAllFeatureAfterImages,
  resolveAllFeatureImages,
} from '../../utils/protocolFeatureImages'
import {
  resolveAfterCvPayload,
  resolveAfterLandmarks,
  resolveProjectedAfterUrl,
} from '../../utils/projectedAfter'
import { alignAfterToBefore } from '../../utils/alignAfterToBefore'
import {
  buildClosingColumns,
  buildClosingRecommendations,
  buildFeaturePages,
  buildProtocolContents,
  buildProtocolDashboardData,
  DISCLAIMER_PARAGRAPH_KEYS,
  formatAnalysisTimeDays,
  formatProtocolId,
  formatProtocolMonth,
  getClientName,
  getFeatureComparisonData,
  INTRODUCTION_PARAGRAPH_KEYS,
  LIMITATIONS_PARAGRAPH_KEY,
  localizedSubsectionTitle,
  PRIVACY_PARAGRAPH_KEYS,
  PRIVACY_POLICY_URL,
  REPORT_PROTOCOL_FEATURES,
  UNDERSTANDING_RESULTS_KEYS,
  rewriteToSubjectVoice,
  resolveTreatmentPhases,
  resolveFeatureHighlights,
} from '../../utils/reportProtocolModel'
import {
  layoutBottomAnchoredClip,
  PDF_PAGE_BOTTOM,
  PDF_PAGE_H,
  truncateFeatureHighlightBullet,
  truncatePdfBody,
  truncatePdfSummaryBar,
  truncatePdfSummaryCard,
} from '../../utils/pdfTextFit'
import { BrandLogo } from '../BrandLogo'
import { FeatureAnalysisHero } from './FeaturePreviewPortrait'
import { NameProtocolPlate } from './NameProtocolPlate'
import { TreatmentProtocolPhases } from './TreatmentProtocolPhases'
import { FacialAgePanel } from './FacialAgePanel'
import { localizeFeatureRow, localizePriorityMiniCard } from '../../utils/cvReportLocale'

function DashboardRadarChart({ items, t }) {
  const cx = 100
  const cy = 100
  const rMax = 56
  const n = Math.max(1, items?.length || 0)
  const backgroundPolygons = [0.2, 0.4, 0.6, 0.8, 1].map((scale) => {
    const points = []
    for (let i = 0; i < n; i++) {
      const angle = (i * 2 * Math.PI) / n - Math.PI / 2
      points.push(`${cx + rMax * scale * Math.cos(angle)},${cy + rMax * scale * Math.sin(angle)}`)
    }
    return points.join(' ')
  })
  const clientPoints = (items || [])
    .map((item, i) => {
      const angle = (i * 2 * Math.PI) / n - Math.PI / 2
      const pct = Math.min(100, Math.max(0, Number(item.score) || 0)) / 100
      return `${cx + rMax * pct * Math.cos(angle)},${cy + rMax * pct * Math.sin(angle)}`
    })
    .join(' ')
  const projectedPoints = (items || [])
    .map((item, i) => {
      const angle = (i * 2 * Math.PI) / n - Math.PI / 2
      const base = Math.min(100, Math.max(0, Number(item.score) || 0))
      const proj = Number(item.projected)
      const pct = (Number.isFinite(proj) ? Math.min(100, Math.max(0, proj)) : base) / 100
      return `${cx + rMax * pct * Math.cos(angle)},${cy + rMax * pct * Math.sin(angle)}`
    })
    .join(' ')
  if (!items?.length) {
    return <p className="report-pdf-body-text text-center text-ink-muted">—</p>
  }
  // Same dual-series feature radar as page 5 PDF
  return (
    <div className="w-full flex flex-col items-center gap-3 pt-2 pb-2">
      <div className="w-full max-w-[158px] mx-auto aspect-square flex items-center justify-center">
        <svg className="w-full h-full overflow-visible" viewBox="0 0 200 200">
          {backgroundPolygons.map((pts, idx) => (
            <polygon key={idx} points={pts} fill="none" stroke="#E5E7EB" strokeWidth="0.7" />
          ))}
          {(items || []).map((item, i) => {
            const angle = (i * 2 * Math.PI) / n - Math.PI / 2
            const xLine = cx + rMax * Math.cos(angle)
            const yLine = cy + rMax * Math.sin(angle)
            const xLabel = cx + (rMax + 20) * Math.cos(angle)
            const yLabel = cy + (rMax + 20) * Math.sin(angle)
            return (
              <g key={item.id || item.label}>
                <line x1={cx} y1={cy} x2={xLine} y2={yLine} stroke="#F3F4F6" strokeWidth="0.7" />
                <text
                  x={xLabel}
                  y={yLabel}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="fill-slate-400 font-sans"
                  style={{ fontSize: 6.5 }}
                >
                  {item.label}
                </text>
              </g>
            )
          })}
          <polygon points={clientPoints} fill="none" stroke="#64748b" strokeWidth="1.4" />
          <polygon points={projectedPoints} fill="none" stroke="#5e9f8b" strokeWidth="1.6" />
        </svg>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[6px] text-ink-muted pt-0.5">
        <span className="inline-flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-[1px] bg-brand shrink-0" />
          {t('protocolModel.chartProjectedPotential')}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-[1px] bg-slate-500 shrink-0" />
          {t('protocolModel.chartClientValues')}
        </span>
      </div>
    </div>
  )
}

const EVIDENCE_TIER_LABELS = {
  lifestyle: 'Routine / Topical',
  otc: 'Non-invasive / OTC',
  refer_clinician: 'See clinician',
}

/**
 * Uncontrolled contentEditable text. Initial value is written to the DOM once;
 * props only re-sync when the node is NOT focused, so typing never fights React.
 * Commit fires on blur, keeping PDF rebuild/save off the keystroke path.
 */
/** Zero overflow inside the A4 sheet only — never the protocol preview scroller. */
function resetSheetScroll(start) {
  let n = start
  while (n && n !== document.documentElement) {
    n.scrollTop = 0
    n.scrollLeft = 0
    if (n.classList?.contains('report-view-a4-page')) break
    n = n.parentElement
  }
}

function leftoverCssPx(anchor, page) {
  if (!anchor || !page) return 0
  const pageRect = page.getBoundingClientRect()
  const scale = pageRect.height / Math.max(page.clientHeight, 1)
  const raw = (pageRect.bottom - 1 - anchor.getBoundingClientRect().top) / scale
  return Math.max(0, Math.min(raw, page.clientHeight))
}

/** Space from el top down to PDF PAGE_BOTTOM (785.89pt), not the sheet edge. */
function leftoverToPdfBottom(anchor, page) {
  if (!anchor || !page) return 0
  const pageRect = page.getBoundingClientRect()
  const scale = pageRect.height / Math.max(page.clientHeight, 1)
  const pdfBottom = pageRect.top + PDF_PAGE_BOTTOM * scale
  return Math.max(0, (pdfBottom - 1 - anchor.getBoundingClientRect().top) / scale)
}

/** Space from el top to PDF grow cap (PAGE_H - 1) — skin Weitere Hautoptimierung. */
function leftoverToPdfGrowCap(anchor, page) {
  if (!anchor || !page) return 0
  const pageRect = page.getBoundingClientRect()
  const scale = pageRect.height / Math.max(page.clientHeight, 1)
  const growCap = pageRect.top + (PDF_PAGE_H - 1) * scale
  return Math.max(0, (growCap - 1 - anchor.getBoundingClientRect().top) / scale)
}

function EditableText({
  as: Tag = 'p',
  value = '',
  editable = false,
  onCommit,
  onFocus,
  onBlurAfter,
  rewriteOnBlur,
  className = '',
}) {
  const ref = useRef(null)

  useEffect(() => {
    const el = ref.current
    if (!el || document.activeElement === el) return
    const next = value || ''
    if (el.innerText !== next) el.innerText = next
  }, [value, editable])

  if (!editable || !onCommit) {
    return <Tag className={className}>{value}</Tag>
  }

  return (
    <Tag
      ref={ref}
      className={`${className} report-editable`}
      contentEditable
      suppressContentEditableWarning
      spellCheck={false}
      onFocus={(e) => {
        onFocus?.(e)
      }}
      onBlur={(e) => {
        const node = e.currentTarget
        let next = node.innerText
          .replace(/\u00a0/g, ' ')
          .replace(/\n{3,}/g, '\n\n')
          .trimEnd()
        if (rewriteOnBlur) next = rewriteOnBlur(node, next) ?? next
        let display = next
        if (next !== (value || '')) {
          const result = onCommit(next)
          display = result !== undefined ? result : next
        }
        node.innerText = display
        resetSheetScroll(node)
        onBlurAfter?.(e)
      }}
    />
  )
}

/** Match jsPDF drawHeader: brand bar + MYFACE + PAGE / NN + divider. */
function PdfPageShell({ page, sectionId, children, cover = false }) {
  const tPdf = useTranslations('Pdf')
  return (
    <section
      className={`report-protocol-page report-view-a4-page ${cover ? 'report-view-a4-page--cover' : ''}`}
      {...(sectionId ? { 'data-protocol-section': sectionId } : {})}
    >
      {!cover && <div className="report-pdf-brand-bar" aria-hidden />}
      <div className={`report-view-a4-inner ${cover ? '' : 'report-view-a4-inner--pdf'}`}>
        {!cover && page != null && (
          <header className="report-pdf-page-header">
            <span className="report-pdf-brand">{tPdf('brandHeader')}</span>
            <span className="report-pdf-page-num">
              <span className="report-pdf-page-prefix">{tPdf('pagePrefix')} </span>
              {String(page).padStart(2, '0')}
            </span>
          </header>
        )}
        {children}
      </div>
    </section>
  )
}

/** Match jsPDF drawSplitTitle — primary then secondary on next line. */
function PdfSplitTitle({ primary, secondary }) {
  return (
    <h2 className="report-pdf-split-title">
      <span className="report-pdf-split-primary">{primary}</span>
      {secondary ? <span className="report-pdf-split-secondary">{secondary}</span> : null}
    </h2>
  )
}

function SectionBlock({ title, subtitle, page, sectionId, children, splitTitle }) {
  return (
    <PdfPageShell page={page} sectionId={sectionId}>
      {splitTitle ? (
        <PdfSplitTitle primary={splitTitle.primary} secondary={splitTitle.secondary} />
      ) : (
        <h2 className="report-pdf-split-title">
          <span className="report-pdf-split-primary">{title}</span>
        </h2>
      )}
      {subtitle && <p className="report-pdf-subtitle">{subtitle}</p>}
      {children}
    </PdfPageShell>
  )
}

function ImageFrame({
  src,
  tag,
  emptyLabel,
  height,
  className = '',
  cover = true,
}) {
  const tPdf = useTranslations('Pdf')
  const pending = emptyLabel || tPdf('projectedImagePending')
  return (
    <div
      className={`report-pdf-image-frame ${className}`}
      style={height != null ? { height } : undefined}
    >
      {src ? (
        <img
          src={src}
          alt={tag || 'Feature'}
          className={cover ? 'object-cover' : 'object-contain'}
        />
      ) : (
        <span className="report-pdf-image-empty">{pending}</span>
      )}
      {tag && <span className="report-pdf-image-tag">{tag}</span>}
    </div>
  )
}

/** Match reportPdf drawSplitComparisonFrame — half-split cover crop, dashed midline. */
function SplitComparisonFrame({ beforeSrc, afterSrc = null, height = 240 }) {
  const tPdf = useTranslations('Pdf')
  return (
    <div className="report-pdf-split-frame" style={{ height }}>
      <div className="report-pdf-split-frame__half">
        {beforeSrc ? (
          <img src={beforeSrc} alt="" className="object-cover" />
        ) : (
          <span className="report-pdf-image-empty">{tPdf('projectedImagePending')}</span>
        )}
      </div>
      <div className="report-pdf-split-frame__half">
        {afterSrc ? (
          <img src={afterSrc} alt="" className="object-cover" />
        ) : (
          <span className="report-pdf-image-empty">{tPdf('projectedImagePending')}</span>
        )}
      </div>
      <div className="report-pdf-split-frame__rule" aria-hidden />
    </div>
  )
}

/** Same mid-body split as drawHairFeaturePage (Frisur / Haarausfall). */
function splitHairLossColumns(body) {
  const text = String(body || '')
  if (!text) return ['', '']
  const mid = Math.floor(text.length / 2)
  const splitAt = text.indexOf('. ', mid)
  const splitIdx = splitAt > 0 ? splitAt + 1 : mid
  return [text.slice(0, splitIdx).trim(), text.slice(splitIdx).trim()]
}

function BeforeAfterPair({ beforeSrc, afterSrc = null, stacked = false, height = 120 }) {
  const t = useTranslations('Report.protocolModel')
  if (stacked) {
    return (
      <div className="report-pdf-ba-stack">
        <ImageFrame src={beforeSrc} tag={t('tagBefore')} height={height} />
        <ImageFrame src={afterSrc} tag={t('tagAfter')} height={height} />
      </div>
    )
  }
  return (
    <div className="report-pdf-ba-row">
      <ImageFrame src={beforeSrc} tag={t('tagBefore')} height={height} />
      <ImageFrame src={afterSrc} tag={t('tagAfter')} height={height} />
    </div>
  )
}

function LabeledBody({ title, body, evidenceTier, editable = false, onCommit, displayTitle = null }) {
  if (!title && body == null && !editable) return null
  const shown = displayTitle || title
  return (
    <div className="report-pdf-labeled-body">
      {shown ? <h3 className="report-pdf-label">{shown}</h3> : null}
      {body != null || editable ? (
        <EditableText
          as="p"
          className="report-pdf-body-text"
          value={body || ''}
          editable={editable}
          onCommit={onCommit}
        />
      ) : null}
      {evidenceTier && EVIDENCE_TIER_LABELS[evidenceTier] && (
        <p className="report-pdf-tier">Recommendation tier: {EVIDENCE_TIER_LABELS[evidenceTier]}</p>
      )}
    </div>
  )
}

/**
 * Hair / Jaw bottom row — same clip + title/card geometry as
 * reportPdf.layoutBottomAnchoredLeftColumn (via pdfTextFit copy).
 */
function BottomAnchoredFeatureRow({
  bodyTitle,
  bodyDisplayTitle,
  body,
  evidenceTier,
  summaryTitle,
  summary,
  bodyOffset = 18,
  drawTier = false,
  bodyEdit = {},
  summaryEdit = {},
}) {
  const rowRef = useRef(null)
  const [clip, setClip] = useState(null)
  const [editingBody, setEditingBody] = useState(false)
  const [editingSummary, setEditingSummary] = useState(false)
  const [pendingBody, setPendingBody] = useState(null)
  const [pendingSummary, setPendingSummary] = useState(null)

  const activeBody = pendingBody ?? body
  const activeSummary = pendingSummary ?? summary

  useEffect(() => {
    if (pendingBody != null && pendingBody === body) setPendingBody(null)
  }, [body, pendingBody])
  useEffect(() => {
    if (pendingSummary != null && pendingSummary === summary) setPendingSummary(null)
  }, [summary, pendingSummary])

  const refit = useCallback(() => {
    if (editingBody || editingSummary) return
    const row = rowRef.current
    const page = row?.closest('.report-view-a4-page')
    if (!row || !page) return
    // Map HTML leftover onto PDF Y so stickToBottom lands on PAGE_BOTTOM.
    const leftover = leftoverToPdfBottom(row, page)
    if (leftover < 36) return
    const topFloor = PDF_PAGE_BOTTOM - leftover
    const next = layoutBottomAnchoredClip(activeBody, activeSummary, topFloor, {
      bodyOffset,
      drawTier,
    })
    setClip(next)
  }, [activeBody, activeSummary, bodyOffset, drawTier, editingBody, editingSummary])

  useEffect(() => {
    refit()
    const inner = rowRef.current?.closest('.report-view-a4-inner--pdf')
    if (!inner || typeof ResizeObserver === 'undefined') return undefined
    const ro = new ResizeObserver(() => refit())
    ro.observe(inner)
    return () => ro.disconnect()
  }, [refit])

  const shownBody = clip?.body ?? activeBody ?? ''
  const shownSummary = clip?.summary ?? activeSummary ?? ''
  const titlePad = clip?.titlePad ?? 0
  const cardH = clip?.cardH ?? 110

  return (
    <div
      ref={rowRef}
      className="report-pdf-cols report-pdf-cols--bottom report-pdf-cols--bottom-anchor"
    >
      <div className="report-pdf-bottom-left" style={{ paddingTop: titlePad }}>
        {(bodyTitle || body != null) && (
          <div className="report-pdf-labeled-body">
            {(bodyDisplayTitle || bodyTitle) ? (
              <h3 className="report-pdf-label">{bodyDisplayTitle || bodyTitle}</h3>
            ) : null}
            <EditableText
              as="p"
              className="report-pdf-body-text"
              value={editingBody ? (activeBody || '') : shownBody}
              editable={Boolean(bodyEdit.editable)}
              onCommit={(next) => {
                setPendingBody(next)
                bodyEdit.onCommit?.(next)
                return next
              }}
              onFocus={() => setEditingBody(true)}
              onBlurAfter={() => {
                setEditingBody(false)
                requestAnimationFrame(() => refit())
              }}
            />
            {drawTier && evidenceTier && EVIDENCE_TIER_LABELS[evidenceTier] && (
              <p className="report-pdf-tier">Recommendation tier: {EVIDENCE_TIER_LABELS[evidenceTier]}</p>
            )}
          </div>
        )}
      </div>
      <div
        className="report-pdf-summary-card report-pdf-summary-card--pin-bottom"
        style={{ height: cardH, minHeight: cardH }}
      >
        <p className="report-pdf-summary-title">{summaryTitle}</p>
        <div className="report-pdf-summary-body-wrap">
          <EditableText
            as="p"
            className="report-pdf-summary-body"
            value={editingSummary ? (activeSummary || '') : shownSummary}
            editable={Boolean(summaryEdit.editable)}
            onCommit={(next) => {
              setPendingSummary(next)
              summaryEdit.onCommit?.(next)
              return next
            }}
            onFocus={() => setEditingSummary(true)}
            onBlurAfter={() => {
              setEditingSummary(false)
              requestAnimationFrame(() => refit())
            }}
          />
        </div>
      </div>
    </div>
  )
}

/** Body copy clipped with the same truncateAtSentences path as reportPdf.js. */
function FittedLabeledBody({
  title,
  body,
  evidenceTier,
  editable = false,
  onCommit,
  displayTitle = null,
}) {
  const rootRef = useRef(null)
  const bodyWrapRef = useRef(null)
  const [editing, setEditing] = useState(false)
  const [pendingBody, setPendingBody] = useState(null)
  const [fittedText, setFittedText] = useState(body || '')

  const activeBody = pendingBody ?? body
  const shownTitle = displayTitle || title

  useEffect(() => {
    if (pendingBody != null && pendingBody === body) setPendingBody(null)
  }, [body, pendingBody])

  const pruneToStart = useCallback((node, text) => {
    const wrap = bodyWrapRef.current
    const root = rootRef.current
    const page = root?.closest('.report-view-a4-page')
    const raw = String(text || '')
    if (!wrap || !page) return raw
    // Same grow cap as drawLabeledBody({ maxBottom: PAGE_H - 1 }) for skin.
    const leftover = leftoverToPdfGrowCap(wrap, page)
    const maxH = Math.max(1, leftover)
    wrap.style.maxHeight = `${maxH}px`
    const kept = truncatePdfBody(raw, maxH)
    if (node) {
      node.textContent = kept
      resetSheetScroll(node)
    }
    return kept
  }, [])

  const refit = useCallback(() => {
    if (editing) return
    const node = bodyWrapRef.current?.querySelector('.report-pdf-body-text')
    const kept = pruneToStart(node, activeBody)
    setFittedText(kept)
    if (node) resetSheetScroll(node)
  }, [activeBody, editing, pruneToStart])

  useEffect(() => {
    refit()
    const inner = rootRef.current?.closest('.report-view-a4-inner--pdf')
    if (!inner || typeof ResizeObserver === 'undefined') return undefined
    const ro = new ResizeObserver(() => { if (!editing) refit() })
    ro.observe(inner)
    return () => ro.disconnect()
  }, [refit, editing])

  if (!title && body == null && !editable) return null

  return (
    <div ref={rootRef} className="report-pdf-labeled-body report-pdf-labeled-body--page-fit">
      {shownTitle ? <h3 className="report-pdf-label">{shownTitle}</h3> : null}
      {body != null || editable ? (
        <div ref={bodyWrapRef} className="report-pdf-body-fit-wrap">
          <EditableText
            as="p"
            className="report-pdf-body-text"
            value={fittedText}
            editable={editable}
            rewriteOnBlur={pruneToStart}
            onCommit={(next) => {
              setFittedText(next)
              setPendingBody(next)
              onCommit?.(next)
              return next
            }}
            onFocus={(e) => {
              if (!editable) return
              setEditing(true)
              resetSheetScroll(e.currentTarget)
            }}
            onBlurAfter={() => {
              setEditing(false)
              requestAnimationFrame(() => resetSheetScroll(bodyWrapRef.current))
            }}
          />
        </div>
      ) : null}
      {evidenceTier && EVIDENCE_TIER_LABELS[evidenceTier] && (
        <p className="report-pdf-tier">Recommendation tier: {EVIDENCE_TIER_LABELS[evidenceTier]}</p>
      )}
    </div>
  )
}

function DumbbellChart({ items, t }) {
  const trackW = 140
  return (
    <div className="space-y-1.5">
      {items.map((item) => {
        const cx = (item.score / 100) * trackW
        const px = (item.projected / 100) * trackW
        return (
          <div key={item.label} className="flex items-center gap-3 text-[10px] font-sans">
            <span className="w-14 shrink-0 text-ink-secondary">{t(`protocolModel.chartAxes.${item.id}`) || item.label}</span>
            <div className="relative flex-1 h-4 max-w-[160px]">
              <div className="absolute top-1/2 left-0 right-0 h-px bg-surface-border -translate-y-1/2" />
              <div
                className="absolute top-1/2 h-0.5 bg-slate-500 -translate-y-1/2"
                style={{ left: `${Math.min(cx, px)}px`, width: `${Math.abs(px - cx)}px` }}
              />
              <div
                className="absolute top-1/2 w-2 h-2 rounded-full bg-slate-600 -translate-y-1/2 -translate-x-1/2"
                style={{ left: `${cx}px` }}
              />
              <div
                className="absolute top-1/2 w-2 h-2 rounded-full bg-brand -translate-y-1/2 -translate-x-1/2"
                style={{ left: `${px}px` }}
              />
            </div>
          </div>
        )
      })}
      <div className="flex gap-4 pt-2 text-[9px] text-ink-muted">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-slate-600" /> {t('protocolModel.chartClientValues')}
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-brand" /> {t('protocolModel.chartProjectedPotential')}
        </span>
      </div>
    </div>
  )
}

function BaldnessStagePanel({ stage = 1, feminine = false }) {
  const t = useTranslations('Report.protocolModel')
  const folder = feminine ? 'ludwig-stages' : 'norwood-stages'
  const stageIdx = Math.max(0, Math.min(6, (Number(stage) || 1) - 1))
  return (
    <div className="report-pdf-baldness-panel">
      <div className="report-pdf-baldness-scale">
        <span>{t('scaleNormal')}</span>
        <span>{t('scaleNeedAttention')}</span>
        <span>{t('scaleExtreme')}</span>
      </div>
      <div className="report-pdf-baldness-stages">
        {[1, 2, 3, 4, 5, 6, 7].map((n, i) => (
          <div
            key={n}
            className={`report-pdf-baldness-stage ${i === stageIdx ? 'report-pdf-baldness-stage--active' : ''}`}
          >
            <img src={`/${folder}/stage-${n}.png`} alt={`Stage ${n}`} />
          </div>
        ))}
      </div>
    </div>
  )
}

function PageFittedSummary({
  variant = 'card',
  title,
  summary,
  editable = false,
  onCommit,
  pinBottom = false,
}) {
  const boxRef = useRef(null)
  const bodyWrapRef = useRef(null)
  const [editing, setEditing] = useState(false)
  const [pendingSummary, setPendingSummary] = useState(null)
  const [fittedText, setFittedText] = useState(summary || '')
  const [boxMaxH, setBoxMaxH] = useState(undefined)

  const activeSummary = pendingSummary ?? summary
  const isCard = variant === 'card'
  const boxClass = [
    isCard ? 'report-pdf-summary-card report-pdf-summary-card--page-fit' : 'report-pdf-summary-bar report-pdf-summary-bar--page-fit',
    pinBottom ? 'report-pdf-summary-card--pin-bottom' : '',
  ].filter(Boolean).join(' ')

  useEffect(() => {
    if (pendingSummary != null && pendingSummary === summary) {
      setPendingSummary(null)
    }
  }, [summary, pendingSummary])

  const capBoxToPage = useCallback(() => {
    const box = boxRef.current
    const page = box?.closest('.report-view-a4-page')
    if (!box || !page) return 0
    resetSheetScroll(box)
    const leftover = leftoverCssPx(box, page)
    box.style.maxHeight = `${leftover}px`
    setBoxMaxH(leftover)
    return leftover
  }, [])

  const pruneToStart = useCallback((node, text) => {
    const box = boxRef.current
    const raw = String(text || '')
    if (!box) return raw
    // Collapse first so bottom-anchored cards sit at compact top; leftover then grows down only.
    if (node) node.textContent = '\u00a0'
    void box.offsetHeight
    const leftover = capBoxToPage()
    void box.offsetHeight
    // Same jsPDF truncateAtSentences path as drawSummaryCard / drawSummaryBar (pdfTextFit copy).
    const kept = isCard
      ? truncatePdfSummaryCard(raw, leftover)
      : truncatePdfSummaryBar(raw, leftover, title)
    if (node) {
      node.textContent = kept
      resetSheetScroll(node)
    }
    return kept
  }, [capBoxToPage, isCard, title])

  const refit = useCallback(() => {
    if (editing) return
    const node = bodyWrapRef.current?.querySelector('.report-pdf-summary-body')
    if (!node) return
    const kept = pruneToStart(node, activeSummary)
    setFittedText(kept)
    resetSheetScroll(node)
  }, [activeSummary, editing, pruneToStart])

  useEffect(() => {
    refit()
    const inner = boxRef.current?.closest('.report-view-a4-inner--pdf')
    if (!inner || typeof ResizeObserver === 'undefined') return undefined
    const ro = new ResizeObserver(() => { if (!editing) refit() })
    ro.observe(inner)
    return () => ro.disconnect()
  }, [refit, editing])

  const handleCommit = useCallback((next) => {
    setFittedText(next)
    setPendingSummary(next)
    onCommit?.(next)
    return next
  }, [onCommit])

  const box = (
    <div
      ref={boxRef}
      className={boxClass}
      style={boxMaxH != null ? { maxHeight: boxMaxH } : undefined}
    >
      <p className="report-pdf-summary-title">{title}</p>
      <div ref={bodyWrapRef} className="report-pdf-summary-body-wrap min-w-0 flex-1">
        <EditableText
          as="p"
          className="report-pdf-summary-body"
          value={fittedText}
          editable={editable}
          rewriteOnBlur={pruneToStart}
          onCommit={handleCommit}
          onFocus={(e) => {
            if (!editable) return
            setEditing(true)
            capBoxToPage()
            resetSheetScroll(e.currentTarget)
          }}
          onBlurAfter={() => {
            setEditing(false)
            requestAnimationFrame(() => resetSheetScroll(bodyWrapRef.current))
          }}
        />
      </div>
    </div>
  )

  return box
}

function SummaryCard({ title, summary, editable = false, onCommit, pinBottom = false }) {
  return (
    <PageFittedSummary
      variant="card"
      title={title}
      summary={summary}
      editable={editable}
      onCommit={onCommit}
      pinBottom={pinBottom}
    />
  )
}

/** Match jsPDF drawSummaryBar — full-width mint bar (chin uses the same path). */
function SummaryBar({ title, summary, editable = false, onCommit }) {
  return (
    <PageFittedSummary
      variant="bar"
      title={title}
      summary={summary}
      editable={editable}
      onCommit={onCommit}
    />
  )
}

/**
 * Per-feature HTML layouts mirrored from reportPdf.js draw*FeaturePage.
 * Structure/image placement must stay in sync with PDF.
 */
function FeaturePageHtml({
  page,
  images = { fullBefore: null, fullAfter: null, features: {}, featureAfter: {} },
  pageNum,
  answers = null,
  treatment = null,
  editable = false,
  onEditFeatureSubsection,
  onEditFeatureSummary,
}) {
  const t = useTranslations('Report.protocolModel')
  const pair = images.features?.[page.id] || {}
  const slots = pair.slots || {}
  const beforeSrc = slots.pairBefore || pair.before || images.fullBefore
  const pageAfterSrc = images.featureAfter?.[page.id] || images.fullAfter
  const previewSrc = slots.preview || pair.before || images.fullBefore
  const profileSrc = pair.profile && pair.profileIsReal ? pair.profile : null
  const subs = page.subsections || []
  const primaryKey = `featurePrimary.${page.id}`
  const primary = t.has(primaryKey)
    ? t(primaryKey)
    : (page.title.replace(' Recommendations', '').split(' ')[0] || page.title)
  const secondary = t('recommendations')
  const summaryTitle = t('featureSummary', { name: primary })
  const subLabel = (enTitle) => localizedSubsectionTitle(enTitle, t)

  // Edit closures — write only the touched subsection/summary; siblings fall back to CV defaults.
  const bodyEdit = (title) =>
    editable && onEditFeatureSubsection && title
      ? { editable: true, onCommit: (value) => onEditFeatureSubsection(page.id, title, value) }
      : {}
  const summaryEdit =
    editable && onEditFeatureSummary
      ? { editable: true, onCommit: (value) => onEditFeatureSummary(page.id, value) }
      : {}

  if (page.id === 'eyes') {
    return (
      <PdfPageShell page={pageNum} sectionId={page.id}>
        <PdfSplitTitle primary={primary} secondary={secondary} />
        <div className="report-pdf-cols report-pdf-cols--top">
          <LabeledBody title="Eyebrows" displayTitle={subLabel('Eyebrows')} body={subs[0]?.body} evidenceTier={subs[0]?.evidenceTier} {...bodyEdit('Eyebrows')} />
          <LabeledBody title="Eyelashes" displayTitle={subLabel('Eyelashes')} body={subs[1]?.body} evidenceTier={subs[1]?.evidenceTier} {...bodyEdit('Eyelashes')} />
        </div>
        <div className="report-pdf-block">
          <BeforeAfterPair beforeSrc={beforeSrc} afterSrc={pageAfterSrc} height={130} />
        </div>
        <div className="report-pdf-cols">
          <LabeledBody title="Eyes" displayTitle={subLabel('Eyes')} body={subs[2]?.body} evidenceTier={subs[2]?.evidenceTier} {...bodyEdit('Eyes')} />
          <LabeledBody title="Under eye" displayTitle={subLabel('Under eye')} body={subs[3]?.body} evidenceTier={subs[3]?.evidenceTier} {...bodyEdit('Under eye')} />
        </div>
        <div className="report-pdf-cols report-pdf-cols--bottom">
          <ImageFrame src={slots.preview || previewSrc} tag={t('tagEyes')} height={110} cover={false} />
          <SummaryCard title={t('eyeRegionSummary')} summary={page.summary} {...summaryEdit} />
        </div>
      </PdfPageShell>
    )
  }

  if (page.id === 'nose') {
    return (
      <PdfPageShell page={pageNum} sectionId={page.id}>
        <PdfSplitTitle primary={primary} secondary={secondary} />
        <div className="report-pdf-cols report-pdf-feature-fill report-pdf-cols--nose">
          <div className="report-pdf-col-stack report-pdf-nose-left">
            <LabeledBody title="Nose" displayTitle={subLabel('Nose')} body={subs[0]?.body} evidenceTier={subs[0]?.evidenceTier} {...bodyEdit('Nose')} />
            <SummaryCard title={summaryTitle} summary={page.summary} {...summaryEdit} />
          </div>
          <div className="report-pdf-col-stack">
            {profileSrc && <ImageFrame src={profileSrc} tag={t('tagProfile')} height={300} />}
            <BeforeAfterPair beforeSrc={beforeSrc} afterSrc={pageAfterSrc} height={120} />
          </div>
        </div>
      </PdfPageShell>
    )
  }

  if (page.id === 'hair') {
    const styleCols = splitHairLossColumns(subs[0]?.body)
    const hairLossCols = splitHairLossColumns(subs[1]?.body)
    return (
      <PdfPageShell page={pageNum} sectionId={page.id}>
        <PdfSplitTitle primary={primary} secondary={secondary} />
        <BeforeAfterPair beforeSrc={beforeSrc} afterSrc={pageAfterSrc} height={140} />
        {subs[0] && (
          <div className="report-pdf-block">
            <h3 className="report-pdf-label">{subLabel(subs[0].title)}</h3>
            {editable ? (
              <LabeledBody title="" body={subs[0].body} evidenceTier={subs[0].evidenceTier} {...bodyEdit(subs[0].title)} />
            ) : (
              <div className="report-pdf-cols report-pdf-cols--top">
                <p className="report-pdf-body-text">{styleCols[0]}</p>
                <p className="report-pdf-body-text">{styleCols[1]}</p>
              </div>
            )}
          </div>
        )}
        {subs[1] && (
          <div className="report-pdf-block">
            <h3 className="report-pdf-label">{subLabel(subs[1].title)}</h3>
            {editable ? (
              <LabeledBody title="" body={subs[1].body} evidenceTier={subs[1].evidenceTier} {...bodyEdit(subs[1].title)} />
            ) : (
              <div className="report-pdf-cols report-pdf-cols--top">
                <p className="report-pdf-body-text">{hairLossCols[0]}</p>
                <p className="report-pdf-body-text">{hairLossCols[1]}</p>
              </div>
            )}
          </div>
        )}
        <BaldnessStagePanel
          stage={page.layoutHints?.norwoodStage ?? page.norwoodStage ?? 1}
          feminine={String(answers?.genderPreference || '').trim().toLowerCase() === 'feminine'}
        />
        <BottomAnchoredFeatureRow
          bodyTitle={subs[2]?.title}
          bodyDisplayTitle={subs[2] ? subLabel(subs[2].title) : null}
          body={subs[2]?.body}
          evidenceTier={subs[2]?.evidenceTier}
          summaryTitle={summaryTitle}
          summary={page.summary}
          bodyOffset={18}
          drawTier
          bodyEdit={subs[2] ? bodyEdit(subs[2].title) : {}}
          summaryEdit={summaryEdit}
        />
      </PdfPageShell>
    )
  }

  if (page.id === 'cheeks') {
    const analysisSrc = slots.analysis || pair.before || beforeSrc
    return (
      <PdfPageShell page={pageNum} sectionId={page.id}>
        <PdfSplitTitle primary={primary} secondary={secondary} />
        <div className="report-pdf-cols">
          <LabeledBody title="Cheek Structure" displayTitle={subLabel('Cheek Structure')} body={subs[0]?.body} evidenceTier={subs[0]?.evidenceTier} {...bodyEdit('Cheek Structure')} />
          <ImageFrame src={analysisSrc} tag={t('tagAnalysis')} height={180} />
        </div>
        <div className="report-pdf-block">
          <BeforeAfterPair beforeSrc={beforeSrc} afterSrc={pageAfterSrc} height={180} />
        </div>
        <SummaryBar title={t('cheekRegionSummary')} summary={page.summary} {...summaryEdit} />
      </PdfPageShell>
    )
  }

  if (page.id === 'jaw') {
    return (
      <PdfPageShell page={pageNum} sectionId={page.id}>
        <PdfSplitTitle primary={primary} secondary={secondary} />
        <div className="report-pdf-cols report-pdf-cols--top">
          <LabeledBody title="Jaw Structure" displayTitle={subLabel('Jaw Structure')} body={subs[0]?.body} evidenceTier={subs[0]?.evidenceTier} {...bodyEdit('Jaw Structure')} />
          <ImageFrame src={profileSrc || beforeSrc} tag={t('tagProfile')} height={300} />
        </div>
        <div className="report-pdf-block">
          <BeforeAfterPair beforeSrc={beforeSrc} afterSrc={pageAfterSrc} height={150} />
        </div>
        <div className="report-pdf-cols report-pdf-jaw-bottom">
          <LabeledBody
            title="Further Enhancement"
            displayTitle={subLabel('Further Enhancement')}
            body={subs[1]?.body}
            evidenceTier={subs[1]?.evidenceTier}
            {...bodyEdit('Further Enhancement')}
          />
          <SummaryCard title={t('jawRegionSummary')} summary={page.summary} {...summaryEdit} />
        </div>
      </PdfPageShell>
    )
  }

  if (page.id === 'lips') {
    return (
      <PdfPageShell page={pageNum} sectionId={page.id}>
        <PdfSplitTitle primary={primary} secondary={secondary} />
        <div className="report-pdf-cols">
          <LabeledBody title="Lips" displayTitle={subLabel('Lips')} body={subs[0]?.body} evidenceTier={subs[0]?.evidenceTier} {...bodyEdit('Lips')} />
          <ImageFrame src={previewSrc} tag={t('tagLips')} height={240} />
        </div>
        <div className="report-pdf-block">
          <BeforeAfterPair beforeSrc={beforeSrc} afterSrc={pageAfterSrc} height={200} />
        </div>
        <SummaryBar title={summaryTitle} summary={page.summary} {...summaryEdit} />
      </PdfPageShell>
    )
  }

  if (page.id === 'chin') {
    const chinCols = splitHairLossColumns(subs[0]?.body)
    return (
      <PdfPageShell page={pageNum} sectionId={page.id}>
        <PdfSplitTitle primary={primary} secondary={secondary} />
        {profileSrc ? (
          <div className="report-pdf-ba-row">
            <ImageFrame src={profileSrc} tag={t('tagProfile')} height={200} cover={false} />
            <ImageFrame src={profileSrc} tag={t('tagProfile')} height={200} cover={false} />
          </div>
        ) : null}
        <div className="report-pdf-block report-pdf-chin-body">
          {editable ? (
            <LabeledBody title="Chin" displayTitle={subLabel('Chin')} body={subs[0]?.body} evidenceTier={subs[0]?.evidenceTier} {...bodyEdit('Chin')} />
          ) : (
            <div className="report-pdf-cols report-pdf-cols--top report-pdf-chin-cols">
              <div>
                <h3 className="report-pdf-label">{subLabel('Chin')}</h3>
                <p className="report-pdf-body-text">{chinCols[0]}</p>
              </div>
              <div className="report-pdf-chin-cols-right">
                <p className="report-pdf-body-text">{chinCols[1]}</p>
              </div>
            </div>
          )}
        </div>
        <div className="report-pdf-block">
          <BeforeAfterPair beforeSrc={beforeSrc} afterSrc={pageAfterSrc} height={120} />
        </div>
        <SummaryBar title={summaryTitle} summary={page.summary} {...summaryEdit} />
      </PdfPageShell>
    )
  }

  if (page.id === 'neck') {
    return (
      <PdfPageShell page={pageNum} sectionId={page.id}>
        <PdfSplitTitle primary={primary} secondary={secondary} />
        <div className="report-pdf-cols report-pdf-feature-fill">
          <div className="report-pdf-col-stack">
            <LabeledBody title="Neck Size" displayTitle={subLabel('Neck Size')} body={subs[0]?.body} evidenceTier={subs[0]?.evidenceTier} {...bodyEdit('Neck Size')} />
            <LabeledBody title="Neck Skin" displayTitle={subLabel('Neck Skin')} body={subs[1]?.body} evidenceTier={subs[1]?.evidenceTier} {...bodyEdit('Neck Skin')} />
          </div>
          <div className="report-pdf-col-stack report-pdf-col-stack--frames">
            <ImageFrame src={beforeSrc} tag={t('tagBefore')} height={240} />
            <ImageFrame src={pageAfterSrc} tag={t('tagAfter')} height={240} />
          </div>
        </div>
        <SummaryBar title={summaryTitle} summary={page.summary} {...summaryEdit} />
      </PdfPageShell>
    )
  }

  if (page.id === 'ears') {
    const earCols = splitHairLossColumns(subs[0]?.body)
    return (
      <PdfPageShell page={pageNum} sectionId={page.id}>
        <PdfSplitTitle primary={primary} secondary={secondary} />
        <BeforeAfterPair beforeSrc={beforeSrc} afterSrc={pageAfterSrc} height={240} />
        <div className="report-pdf-block report-pdf-chin-body">
          {editable ? (
            <LabeledBody
              title={subs[0]?.title || 'Ear Structure'}
              displayTitle={subLabel(subs[0]?.title || 'Ear Structure')}
              body={subs[0]?.body}
              evidenceTier={subs[0]?.evidenceTier}
              {...bodyEdit(subs[0]?.title || 'Ear Structure')}
            />
          ) : (
            <div className="report-pdf-cols report-pdf-cols--top report-pdf-chin-cols">
              <div>
                <h3 className="report-pdf-label">{subLabel(subs[0]?.title || 'Ear Structure')}</h3>
                <p className="report-pdf-body-text">{earCols[0]}</p>
              </div>
              <div className="report-pdf-chin-cols-right">
                <p className="report-pdf-body-text">{earCols[1]}</p>
              </div>
            </div>
          )}
        </div>
        <SummaryBar title={summaryTitle} summary={page.summary} {...summaryEdit} />
      </PdfPageShell>
    )
  }

  if (page.id === 'skin') {
    const splitBefore = pair.before || beforeSrc
    const splitAfter = images.skinSplitAfter || pageAfterSrc
    const pairBefore = slots.pairBefore || beforeSrc
    const treatmentTitle = t.has('treatmentProtocol')
      ? t('treatmentProtocol')
      : 'Behandlungsprotokoll'
    return (
      <PdfPageShell page={pageNum} sectionId={page.id}>
        <PdfSplitTitle primary={primary} secondary={secondary} />
        <div className="report-pdf-skin-layout">
          <div className="report-pdf-skin-main">
            <div className="report-pdf-skin-top">
              <div className="report-pdf-col-stack">
                <SplitComparisonFrame beforeSrc={splitBefore} afterSrc={splitAfter} height={220} />
                <BeforeAfterPair beforeSrc={pairBefore} afterSrc={pageAfterSrc} height={100} />
              </div>
              <div className="report-pdf-col-stack report-pdf-skin-mid">
                <p className="report-pdf-body-text">{t('skinIntro')}</p>
                {subs[0] && (
                  <LabeledBody
                    title={subs[0].title || 'Skincare Protocol'}
                    displayTitle={subLabel(subs[0].title || 'Skincare Protocol')}
                    body={subs[0].body}
                    evidenceTier={subs[0].evidenceTier}
                    {...bodyEdit(subs[0].title || 'Skincare Protocol')}
                  />
                )}
              </div>
            </div>
            {subs[1] && (
              <div className="report-pdf-skin-further">
                <LabeledBody
                  title={subs[1].title || 'Further Skin Enhancement'}
                  displayTitle={subLabel(subs[1].title || 'Further Skin Enhancement')}
                  body={subs[1].body}
                  evidenceTier={subs[1].evidenceTier}
                  {...bodyEdit(subs[1].title || 'Further Skin Enhancement')}
                />
              </div>
            )}
          </div>
          <div className="report-pdf-skin-phases">
            <TreatmentProtocolPhases
              title={treatmentTitle}
              phases={treatment?.phases}
              className="report-pdf-skin-phases-inner"
            />
          </div>
        </div>
        <div className="report-pdf-block">
          <SummaryBar title={summaryTitle} summary={page.summary} {...summaryEdit} />
        </div>
      </PdfPageShell>
    )
  }

  // Default — two-col PDF-like: text left, images + summary right
  return (
    <PdfPageShell page={pageNum} sectionId={page.id}>
      <PdfSplitTitle primary={primary} secondary={secondary} />
      <div className="report-pdf-cols report-pdf-feature-fill">
        <div className="report-pdf-col-stack">
          {subs.map((sub) => (
            <LabeledBody key={sub.title} title={sub.title} displayTitle={subLabel(sub.title)} body={sub.body} evidenceTier={sub.evidenceTier} {...bodyEdit(sub.title)} />
          ))}
        </div>
        <div className="report-pdf-col-stack">
          {page.layoutHints?.profileImage && profileSrc && (
            <ImageFrame src={profileSrc} tag={t('tagProfile')} height={200} />
          )}
          {page.id === 'skin' && (slots.analysis || pair.before) && (
            <ImageFrame src={slots.analysis || pair.before} tag={t('tagAnalysis')} height={160} />
          )}
          <BeforeAfterPair
            beforeSrc={beforeSrc}
            afterSrc={pageAfterSrc}
            stacked={Boolean(page.layoutHints?.stackedImages && page.id !== 'skin')}
            height={page.id === 'skin' ? 150 : 120}
          />
          <SummaryCard title={summaryTitle} summary={page.summary} {...summaryEdit} />
        </div>
      </div>
    </PdfPageShell>
  )
}

/** Paginated protocol viewer page count (cover + disclaimer + intro + understanding + protocol + closing). */
export const PROTOCOL_PAGINATED_PAGE_COUNT = 6

export default function ProtocolReport({
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
  aiNarrative,
  projectedAfter = null,
  projectedAnalysis = null,
  assessmentId = null,
  createdAt = null,
  updatedAt = null,
  pageIndex = 0,
  paginated = false,
  editable = false,
  onEditFeatureSubsection,
  onEditFeatureSummary,
  onEditClosing,
  onEditOverview,
}) {
  const t = useTranslations('Report')
  const tCv = useTranslations('CvReport')
  const tPdf = useTranslations('Pdf')
  const locale = useLocale()
  const clientName = getClientName(answers, user, assessmentOwner)
  const reportDate = (() => {
    const raw = updatedAt || createdAt
    if (!raw) return '—'
    const ms = Date.parse(raw)
    if (!Number.isFinite(ms)) return '—'
    return new Date(ms).toLocaleDateString(locale, { day: '2-digit', month: '2-digit', year: 'numeric' })
  })()
  const month = formatProtocolMonth(undefined, locale)
  const featurePages = useMemo(
    () => buildFeaturePages(cvReport, eyeAnalysis, protocolNarrative, locale, t),
    [cvReport, eyeAnalysis, protocolNarrative, locale, t],
  )
  // Latest pages for the image loader without retriggering reloads on text edits.
  const featurePagesRef = useRef(featurePages)
  featurePagesRef.current = featurePages
  const contents = useMemo(() => buildProtocolContents(clientName, t), [clientName, t])
  const closingParagraphs = useMemo(
    () => buildClosingRecommendations(aiNarrative, cvReport, clientName, protocolNarrative, locale, t),
    [aiNarrative, cvReport, clientName, protocolNarrative, locale, t],
  )
  const closingCols = useMemo(() => buildClosingColumns(closingParagraphs), [closingParagraphs])
  const chartItems = useMemo(() => getFeatureComparisonData(cvReport), [cvReport])
  const featureRadarItems = useMemo(
    () =>
      chartItems.map((item) => ({
        ...item,
        label: t(`protocolModel.chartAxes.${item.id}`) || item.label,
      })),
    [chartItems, t],
  )
  const dash = useMemo(
    () => buildProtocolDashboardData({
      cvReport, metrics, answers, eyeAnalysis, createdAt, updatedAt, projectedAnalysis,
    }),
    [cvReport, metrics, answers, eyeAnalysis, createdAt, updatedAt, projectedAnalysis],
  )
  const protocolId = formatProtocolId(assessmentId)
  const firstName = clientName.split(/\s+/)[0] || clientName
  const overviewText = protocolNarrative?.summary || aiNarrative?.content?.summary || null
  const treatment = useMemo(
    () => resolveTreatmentPhases({ protocolNarrative, dash, t }),
    [protocolNarrative, dash, t],
  )
  const featureHighlights = useMemo(
    () => resolveFeatureHighlights({ protocolNarrative, cvReport, locale }),
    [protocolNarrative, cvReport, locale],
  )
  const afterFullUrl = useMemo(() => resolveProjectedAfterUrl(projectedAfter), [projectedAfter])
  const afterLandmarks = useMemo(() => resolveAfterLandmarks(projectedAnalysis), [projectedAnalysis])
  const afterCv = useMemo(() => resolveAfterCvPayload(projectedAnalysis), [projectedAnalysis])

  const [loading, setLoading] = useState(true)
  const [images, setImages] = useState({ fullBefore: null, fullAfter: null, features: {}, featureAfter: {} })

  useEffect(() => {
    let cancelled = false
    async function loadImages() {
      if (!photo || !cvReport) {
        setLoading(false)
        return
      }
      setLoading(true)
      try {
        const activeFeaturePages = featurePagesRef.current
        const photoJpeg = await normalizeToJpegDataUrl(photo)
        const features = await resolveAllFeatureImages({
          featurePages: activeFeaturePages,
          photoJpeg,
          landmarks,
          cvReport,
          eyeAnalysis,
          photos,
        })
        let fullAfter = null
        let featureAfter = {}
        let afterUnaligned = null
        if (afterFullUrl) {
          try {
            fullAfter = await normalizeToJpegDataUrl(afterFullUrl)
          } catch {
            fullAfter = afterFullUrl
          }
          afterUnaligned = fullAfter
          featureAfter = await resolveAllFeatureAfterImages({
            featurePages: activeFeaturePages,
            afterFullUrl: fullAfter || afterFullUrl,
            beforeFullUrl: photoJpeg,
            landmarks,
            afterLandmarks,
            afterCvReport: afterCv?.cvReport || null,
            afterEyeAnalysis: afterCv?.eyeAnalysis || null,
            forPdf: false,
          })
          if (photoJpeg && fullAfter) {
            try {
              fullAfter = await alignAfterToBefore(photoJpeg, fullAfter)
            } catch (err) {
              console.warn('Overview AFTER align failed:', err)
            }
          }
        }
        let skinSplitAfter = null
        const skinBefore = features.skin?.before
        if (skinBefore && (afterUnaligned || featureAfter.skin)) {
          try {
            skinSplitAfter = await alignAfterToBefore(skinBefore, afterUnaligned || featureAfter.skin)
          } catch (err) {
            console.warn('[MyFace] Skin split AFTER align failed; using unaligned AFTER', err)
            skinSplitAfter = featureAfter.skin || afterUnaligned
          }
        }
        if (cancelled) return
        setImages({ fullBefore: photoJpeg, fullAfter, features, featureAfter, skinSplitAfter })
      } catch (err) {
        console.warn('Protocol image load failed:', err)
        if (!cancelled) {
          setImages({ fullBefore: photo, fullAfter: afterFullUrl, features: {}, featureAfter: {} })
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    loadImages()
    return () => {
      cancelled = true
    }
    // Image inputs only (no narrative text) — text edits must not retrigger image loads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photo, photos, landmarks, afterLandmarks, afterCv, cvReport, eyeAnalysis, afterFullUrl])

  if (!cvReport) {
    return <p className="text-sm text-ink-muted font-sans">Analysis data required for protocol report.</p>
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <Loader2 className="w-8 h-8 text-brand animate-spin" />
        <p className="text-ink-muted text-sm font-sans">Building aesthetic protocol report…</p>
      </div>
    )
  }

  const pages = [
    (
      <section
        key="cover"
        className="report-protocol-page report-view-a4-page report-protocol-dashboard-page"
      >
        <div className="report-protocol-dashboard-frame">
          <div className="report-protocol-dashboard-accent" aria-hidden />
          <div className="report-protocol-dashboard-header">
            <div className="report-protocol-dashboard-meta">
              <span className="report-protocol-dashboard-meta-label">{t('executiveSummary.protocolLabel')}</span>
              <span className="report-protocol-dashboard-meta-sep" aria-hidden />
              <span>{clientName}</span>
              <span>#{protocolId}</span>
            </div>
            <div className="report-protocol-dashboard-brand">
              <BrandLogo size="md" />
            </div>
          </div>
          <div className="report-protocol-dashboard-grid report-protocol-dashboard-grid--v2">
            <div className="report-protocol-dashboard-left">
              <NameProtocolPlate
                firstName={firstName}
                clientName={clientName}
                customerLabel={t('executiveSummary.namePlateCustomer')}
                protocolBrandLine={t('executiveSummary.namePlateProtocolBrand')}
                assessedLine={t('executiveSummary.namePlateAssessed', { date: reportDate })}
                className="mb-4"
              />
              <p className="text-[9px] font-bold text-ink mb-1.5 leading-tight">
                {t('executiveSummary.priorityFeatures')}
              </p>
              {(dash.miniCards || []).map((card) => {
                const localized = localizePriorityMiniCard(card, { tReport: t, tCv, locale })
                const findings = (localized.findings || []).filter((f) => f?.title)
                return (
                  <button
                    key={card.id}
                    type="button"
                    className="report-protocol-dashboard-mini-card report-protocol-dashboard-mini-card--link"
                    onClick={() => {
                      const el = document.querySelector(`[data-protocol-section="${card.id}"]`)
                      el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                    }}
                  >
                    <div className="flex items-baseline justify-between gap-1">
                      <p className="report-pdf-label font-bold text-ink min-w-0">{localized.title}</p>
                      {localized.score && <p className="report-pdf-label font-bold text-ink tabular-nums shrink-0">{localized.score}</p>}
                    </div>
                    {localized.scoreLabel && (
                      <p className="text-[6px] text-ink-muted text-right">{localized.scoreLabel}</p>
                    )}
                    {findings.length > 0 && (
                      <div className="report-protocol-dashboard-mini-lines">
                        {findings.map((finding, lineIdx) => (
                          <div key={lineIdx} className="report-protocol-dashboard-mini-finding flex justify-between gap-1">
                            <p className="report-protocol-dashboard-mini-finding-title min-w-0">
                              {finding.title}
                            </p>
                            <p className="report-protocol-dashboard-mini-finding-detail text-right shrink-0 whitespace-normal break-words">
                              {finding.detail || '—'}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
            <div className="report-protocol-dashboard-center">
              <div className="report-protocol-dashboard-pair">
                <div className="report-protocol-dashboard-photo">
                  {images.fullBefore && <img src={images.fullBefore} alt="" className="w-full h-full object-cover" />}
                  <span>{t('executiveSummary.before')}</span>
                </div>
                <div className="report-protocol-dashboard-photo report-protocol-dashboard-photo--potential">
                  {(images.fullAfter || images.fullBefore) && (
                    <img src={images.fullAfter || images.fullBefore} alt="" className="w-full h-full object-cover" />
                  )}
                  <span>{t('executiveSummary.potential')}</span>
                </div>
              </div>
              <div className="report-protocol-dashboard-panel report-protocol-dashboard-panel--age">
                <p className="report-pdf-label mb-3">{t('executiveSummary.facialAge')}</p>
                <FacialAgePanel
                  faceAge={dash.faceAge}
                  potentialAge={dash.potentialAge}
                  t={t}
                  compact
                />
              </div>
              <div className="report-protocol-dashboard-panel report-protocol-dashboard-panel--stack report-protocol-dashboard-panel--harmony shrink-0 mb-0">
                <p className="report-pdf-label mb-2">{t('executiveSummary.harmonyProfile')}</p>
                <div className="flex items-center justify-center px-1 py-3">
                  <DashboardRadarChart items={featureRadarItems} t={t} />
                </div>
              </div>
            </div>
            <div className="report-protocol-dashboard-right">
              <FeatureAnalysisHero
                photo={images.fullBefore || photo}
                alt={t('executiveSummary.originalAlt')}
                t={t}
                landmarks={landmarks}
                overallScore={dash.overallScore}
                evaluatedLabel={dash.evaluatedPoints
                  ? t('executiveSummary.kpiEvaluatedValue', { count: dash.evaluatedPoints })
                  : '—'}
                analysisTimeLabel={formatAnalysisTimeDays(dash.analysisTimeDays, t) || '—'}
                className="report-protocol-dashboard-hero mb-2"
                compact
                showMetrics={false}
                variant="analysisCard"
              />
              <div className="report-protocol-dashboard-panel report-protocol-dashboard-merkmals-card shrink-0 mb-0">
                <p className="report-protocol-dashboard-merkmals-title">
                  {t('executiveSummary.featureEvaluation')}
                </p>
                <ul className="report-protocol-dashboard-merkmals">
                  {featureHighlights.map((bullet, idx) => (
                    <li key={idx} className="report-protocol-dashboard-merkmals-item">
                      <span className="report-protocol-dashboard-merkmals-dot" aria-hidden />
                      <span className="report-protocol-dashboard-merkmals-text">
                        {truncateFeatureHighlightBullet(bullet)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
          <div className="report-protocol-dashboard-overview">
            <p className="report-pdf-label">{t('executiveSummary.overviewHeading')}</p>
            <p className="report-pdf-body-text">{overviewText || '—'}</p>
          </div>
          <div className="report-protocol-dashboard-footer">
            <span>{t('executiveSummary.footerBrand')}</span>
            <span>{t('executiveSummary.footerMetrics', { points: String(dash.evaluatedPoints || '—') })}</span>
          </div>
        </div>
      </section>
    ),
    (
      <SectionBlock
        key="disclaimer"
        splitTitle={{ primary: tPdf('disclaimer'), secondary: tPdf('policy') }}
        page={2}
      >
        <div className="report-pdf-disclaimer-stack">
          <div className="report-pdf-disclaimer-box">
            <h3 className="report-pdf-label">{tPdf('disclaimerPolicy')}</h3>
            <div className="report-pdf-body-stack">
              {DISCLAIMER_PARAGRAPH_KEYS.map((key, i) => (
                <p key={i} className="report-pdf-body-text">{t(key)}</p>
              ))}
            </div>
          </div>
          <div className="report-pdf-disclaimer-privacy">
            <h3 className="report-pdf-label">{tPdf('privacyPolicy')}</h3>
            <div className="report-pdf-body-stack">
              {PRIVACY_PARAGRAPH_KEYS.map((key, i) => (
                <p key={i} className="report-pdf-body-text">{t(key)}</p>
              ))}
            </div>
            <a
              href={PRIVACY_POLICY_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="report-pdf-privacy-link"
            >
              {tPdf('readPrivacyPrefix')} {tPdf('privacyLink')}
            </a>
          </div>
          <div className="report-pdf-disclaimer-company">
            <h3 className="report-pdf-label mb-1">{tPdf('companyName')}</h3>
            <p className="report-pdf-body-text text-ink-muted">
              {t('protocolModel.commissionedLine', { name: clientName, month })}
            </p>
          </div>
        </div>
      </SectionBlock>
    ),
    (
      <SectionBlock key="intro" title={t('protocolModel.introduction')} page={3}>
        <div className="report-pdf-intro-stack">
          <div className="report-pdf-cols report-pdf-cols--top report-pdf-cols--divider">
            <div className="report-pdf-body-stack">
              {INTRODUCTION_PARAGRAPH_KEYS.map((key, i) => (
                <p key={i} className="report-pdf-body-text">{t(key)}</p>
              ))}
            </div>
            <div>
              <p className="report-pdf-label mb-2">{t('protocolModel.contents')}</p>
              <ul className="report-pdf-toc">
                {contents.map((item) => (
                  <li key={item.label} className="report-pdf-toc-item">
                    <span className="report-pdf-body-text">{item.label}</span>
                    <span className="report-pdf-toc-page">{String(item.page).padStart(2, '0')}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div className="report-pdf-disclaimer-box report-pdf-intro-limitations">
            <h3 className="report-pdf-label">{t('protocolModel.limitationsLabel')}</h3>
            <p className="report-pdf-body-text">{t(LIMITATIONS_PARAGRAPH_KEY)}</p>
          </div>
        </div>
      </SectionBlock>
    ),
    (
      <SectionBlock
        key="understanding"
        splitTitle={{
          primary: t('protocolModel.understandingPrimary'),
          secondary: t('protocolModel.understandingSecondary'),
        }}
        page={4}
      >
        <ol className="space-y-3 mt-2">
          {UNDERSTANDING_RESULTS_KEYS.map((key, i) => (
            <li key={i} className="flex gap-3 font-sans">
              <span className="text-ink-muted font-semibold text-sm shrink-0 w-6">
                {String(i + 1).padStart(2, '0')}
              </span>
              <span className="report-pdf-body-text">{t(key)}</span>
            </li>
          ))}
        </ol>
      </SectionBlock>
    ),
    (
      <SectionBlock
        key="protocol"
        splitTitle={{
          primary: locale === 'de' ? clientName : `${clientName}'s`,
          secondary: t('protocolModel.protocolSecondary'),
        }}
        page={5}
        sectionId="overview"
      >
        <EditableText
          as="p"
          className="report-pdf-body-text mb-3 mt-1"
          value={rewriteToSubjectVoice(
            protocolNarrative?.summary || t('protocolModel.protocolLeadBefore')
          )}
          editable={editable && !!onEditOverview}
          onCommit={(value) => onEditOverview?.(value)}
        />
        <BeforeAfterPair
          beforeSrc={images.fullBefore}
          afterSrc={images.fullAfter}
          height={280}
        />
        <div className="report-pdf-cols mt-3">
          <div>
            <p className="report-pdf-label mb-2">{t('protocolModel.projectedPotential')}</p>
            <div className="grid grid-cols-2 gap-0.5 text-[10px] text-ink-secondary font-sans">
              {REPORT_PROTOCOL_FEATURES.map((f) => (
                <span key={f.id}>· {t(`protocolModel.featurePrimary.${f.id}`)}</span>
              ))}
            </div>
          </div>
          <DumbbellChart items={chartItems} t={t} />
        </div>
      </SectionBlock>
    ),
  ]

  const commitClosing = (index, value) => {
    const next = closingParagraphs.slice()
    next[index] = value
    onEditClosing?.(next.map((p) => (p || '').trim()).filter(Boolean))
  }

  const closingPage = (
    <SectionBlock
      key="closing"
      splitTitle={{
        primary: t('protocolModel.closingPrimary'),
        secondary: t('protocolModel.recommendations'),
      }}
      page={16}
      sectionId="closing"
      subtitle="Synthesised protocol guidance · Grounded with the subject's data"
    >
      <div className="report-pdf-cols report-pdf-cols--top relative">
        <div className="hidden sm:block absolute left-1/2 top-0 bottom-0 w-px bg-surface-border" />
        <div className="report-pdf-body-stack">
          {closingCols.left.map((para, i) => (
            <EditableText
              key={`l-${i}`}
              as="p"
              className="report-pdf-body-text"
              value={para}
              editable={editable && !!onEditClosing}
              onCommit={(value) => commitClosing(i, value)}
            />
          ))}
        </div>
        <div className="report-pdf-body-stack">
          {closingCols.right.map((para, i) => (
            <EditableText
              key={`r-${i}`}
              as="p"
              className="report-pdf-body-text"
              value={para}
              editable={editable && !!onEditClosing}
              onCommit={(value) => commitClosing(closingCols.left.length + i, value)}
            />
          ))}
        </div>
      </div>
      {!aiNarrative?.content && !protocolNarrative?.closing?.length && (
        <p className="text-[10px] text-amber-700 mt-3 font-sans">
          Configure OpenAI for richer per-feature narrative, or use admin AI narrative for closing copy.
        </p>
      )}
    </SectionBlock>
  )

  const paginatedPages = [...pages, closingPage]

  // Admin HTML review: skip the client-facing dashboard cover (PDF page 1); editors start at disclaimer + narrative pages.
  const frontPages = editable ? pages.slice(1) : pages

  if (paginated) {
    return <div className="report-protocol-document h-full">{paginatedPages[pageIndex] || paginatedPages[0]}</div>
  }

  return (
    <div className="report-protocol-document">
      {frontPages}

      {featurePages.map((page) => {
        const reportMeta = REPORT_PROTOCOL_FEATURES.find((f) => f.id === page.id)
        return (
          <FeaturePageHtml
            key={page.id}
            page={page}
            images={images}
            answers={answers}
            pageNum={reportMeta?.page}
            treatment={page.id === 'skin' ? treatment : null}
            editable={editable}
            onEditFeatureSubsection={onEditFeatureSubsection}
            onEditFeatureSummary={onEditFeatureSummary}
          />
        )
      })}

      {closingPage}
    </div>
  )
}
