'use client'

import { useTranslations } from 'next-intl'
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
  DISCLAIMER_PARAGRAPH_KEYS,
  formatProtocolEditionLabel,
  formatProtocolMonth,
  getClientName,
  getFeatureComparisonData,
  INTRODUCTION_PARAGRAPH_KEYS,
  LIMITATIONS_PARAGRAPH_KEY,
  PRIVACY_PARAGRAPH_KEYS,
  QOVES_PROTOCOL_FEATURES,
  UNDERSTANDING_RESULTS_KEYS,
  rewriteToSubjectVoice,
} from '../../utils/qovesProtocolModel'

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
      className={`${className} qoves-editable`}
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
  return (
    <section
      className={`qoves-protocol-page qoves-report-a4-page ${cover ? 'qoves-report-a4-page--cover' : ''}`}
      {...(sectionId ? { 'data-protocol-section': sectionId } : {})}
    >
      {!cover && <div className="qoves-pdf-brand-bar" aria-hidden />}
      <div className={`qoves-report-a4-inner ${cover ? '' : 'qoves-report-a4-inner--pdf'}`}>
        {!cover && page != null && (
          <header className="qoves-pdf-page-header">
            <span className="qoves-pdf-brand">MYFACE</span>
            <span className="qoves-pdf-page-num">
              <span className="qoves-pdf-page-prefix">PAGE / </span>
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
    <h2 className="qoves-pdf-split-title">
      <span className="qoves-pdf-split-primary">{primary}</span>
      {secondary ? <span className="qoves-pdf-split-secondary">{secondary}</span> : null}
    </h2>
  )
}

function SectionBlock({ title, subtitle, page, sectionId, children, splitTitle }) {
  return (
    <PdfPageShell page={page} sectionId={sectionId}>
      {splitTitle ? (
        <PdfSplitTitle primary={splitTitle.primary} secondary={splitTitle.secondary} />
      ) : (
        <h2 className="qoves-pdf-split-title">
          <span className="qoves-pdf-split-primary">{title}</span>
        </h2>
      )}
      {subtitle && <p className="qoves-pdf-subtitle">{subtitle}</p>}
      {children}
    </PdfPageShell>
  )
}

function ImageFrame({
  src,
  tag,
  emptyLabel = 'Projected image pending',
  height,
  className = '',
  cover = true,
}) {
  return (
    <div
      className={`qoves-pdf-image-frame ${className}`}
      style={height != null ? { height } : undefined}
    >
      {src ? (
        <img
          src={src}
          alt={tag || 'Feature'}
          className={cover ? 'object-cover' : 'object-contain'}
        />
      ) : (
        <span className="qoves-pdf-image-empty">{emptyLabel}</span>
      )}
      {tag && <span className="qoves-pdf-image-tag">{tag}</span>}
    </div>
  )
}

function BeforeAfterPair({ beforeSrc, afterSrc = null, stacked = false, height = 120 }) {
  if (stacked) {
    return (
      <div className="qoves-pdf-ba-stack">
        <ImageFrame src={beforeSrc} tag="BEFORE" height={height} />
        <ImageFrame src={afterSrc} tag="AFTER" height={height} />
      </div>
    )
  }
  return (
    <div className="qoves-pdf-ba-row">
      <ImageFrame src={beforeSrc} tag="BEFORE" height={height} />
      <ImageFrame src={afterSrc} tag="AFTER" height={height} />
    </div>
  )
}

function LabeledBody({ title, body, evidenceTier, editable = false, onCommit }) {
  if (!title && body == null && !editable) return null
  return (
    <div className="qoves-pdf-labeled-body">
      {title ? <h3 className="qoves-pdf-label">{title}</h3> : null}
      {body != null || editable ? (
        <EditableText
          as="p"
          className="qoves-pdf-body-text"
          value={body || ''}
          editable={editable}
          onCommit={onCommit}
        />
      ) : null}
      {evidenceTier && EVIDENCE_TIER_LABELS[evidenceTier] && (
        <p className="qoves-pdf-tier">Recommendation tier: {EVIDENCE_TIER_LABELS[evidenceTier]}</p>
      )}
    </div>
  )
}

function DumbbellChart({ items }) {
  const trackW = 140
  return (
    <div className="space-y-1.5">
      {items.map((item) => {
        const cx = (item.score / 100) * trackW
        const px = (item.projected / 100) * trackW
        return (
          <div key={item.label} className="flex items-center gap-3 text-[10px] font-sans">
            <span className="w-14 shrink-0 text-ink-secondary">{item.label}</span>
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
          <span className="w-2 h-2 rounded-full bg-slate-600" /> Client Values
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-brand" /> Projected Potential
        </span>
      </div>
    </div>
  )
}

/** Match jsPDF drawSummaryCard — dark column card. */
function SummaryCard({ title, summary, editable = false, onCommit }) {
  return (
    <div className="qoves-pdf-summary-card">
      <p className="qoves-pdf-summary-title">{title}</p>
      <EditableText
        as="p"
        className="qoves-pdf-summary-body"
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
    <div className="qoves-pdf-summary-bar">
      <p className="qoves-pdf-summary-title">{title}</p>
      <EditableText
        as="p"
        className="qoves-pdf-summary-body"
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
  const pair = images.features[page.id] || {}
  const slots = pair.slots || {}
  const beforeSrc = slots.pairBefore || pair.before || images.fullBefore
  const pageAfterSrc = images.featureAfter?.[page.id] || images.fullAfter
  const previewSrc = slots.preview || pair.before || images.fullBefore
  const profileSrc = pair.profile && pair.profileIsReal ? pair.profile : null
  const subs = page.subsections || []
  const summaryTitle = `${page.title.replace(' Recommendations', '')} Summary`
  const titleParts = page.title.replace(' Recommendations', '').split(' ')
  const primary = titleParts[0] || page.title
  const secondary = 'Recommendations'

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
        <PdfSplitTitle primary="Eye" secondary={secondary} />
        <div className="qoves-pdf-cols qoves-pdf-cols--top">
          <LabeledBody title="Eyebrows" body={subs[0]?.body} evidenceTier={subs[0]?.evidenceTier} {...bodyEdit('Eyebrows')} />
          <LabeledBody title="Eyelashes" body={subs[1]?.body} evidenceTier={subs[1]?.evidenceTier} {...bodyEdit('Eyelashes')} />
        </div>
        <div className="qoves-pdf-block">
          <BeforeAfterPair beforeSrc={beforeSrc} afterSrc={pageAfterSrc} height={130} />
        </div>
        <div className="qoves-pdf-cols">
          <LabeledBody title="Eyes" body={subs[2]?.body} evidenceTier={subs[2]?.evidenceTier} {...bodyEdit('Eyes')} />
          <LabeledBody title="Under eye" body={subs[3]?.body} evidenceTier={subs[3]?.evidenceTier} {...bodyEdit('Under eye')} />
        </div>
        <div className="qoves-pdf-cols qoves-pdf-cols--bottom">
          <ImageFrame src={slots.preview || previewSrc} tag="EYES" height={110} cover={false} />
          <SummaryCard title="Eye Region Summary" summary={page.summary} {...summaryEdit} />
        </div>
      </PdfPageShell>
    )
  }

  if (page.id === 'nose') {
    return (
      <PdfPageShell page={pageNum} sectionId={page.id}>
        <PdfSplitTitle primary="Nose" secondary={secondary} />
        <div className="qoves-pdf-cols qoves-pdf-feature-fill">
          <LabeledBody title="Nose" body={subs[0]?.body} evidenceTier={subs[0]?.evidenceTier} {...bodyEdit('Nose')} />
          <div className="qoves-pdf-col-stack">
            {profileSrc && <ImageFrame src={profileSrc} tag="PROFILE" height={300} />}
            <BeforeAfterPair beforeSrc={beforeSrc} afterSrc={pageAfterSrc} height={120} />
            <SummaryCard title="Nose Summary" summary={page.summary} {...summaryEdit} />
          </div>
        </div>
      </PdfPageShell>
    )
  }

  if (page.id === 'hair') {
    return (
      <PdfPageShell page={pageNum} sectionId={page.id}>
        <PdfSplitTitle primary="Hair" secondary={secondary} />
        <div className="qoves-pdf-cols">
          <div>
            {subs[0] && (
              <LabeledBody title={subs[0].title} body={subs[0].body} evidenceTier={subs[0].evidenceTier} {...bodyEdit(subs[0].title)} />
            )}
          </div>
          <div className="qoves-pdf-col-stack">
            <ImageFrame src={beforeSrc} tag="BEFORE" height={120} />
            <ImageFrame src={pageAfterSrc} tag="AFTER" height={120} />
          </div>
        </div>
        {subs[1] && (
          <div className="qoves-pdf-block">
            <LabeledBody title={subs[1].title} body={subs[1].body} evidenceTier={subs[1].evidenceTier} {...bodyEdit(subs[1].title)} />
          </div>
        )}
        <div className="qoves-pdf-cols qoves-pdf-cols--bottom">
          <div>
            {subs[2] && (
              <LabeledBody title={subs[2].title} body={subs[2].body} evidenceTier={subs[2].evidenceTier} {...bodyEdit(subs[2].title)} />
            )}
          </div>
          <SummaryCard title="Hair Summary" summary={page.summary} {...summaryEdit} />
        </div>
      </PdfPageShell>
    )
  }

  if (page.id === 'cheeks') {
    const analysisSrc = slots.analysis || pair.before || beforeSrc
    return (
      <PdfPageShell page={pageNum} sectionId={page.id}>
        <PdfSplitTitle primary="Cheek" secondary={secondary} />
        <div className="qoves-pdf-cols">
          <LabeledBody title="Cheek Structure" body={subs[0]?.body} evidenceTier={subs[0]?.evidenceTier} {...bodyEdit('Cheek Structure')} />
          <ImageFrame src={analysisSrc} tag="ANALYSIS" height={180} />
        </div>
        <div className="qoves-pdf-block">
          <BeforeAfterPair beforeSrc={beforeSrc} afterSrc={pageAfterSrc} height={180} />
        </div>
        <SummaryBar title="Cheek Region Summary" summary={page.summary} {...summaryEdit} />
      </PdfPageShell>
    )
  }

  if (page.id === 'jaw') {
    return (
      <PdfPageShell page={pageNum} sectionId={page.id}>
        <PdfSplitTitle primary="Jaw" secondary={secondary} />
        <div className="qoves-pdf-cols">
          <LabeledBody title="Jaw Structure" body={subs[0]?.body} evidenceTier={subs[0]?.evidenceTier} {...bodyEdit('Jaw Structure')} />
          <ImageFrame src={profileSrc || beforeSrc} tag="PROFILE" height={300} />
        </div>
        <div className="qoves-pdf-block">
          <BeforeAfterPair beforeSrc={beforeSrc} afterSrc={pageAfterSrc} height={150} />
        </div>
        <div className="qoves-pdf-cols qoves-pdf-cols--bottom">
          <LabeledBody title="Further Enhancement" body={subs[1]?.body} evidenceTier={subs[1]?.evidenceTier} {...bodyEdit('Further Enhancement')} />
          <SummaryCard title="Jaw Region Summary" summary={page.summary} {...summaryEdit} />
        </div>
      </PdfPageShell>
    )
  }

  if (page.id === 'lips') {
    return (
      <PdfPageShell page={pageNum} sectionId={page.id}>
        <PdfSplitTitle primary="Lip" secondary={secondary} />
        <div className="qoves-pdf-cols">
          <LabeledBody title="Lip" body={subs[0]?.body} evidenceTier={subs[0]?.evidenceTier} {...bodyEdit('Lips')} />
          <ImageFrame src={previewSrc} tag="LIPS" height={249} />
        </div>
        <div className="qoves-pdf-block">
          <BeforeAfterPair beforeSrc={beforeSrc} afterSrc={pageAfterSrc} height={200} />
        </div>
        <SummaryBar title="Lips Summary" summary={page.summary} {...summaryEdit} />
      </PdfPageShell>
    )
  }

  if (page.id === 'neck') {
    return (
      <PdfPageShell page={pageNum} sectionId={page.id}>
        <PdfSplitTitle primary="Neck" secondary={secondary} />
        <div className="qoves-pdf-cols qoves-pdf-feature-fill">
          <div className="qoves-pdf-col-stack">
            <LabeledBody title="Neck Size" body={subs[0]?.body} evidenceTier={subs[0]?.evidenceTier} {...bodyEdit('Neck Size')} />
            <LabeledBody title="Neck Skin" body={subs[1]?.body} evidenceTier={subs[1]?.evidenceTier} {...bodyEdit('Neck Skin')} />
            <SummaryCard title="Neck Summary" summary={page.summary} {...summaryEdit} />
          </div>
          <div className="qoves-pdf-col-stack">
            <ImageFrame src={beforeSrc} tag="BEFORE" height={240} />
            <ImageFrame src={pageAfterSrc} tag="AFTER" height={240} />
          </div>
        </div>
      </PdfPageShell>
    )
  }

  if (page.id === 'ears') {
    return (
      <PdfPageShell page={pageNum} sectionId={page.id}>
        <PdfSplitTitle primary="Ear" secondary={secondary} />
        <div className="qoves-pdf-cols qoves-pdf-feature-fill">
          <div className="qoves-pdf-col-stack">
            {subs.map((sub) => (
              <LabeledBody key={sub.title} title={sub.title} body={sub.body} evidenceTier={sub.evidenceTier} {...bodyEdit(sub.title)} />
            ))}
            <SummaryCard title="Ear Summary" summary={page.summary} {...summaryEdit} />
          </div>
          <div className="qoves-pdf-col-stack">
            <ImageFrame src={beforeSrc} tag="BEFORE" height={220} />
            <ImageFrame src={pageAfterSrc} tag="AFTER" height={220} />
          </div>
        </div>
      </PdfPageShell>
    )
  }

  // Default / skin / chin — two-col PDF-like: text left, images + summary right
  return (
    <PdfPageShell page={pageNum}>
      <PdfSplitTitle primary={primary} secondary={secondary} />
      <div className="qoves-pdf-cols qoves-pdf-feature-fill">
        <div className="qoves-pdf-col-stack">
          {subs.map((sub) => (
            <LabeledBody key={sub.title} title={sub.title} body={sub.body} evidenceTier={sub.evidenceTier} {...bodyEdit(sub.title)} />
          ))}
        </div>
        <div className="qoves-pdf-col-stack">
          {page.layoutHints?.profileImage && profileSrc && (
            <ImageFrame src={profileSrc} tag="PROFILE" height={200} />
          )}
          {page.id === 'skin' && (slots.analysis || pair.before) && (
            <ImageFrame src={slots.analysis || pair.before} tag="ANALYSIS" height={160} />
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

export default function QovesProtocolReport({
  photo,
  photos,
  landmarks,
  cvReport,
  metrics,
  answers,
  user = null,
  eyeAnalysis,
  protocolNarrative,
  aiNarrative,
  projectedAfter = null,
  projectedAnalysis = null,
  pageIndex = 0,
  paginated = false,
  editable = false,
  onEditFeatureSubsection,
  onEditFeatureSummary,
  onEditClosing,
  onEditOverview,
}) {
  const t = useTranslations('Report')
  const clientName = getClientName(answers, user)
  const edition = formatProtocolEditionLabel()
  const month = formatProtocolMonth()
  const featurePages = useMemo(
    () => buildFeaturePages(cvReport, eyeAnalysis, protocolNarrative),
    [cvReport, eyeAnalysis, protocolNarrative]
  )
  // Latest pages for the image loader without retriggering reloads on text edits.
  const featurePagesRef = useRef(featurePages)
  featurePagesRef.current = featurePages
  const contents = useMemo(() => buildProtocolContents(clientName), [clientName])
  const closingParagraphs = useMemo(
    () => buildClosingRecommendations(aiNarrative, cvReport, clientName, protocolNarrative),
    [aiNarrative, cvReport, clientName, protocolNarrative]
  )
  const closingCols = useMemo(() => buildClosingColumns(closingParagraphs), [closingParagraphs])
  const chartItems = useMemo(() => getFeatureComparisonData(cvReport), [cvReport])
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
        className="qoves-protocol-page qoves-report-a4-page qoves-report-a4-page--cover"
      >
        <div className="qoves-report-a4-inner flex flex-col justify-between h-full text-white">
          <div>
            <p className="text-[10px] uppercase tracking-[0.25em] text-white/60 mb-10">MyFace</p>
            <p className="text-sm text-white/80 mb-6">{clientName}</p>
            <h1 className="font-display text-4xl sm:text-5xl font-semibold leading-tight">
              Aesthetic <span className="text-white/50 font-normal">Protocol</span>
            </h1>
            <p className="text-xs uppercase tracking-[0.2em] text-white/50 mt-4">
              Edition · {edition}
            </p>
          </div>
          <p className="text-xs text-white/40">Measurement-guided aesthetic protocol</p>
        </div>
      </section>
    ),
    (
      <SectionBlock key="disclaimer" splitTitle={{ primary: 'Disclaimer', secondary: 'Policy' }} page={2}>
        <div className="qoves-pdf-cols qoves-pdf-cols--top">
          <div>
            <h3 className="qoves-pdf-label">Disclaimer Policy</h3>
            <div className="qoves-pdf-body-stack">
              {DISCLAIMER_PARAGRAPH_KEYS.map((key, i) => (
                <p key={i} className="qoves-pdf-body-text">{t(key)}</p>
              ))}
            </div>
          </div>
          <div>
            <h3 className="qoves-pdf-label">Privacy Policy</h3>
            <div className="qoves-pdf-body-stack">
              {PRIVACY_PARAGRAPH_KEYS.map((key, i) => (
                <p key={i} className="qoves-pdf-body-text">{t(key)}</p>
              ))}
            </div>
          </div>
        </div>
        <p className="qoves-pdf-tier mt-4">
          The following report was commissioned for <strong>{clientName}</strong> on {month}.
        </p>
      </SectionBlock>
    ),
    (
      <SectionBlock key="intro" title="Introduction" page={3}>
        <div className="qoves-pdf-cols qoves-pdf-cols--top">
          <div className="qoves-pdf-body-stack">
            {INTRODUCTION_PARAGRAPH_KEYS.map((key, i) => (
              <p key={i} className="qoves-pdf-body-text">{t(key)}</p>
            ))}
            <div>
              <h3 className="qoves-pdf-label">Limitations</h3>
              <p className="qoves-pdf-body-text">{t(LIMITATIONS_PARAGRAPH_KEY)}</p>
            </div>
          </div>
          <div>
            <p className="qoves-pdf-label mb-2">Contents</p>
            <ul className="space-y-1.5 font-sans">
              {contents.map((item) => (
                <li key={item.label} className="flex justify-between gap-4 border-b border-surface-border/60 pb-1.5">
                  <span className="qoves-pdf-body-text">{item.label}</span>
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
        splitTitle={{ primary: 'Understanding', secondary: 'the Results' }}
        page={4}
      >
        <ol className="space-y-3 mt-2">
          {UNDERSTANDING_RESULTS_KEYS.map((key, i) => (
            <li key={i} className="flex gap-3 font-sans">
              <span className="text-ink-muted font-semibold text-sm shrink-0 w-6">
                {String(i + 1).padStart(2, '0')}
              </span>
              <span className="qoves-pdf-body-text">{t(key)}</span>
            </li>
          ))}
        </ol>
      </SectionBlock>
    ),
    (
      <SectionBlock
        key="protocol"
        splitTitle={{ primary: `${clientName}'s`, secondary: 'Protocol' }}
        page={5}
        sectionId="overview"
      >
        <EditableText
          as="p"
          className="qoves-pdf-body-text mb-3 mt-1"
          value={rewriteToSubjectVoice(
            protocolNarrative?.summary ||
              "This evidence-based protocol is grounded in the subject's measured facial analysis, organised around 11 key features for facial aesthetics."
          )}
          editable={editable && !!onEditOverview}
          onCommit={(value) => onEditOverview?.(value)}
        />
        <BeforeAfterPair
          beforeSrc={images.fullBefore}
          afterSrc={images.fullAfter}
          height={280}
        />
        <div className="qoves-pdf-cols mt-3">
          <div>
            <p className="qoves-pdf-label mb-2">Projected potential · 11 key features</p>
            <div className="grid grid-cols-2 gap-0.5 text-[10px] text-ink-secondary font-sans">
              {QOVES_PROTOCOL_FEATURES.map((f) => (
                <span key={f.id}>· {f.title}</span>
              ))}
            </div>
          </div>
          <DumbbellChart items={chartItems} />
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
      splitTitle={{ primary: 'Closing', secondary: 'Recommendations' }}
      page={16}
      sectionId="closing"
      subtitle="Synthesised protocol guidance · Grounded with the subject's data"
    >
      <div className="qoves-pdf-cols qoves-pdf-cols--top relative">
        <div className="hidden sm:block absolute left-1/2 top-0 bottom-0 w-px bg-surface-border" />
        <div className="qoves-pdf-body-stack">
          {closingCols.left.map((para, i) => (
            <EditableText
              key={`l-${i}`}
              as="p"
              className="qoves-pdf-body-text"
              value={para}
              editable={editable && !!onEditClosing}
              onCommit={(value) => commitClosing(i, value)}
            />
          ))}
        </div>
        <div className="qoves-pdf-body-stack">
          {closingCols.right.map((para, i) => (
            <EditableText
              key={`r-${i}`}
              as="p"
              className="qoves-pdf-body-text"
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

  if (paginated) {
    return <div className="qoves-protocol-document h-full">{paginatedPages[pageIndex] || paginatedPages[0]}</div>
  }

  return (
    <div className="qoves-protocol-document">
      {pages}

      {featurePages.map((page) => {
        const qovesMeta = QOVES_PROTOCOL_FEATURES.find((f) => f.id === page.id)
        return (
          <FeaturePageHtml
            key={page.id}
            page={page}
            images={images}
            pageNum={qovesMeta?.page}
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
