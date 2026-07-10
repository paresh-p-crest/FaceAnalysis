import { useEffect, useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { normalizeToJpegDataUrl } from '../../utils/aestheticProjection'
import { resolveAllFeatureImages } from '../../utils/protocolFeatureImages'
import {
  buildClosingColumns,
  buildClosingRecommendations,
  buildFeaturePages,
  buildProtocolContents,
  DISCLAIMER_PARAGRAPHS,
  formatProtocolEditionDate,
  formatProtocolMonth,
  getClientName,
  getFeatureComparisonData,
  INTRODUCTION_PARAGRAPHS,
  LIMITATIONS_PARAGRAPH,
  PRIVACY_PARAGRAPHS,
  QOVES_PROTOCOL_FEATURES,
  UNDERSTANDING_RESULTS,
} from '../../utils/qovesProtocolModel'

const EVIDENCE_TIER_LABELS = {
  lifestyle: 'Routine / Topical',
  otc: 'Non-invasive / OTC',
  refer_clinician: 'See clinician',
}

function PageLabel({ page }) {
  return (
    <p className="text-[10px] uppercase tracking-[0.2em] text-ink-muted font-sans mb-2">
      Page / {String(page).padStart(2, '0')}
    </p>
  )
}

function SplitTitle({ primary, secondary }) {
  return (
    <h2 className="font-display text-2xl font-semibold mb-1">
      <span className="text-ink">{primary}</span>
      {secondary && <span className="text-ink-muted font-normal"> {secondary}</span>}
    </h2>
  )
}

function SectionBlock({ title, subtitle, page, children, splitTitle }) {
  return (
    <section className="qoves-protocol-page rounded-2xl border border-surface-border bg-white dark:bg-surface-card p-6 sm:p-8 shadow-card">
      {page != null && <PageLabel page={page} />}
      {splitTitle ? (
        <SplitTitle primary={splitTitle.primary} secondary={splitTitle.secondary} />
      ) : (
        <h2 className="font-display text-2xl font-semibold text-ink mb-1">{title}</h2>
      )}
      {subtitle && <p className="text-xs text-ink-muted mb-5 font-sans">{subtitle}</p>}
      {children}
    </section>
  )
}

function ImageFrame({ src, tag, emptyLabel = 'Projected image pending' }) {
  return (
    <div className="relative rounded-xl overflow-hidden bg-surface-warm border border-surface-border aspect-[4/3] flex items-center justify-center">
      {src ? (
        <img src={src} alt={tag || 'Feature'} className="w-full h-full object-cover" />
      ) : (
        <span className="text-xs text-ink-muted font-sans px-4 text-center">{emptyLabel}</span>
      )}
      {tag && (
        <span className="absolute top-2 left-2 px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-ink/70 text-white">
          {tag}
        </span>
      )}
    </div>
  )
}

function BeforeAfterPair({ beforeSrc, stacked = false }) {
  if (stacked) {
    return (
      <div className="flex flex-col gap-3 my-4">
        <ImageFrame src={beforeSrc} tag="BEFORE" />
        <ImageFrame src={null} tag="AFTER" />
      </div>
    )
  }
  return (
    <div className="grid grid-cols-2 gap-3 my-4">
      <ImageFrame src={beforeSrc} tag="BEFORE" />
      <ImageFrame src={null} tag="AFTER" />
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

function SummaryBar({ title, summary }) {
  return (
    <div className="rounded-xl bg-gradient-to-r from-ink-secondary to-ink-muted p-4 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-6">
      <p className="text-[10px] uppercase tracking-wider text-white/80 font-semibold shrink-0">{title}</p>
      <p className="text-sm text-white leading-relaxed font-sans">{summary}</p>
    </div>
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
  eyeAnalysis,
  protocolData,
  protocolNarrative,
  aiNarrative,
  pageIndex = 0,
  paginated = false,
}) {
  const clientName = getClientName(answers)
  const edition = formatProtocolEditionDate()
  const month = formatProtocolMonth()
  const featurePages = useMemo(
    () => buildFeaturePages(cvReport, eyeAnalysis, protocolNarrative),
    [cvReport, eyeAnalysis, protocolNarrative]
  )
  const contents = useMemo(() => buildProtocolContents(clientName), [clientName])
  const closingParagraphs = useMemo(
    () => buildClosingRecommendations(aiNarrative, cvReport, clientName, protocolNarrative),
    [aiNarrative, cvReport, clientName, protocolNarrative]
  )
  const closingCols = useMemo(() => buildClosingColumns(closingParagraphs), [closingParagraphs])
  const chartItems = useMemo(() => getFeatureComparisonData(cvReport), [cvReport])

  const [loading, setLoading] = useState(true)
  const [images, setImages] = useState({ fullBefore: null, features: {} })

  useEffect(() => {
    let cancelled = false
    async function loadImages() {
      if (!photo || !cvReport) {
        setLoading(false)
        return
      }
      setLoading(true)
      try {
        const photoJpeg = await normalizeToJpegDataUrl(photo)
        const features = await resolveAllFeatureImages({
          featurePages,
          photoJpeg,
          landmarks,
          cvReport,
          eyeAnalysis,
          photos,
        })
        if (cancelled) return
        setImages({ fullBefore: photoJpeg, features })
      } catch (err) {
        console.warn('Protocol image load failed:', err)
        if (!cancelled) setImages({ fullBefore: photo, features: {} })
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    loadImages()
    return () => {
      cancelled = true
    }
  }, [photo, photos, landmarks, cvReport, eyeAnalysis, featurePages])

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
        className="rounded-2xl overflow-hidden border border-ink/10 bg-ink text-white p-6 sm:p-10 min-h-[480px] flex flex-col justify-between"
      >
        <div>
          <p className="text-[10px] uppercase tracking-[0.25em] text-white/60 mb-10">MyFace</p>
          <p className="text-sm text-white/80 mb-6">{clientName} · {month}</p>
          <h1 className="font-display text-4xl sm:text-5xl font-semibold leading-tight">
            Aesthetic <span className="text-white/50 font-normal">Protocol</span>
          </h1>
          <p className="text-xs uppercase tracking-[0.2em] text-white/50 mt-4">
            Written {edition} · Protocol Edition
          </p>
        </div>
        <p className="text-xs text-white/40">Measurement-guided · MediaPipe + OpenCV</p>
      </section>
    ),
    (
      <SectionBlock key="disclaimer" splitTitle={{ primary: 'Disclaimer', secondary: 'Policy' }} page={2}>
        <div className="grid sm:grid-cols-2 gap-8 mt-4">
          <div>
            <h3 className="text-sm font-semibold text-ink font-display mb-3">Disclaimer Policy</h3>
            <div className="space-y-3 text-sm text-ink-secondary leading-relaxed font-sans">
              {DISCLAIMER_PARAGRAPHS.map((para, i) => (
                <p key={i}>{para}</p>
              ))}
            </div>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-ink font-display mb-3">Privacy Policy</h3>
            <div className="space-y-3 text-sm text-ink-secondary leading-relaxed font-sans">
              {PRIVACY_PARAGRAPHS.map((para, i) => (
                <p key={i}>{para}</p>
              ))}
            </div>
          </div>
        </div>
        <p className="text-xs text-ink-muted mt-6 font-sans">
          The following report was commissioned for <strong>{clientName}</strong> on {month}.
        </p>
      </SectionBlock>
    ),
    (
      <SectionBlock key="intro" title="Introduction" page={3}>
        <div className="grid sm:grid-cols-2 gap-8 mt-2">
          <div className="space-y-4 text-sm text-ink-secondary leading-relaxed font-sans">
            {INTRODUCTION_PARAGRAPHS.map((para, i) => (
              <p key={i}>{para}</p>
            ))}
            <div>
              <h3 className="text-sm font-semibold text-ink font-display mb-2">Limitations</h3>
              <p>{LIMITATIONS_PARAGRAPH}</p>
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted mb-3">Contents</p>
            <ul className="space-y-2 text-sm font-sans">
              {contents.map((item) => (
                <li key={item.label} className="flex justify-between gap-4 border-b border-surface-border/60 pb-2">
                  <span className="text-ink-secondary">{item.label}</span>
                  <span className="text-ink-muted tabular-nums">{String(item.page).padStart(2, '0')}</span>
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
        splitTitle={{ primary: 'Understanding', secondary: 'Your Results' }}
        page={4}
      >
        <ol className="space-y-5 mt-4">
          {UNDERSTANDING_RESULTS.map((item, i) => (
            <li key={i} className="flex gap-4 text-sm text-ink-secondary leading-relaxed font-sans">
              <span className="text-ink-muted font-display font-bold text-xl shrink-0 w-8">
                {String(i + 1).padStart(2, '0')}
              </span>
              <span>{item}</span>
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
      >
        <p className="text-sm text-ink-secondary leading-relaxed font-sans mb-4 mt-2">
          {protocolNarrative?.summary ||
            protocolData?.summary ||
            'This evidence-based protocol is grounded in your measured facial analysis, organised around 11 key features for facial aesthetics.'}
        </p>
        <BeforeAfterPair beforeSrc={images.fullBefore} />
        <div className="grid sm:grid-cols-2 gap-6 mt-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted mb-3">
              Projected potential · 11 key features
            </p>
            <div className="grid grid-cols-2 gap-1 text-xs text-ink-secondary font-sans">
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

  const closingPage = (
    <SectionBlock
      key="closing"
      splitTitle={{ primary: 'Closing', secondary: 'Recommendations' }}
      page={16}
      subtitle="Synthesised protocol guidance · Grounded with your data"
    >
      <div className="grid sm:grid-cols-2 gap-8 mt-4 relative">
        <div className="hidden sm:block absolute left-1/2 top-0 bottom-0 w-px bg-surface-border" />
        <div className="space-y-4 text-sm text-ink-secondary leading-relaxed font-sans">
          {closingCols.left.map((para, i) => (
            <p key={i}>{para}</p>
          ))}
        </div>
        <div className="space-y-4 text-sm text-ink-secondary leading-relaxed font-sans">
          {closingCols.right.map((para, i) => (
            <p key={i}>{para}</p>
          ))}
        </div>
      </div>
      {!aiNarrative?.content && !protocolNarrative?.closing?.length && (
        <p className="text-xs text-amber-700 mt-4 font-sans">
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
    <div className="space-y-6 pb-8 qoves-protocol-document">
      {pages}

      {featurePages.map((page) => {
        const pair = images.features[page.id] || {}
        const slots = pair.slots || {}
        const beforeSrc = slots.pairBefore || pair.before || images.fullBefore
        const previewSrc = slots.preview || pair.before || images.fullBefore
        const qovesMeta = QOVES_PROTOCOL_FEATURES.find((f) => f.id === page.id)
        const titleParts = page.title.split(' ')
        const stacked = page.layoutHints?.stackedImages
        return (
          <SectionBlock
            key={page.id}
            page={qovesMeta?.page}
            splitTitle={{ primary: titleParts[0], secondary: titleParts.slice(1).join(' ') }}
          >
            <div className="grid sm:grid-cols-2 gap-6 mt-4">
              {page.layoutHints?.eyesQuadrant ? (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    {page.subsections.map((sub) => (
                      <div key={sub.title}>
                        <h3 className="text-sm font-semibold text-ink font-display mb-2">{sub.title}</h3>
                        <p className="text-sm text-ink-secondary leading-relaxed font-sans">{sub.body}</p>
                        {sub.evidenceTier && EVIDENCE_TIER_LABELS[sub.evidenceTier] && (
                          <p className="text-[10px] text-slate-500 mt-1 italic font-sans">
                            Recommendation tier: {EVIDENCE_TIER_LABELS[sub.evidenceTier]}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                  <div>
                    <BeforeAfterPair beforeSrc={beforeSrc} stacked={stacked} />
                    {page.id === 'eyes' && slots.preview && (
                      <div className="mt-3">
                        <ImageFrame src={slots.preview} tag="EYES" />
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <div>
                    {page.subsections.map((sub) => (
                      <div key={sub.title} className="mb-5">
                        <h3 className="text-sm font-semibold text-ink font-display mb-2">{sub.title}</h3>
                        <p className="text-sm text-ink-secondary leading-relaxed font-sans">{sub.body}</p>
                        {sub.evidenceTier && EVIDENCE_TIER_LABELS[sub.evidenceTier] && (
                          <p className="text-[10px] text-slate-500 mt-1 italic font-sans">
                            Recommendation tier: {EVIDENCE_TIER_LABELS[sub.evidenceTier]}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                  <div>
                    {page.layoutHints?.profileImage && pair.profile && pair.profileIsReal && (
                      <div className="mb-3">
                        <ImageFrame src={pair.profile} tag="PROFILE" />
                      </div>
                    )}
                    {page.id === 'lips' && slots.preview ? (
                      <div className="mb-3">
                        <ImageFrame src={slots.preview} tag="LIPS" />
                      </div>
                    ) : null}
                    {page.id === 'cheeks' && (slots.analysis || pair.before) ? (
                      <div className="mb-3">
                        <ImageFrame src={slots.analysis || pair.before} tag="ANALYSIS" />
                      </div>
                    ) : null}
                    <BeforeAfterPair beforeSrc={beforeSrc} stacked={stacked} />
                  </div>
                </>
              )}
            </div>
            <SummaryBar
              title={`${page.title.replace(' Recommendations', '')} Summary`}
              summary={page.summary}
            />
          </SectionBlock>
        )
      })}

      {closingPage}
    </div>
  )
}
