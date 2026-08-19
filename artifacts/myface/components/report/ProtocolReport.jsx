'use client'

import { useLocale, useTranslations } from 'next-intl'
import { useEffect, useMemo, useRef, useState } from 'react'
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
  REPORT_PROTOCOL_FEATURES,
  UNDERSTANDING_RESULTS_KEYS,
  rewriteToSubjectVoice,
  resolveTreatmentPhases,
} from '../../utils/reportProtocolModel'
import { BrandLogo } from '../BrandLogo'
import { FeatureAnalysisHero } from './FeaturePreviewPortrait'
import { NameProtocolPlate } from './NameProtocolPlate'
import { TreatmentProtocolPhases } from './TreatmentProtocolPhases'
import { FacialAgePanel } from './FacialAgePanel'
import { localizePriorityMiniCard } from '../../utils/cvReportLocale'

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
function EditableText({ as: Tag = 'p', value = '', editable = false, onCommit, className = '' }) {
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
      onBlur={(e) => {
        const next = e.currentTarget.innerText
          .replace(/\u00a0/g, ' ')
          .replace(/\n{3,}/g, '\n\n')
          .trimEnd()
        if (next !== (value || '')) onCommit(next)
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

/** Match jsPDF drawSummaryCard — dark column card. */
function SummaryCard({ title, summary, editable = false, onCommit }) {
  return (
    <div className="report-pdf-summary-card">
      <p className="report-pdf-summary-title">{title}</p>
      <EditableText
        as="p"
        className="report-pdf-summary-body"
        value={summary || ''}
        editable={editable}
        onCommit={onCommit}
      />
    </div>
  )
}

/** Match jsPDF drawSummaryBar — full-width dark bar. */
function SummaryBar({ title, summary, editable = false, onCommit }) {
  return (
    <div className="report-pdf-summary-bar">
      <p className="report-pdf-summary-title">{title}</p>
      <EditableText
        as="p"
        className="report-pdf-summary-body"
        value={summary || ''}
        editable={editable}
        onCommit={onCommit}
      />
    </div>
  )
}

/**
 * Per-feature HTML layouts mirrored from reportPdf.js draw*FeaturePage.
 * Structure/image placement must stay in sync with PDF.
 */
function FeaturePageHtml({ page, images, pageNum, editable = false, onEditFeatureSubsection, onEditFeatureSummary }) {
  const t = useTranslations('Report.protocolModel')
  const pair = images.features[page.id] || {}
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
        <div className="report-pdf-cols report-pdf-feature-fill">
          <LabeledBody title="Nose" displayTitle={subLabel('Nose')} body={subs[0]?.body} evidenceTier={subs[0]?.evidenceTier} {...bodyEdit('Nose')} />
          <div className="report-pdf-col-stack">
            {profileSrc && <ImageFrame src={profileSrc} tag={t('tagProfile')} height={300} />}
            <BeforeAfterPair beforeSrc={beforeSrc} afterSrc={pageAfterSrc} height={120} />
            <SummaryCard title={summaryTitle} summary={page.summary} {...summaryEdit} />
          </div>
        </div>
      </PdfPageShell>
    )
  }

  if (page.id === 'hair') {
    return (
      <PdfPageShell page={pageNum} sectionId={page.id}>
        <PdfSplitTitle primary={primary} secondary={secondary} />
        <div className="report-pdf-cols">
          <div>
            {subs[0] && (
              <LabeledBody title={subs[0].title} displayTitle={subLabel(subs[0].title)} body={subs[0].body} evidenceTier={subs[0].evidenceTier} {...bodyEdit(subs[0].title)} />
            )}
          </div>
          <div className="report-pdf-col-stack">
            <ImageFrame src={beforeSrc} tag={t('tagBefore')} height={120} />
            <ImageFrame src={pageAfterSrc} tag={t('tagAfter')} height={120} />
          </div>
        </div>
        {subs[1] && (
          <div className="report-pdf-block">
            <LabeledBody title={subs[1].title} displayTitle={subLabel(subs[1].title)} body={subs[1].body} evidenceTier={subs[1].evidenceTier} {...bodyEdit(subs[1].title)} />
          </div>
        )}
        <div className="report-pdf-cols report-pdf-cols--bottom report-pdf-cols--bottom-anchor">
          <div className="report-pdf-bottom-left">
            {subs[2] && (
              <LabeledBody title={subs[2].title} displayTitle={subLabel(subs[2].title)} body={subs[2].body} evidenceTier={subs[2].evidenceTier} {...bodyEdit(subs[2].title)} />
            )}
          </div>
          <SummaryCard title={summaryTitle} summary={page.summary} {...summaryEdit} />
        </div>
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
        <div className="report-pdf-cols">
          <LabeledBody title="Jaw Structure" displayTitle={subLabel('Jaw Structure')} body={subs[0]?.body} evidenceTier={subs[0]?.evidenceTier} {...bodyEdit('Jaw Structure')} />
          <ImageFrame src={profileSrc || beforeSrc} tag={t('tagProfile')} height={300} />
        </div>
        <div className="report-pdf-block">
          <BeforeAfterPair beforeSrc={beforeSrc} afterSrc={pageAfterSrc} height={150} />
        </div>
        <div className="report-pdf-cols report-pdf-cols--bottom report-pdf-cols--bottom-anchor">
          <div className="report-pdf-bottom-left">
            <LabeledBody title="Further Enhancement" displayTitle={subLabel('Further Enhancement')} body={subs[1]?.body} evidenceTier={subs[1]?.evidenceTier} {...bodyEdit('Further Enhancement')} />
          </div>
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
          <ImageFrame src={previewSrc} tag={t('tagLips')} height={249} />
        </div>
        <div className="report-pdf-block">
          <BeforeAfterPair beforeSrc={beforeSrc} afterSrc={pageAfterSrc} height={200} />
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
            <SummaryCard title={summaryTitle} summary={page.summary} {...summaryEdit} />
          </div>
          <div className="report-pdf-col-stack">
            <ImageFrame src={beforeSrc} tag={t('tagBefore')} height={240} />
            <ImageFrame src={pageAfterSrc} tag={t('tagAfter')} height={240} />
          </div>
        </div>
      </PdfPageShell>
    )
  }

  if (page.id === 'ears') {
    return (
      <PdfPageShell page={pageNum} sectionId={page.id}>
        <PdfSplitTitle primary={primary} secondary={secondary} />
        <div className="report-pdf-cols report-pdf-feature-fill">
          <div className="report-pdf-col-stack">
            {subs.map((sub) => (
              <LabeledBody key={sub.title} title={sub.title} displayTitle={subLabel(sub.title)} body={sub.body} evidenceTier={sub.evidenceTier} {...bodyEdit(sub.title)} />
            ))}
            <SummaryCard title={summaryTitle} summary={page.summary} {...summaryEdit} />
          </div>
          <div className="report-pdf-col-stack">
            <ImageFrame src={beforeSrc} tag={t('tagBefore')} height={220} />
            <ImageFrame src={pageAfterSrc} tag={t('tagAfter')} height={220} />
          </div>
        </div>
      </PdfPageShell>
    )
  }

  // Default / skin / chin — two-col PDF-like: text left, images + summary right
  return (
    <PdfPageShell page={pageNum}>
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
            stacked={Boolean(page.layoutHints?.stackedImages && page.id !== 'skin' && page.id !== 'chin')}
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
  const dash = useMemo(
    () => buildProtocolDashboardData({
      cvReport, metrics, answers, eyeAnalysis, createdAt, updatedAt,
    }),
    [cvReport, metrics, answers, eyeAnalysis, createdAt, updatedAt],
  )
  const protocolId = formatProtocolId(assessmentId)
  const firstName = clientName.split(/\s+/)[0] || clientName
  const overviewText = protocolNarrative?.summary || aiNarrative?.content?.summary || null
  const treatment = useMemo(
    () => resolveTreatmentPhases({ protocolNarrative, dash, t }),
    [protocolNarrative, dash, t],
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
        if (afterFullUrl) {
          try {
            fullAfter = await normalizeToJpegDataUrl(afterFullUrl)
          } catch {
            fullAfter = afterFullUrl
          }
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
        if (cancelled) return
        setImages({ fullBefore: photoJpeg, fullAfter, features, featureAfter })
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
          <div className="report-protocol-dashboard-kpis">
            {[
              [t('executiveSummary.kpiOverallScore'), dash.overallScore != null ? `${dash.overallScore} / 100` : '—'],
              [t('executiveSummary.kpiEvaluated'), dash.evaluatedPoints
                ? t('executiveSummary.kpiEvaluatedValue', { count: dash.evaluatedPoints })
                : '—'],
              [t('executiveSummary.kpiAnalysisTime'), formatAnalysisTimeDays(dash.analysisTimeDays, t) || '—'],
            ].map(([label, value]) => (
              <div key={label} className="report-protocol-dashboard-kpi">
                <p className="report-pdf-label">{label}</p>
                <p className="report-protocol-dashboard-kpi-value">{value}</p>
              </div>
            ))}
          </div>
          <div className="report-protocol-dashboard-grid">
            <div className="report-protocol-dashboard-left">
              <NameProtocolPlate
                firstName={firstName}
                clientName={clientName}
                protocolLine={t('executiveSummary.protocolIdLine', { id: protocolId })}
                assessedLine={t('executiveSummary.namePlateAssessed', { date: reportDate })}
                scoreLine={dash.overallScore != null
                  ? t('executiveSummary.namePlateOverallScore', { score: dash.overallScore })
                  : null}
                className="mb-2"
              />
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
                className="report-protocol-dashboard-hero mb-3"
                compact
              />
                    <p className="report-pdf-label font-bold text-ink mb-0.5">{t('executiveSummary.priorityFeatures')}</p>
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
              <div className="report-protocol-dashboard-panel">
                <p className="report-pdf-label">{t('executiveSummary.facialAge')}</p>
                <FacialAgePanel faceAge={dash.faceAge} t={t} compact />
              </div>
              <div className="report-protocol-dashboard-center-stack">
                <div className="report-protocol-dashboard-panel report-protocol-dashboard-panel--stack">
                  <p className="report-pdf-label">{t('executiveSummary.harmonyProfile')}</p>
                  <p className="report-pdf-body-text text-center text-ink-muted">—</p>
                </div>
                <div className="report-protocol-dashboard-panel report-protocol-dashboard-panel--stack">
                  <p className="report-pdf-label">{t('executiveSummary.overviewHeading')}</p>
                  <p className="report-pdf-body-text">{overviewText || '—'}</p>
                </div>
                <div className="report-protocol-dashboard-panel report-protocol-dashboard-panel--stack">
                  <p className="report-pdf-label">{t('executiveSummary.featureEvaluation')}</p>
                  <p className="report-pdf-body-text text-ink-muted">—</p>
                </div>
              </div>
            </div>
            <div className="report-protocol-dashboard-right">
              <TreatmentProtocolPhases
                title={t('executiveSummary.treatmentProtocol')}
                phases={treatment.phases}
                summary={treatment.summary}
                className="report-protocol-dashboard-phases"
              />
            </div>
          </div>
          <div className="report-protocol-dashboard-footer">
            <span>—</span>
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
        <div className="report-pdf-cols report-pdf-cols--top">
          <div>
            <h3 className="report-pdf-label">{tPdf('disclaimerPolicy')}</h3>
            <div className="report-pdf-body-stack">
              {DISCLAIMER_PARAGRAPH_KEYS.map((key, i) => (
                <p key={i} className="report-pdf-body-text">{t(key)}</p>
              ))}
            </div>
          </div>
          <div>
            <h3 className="report-pdf-label">{t('protocolModel.privacyPolicy')}</h3>
            <div className="report-pdf-body-stack">
              {PRIVACY_PARAGRAPH_KEYS.map((key, i) => (
                <p key={i} className="report-pdf-body-text">{t(key)}</p>
              ))}
            </div>
          </div>
        </div>
        <p className="report-pdf-tier mt-4">
          {t('protocolModel.commissionedLine', { name: clientName, month })}
        </p>
      </SectionBlock>
    ),
    (
      <SectionBlock key="intro" title={t('protocolModel.introduction')} page={3}>
        <div className="report-pdf-cols report-pdf-cols--top">
          <div className="report-pdf-body-stack">
            {INTRODUCTION_PARAGRAPH_KEYS.map((key, i) => (
              <p key={i} className="report-pdf-body-text">{t(key)}</p>
            ))}
            <div>
              <h3 className="report-pdf-label">{t('protocolModel.limitationsLabel')}</h3>
              <p className="report-pdf-body-text">{t(LIMITATIONS_PARAGRAPH_KEY)}</p>
            </div>
          </div>
          <div>
            <p className="report-pdf-label mb-2">{t('protocolModel.contents')}</p>
            <ul className="space-y-1.5 font-sans">
              {contents.map((item) => (
                <li key={item.label} className="flex justify-between gap-4 border-b border-surface-border/60 pb-1.5">
                  <span className="report-pdf-body-text">{item.label}</span>
                  <span className="text-[10px] text-ink-muted tabular-nums">{String(item.page).padStart(2, '0')}</span>
                </li>
              ))}
            </ul>
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
            pageNum={reportMeta?.page}
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
