import { useEffect, useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'
import {
  cropFeatureBefore,
  normalizeToJpegDataUrl,
  projectFeatureAfter,
  projectFullFaceAfter,
} from '../../utils/aestheticProjection'
import {
  buildClosingRecommendations,
  buildFeaturePages,
  buildProtocolContents,
  DISCLAIMER_PARAGRAPHS,
  formatProtocolEditionDate,
  formatProtocolMonth,
  getClientName,
  getRadarData,
  INTRODUCTION_PARAGRAPHS,
  QOVES_PROTOCOL_FEATURES,
  UNDERSTANDING_RESULTS,
} from '../../utils/qovesProtocolModel'

function PageLabel({ page }) {
  return (
    <p className="text-[10px] uppercase tracking-[0.2em] text-ink-muted font-sans mb-2">
      Page / {String(page).padStart(2, '0')}
    </p>
  )
}

function SectionBlock({ title, subtitle, page, children }) {
  return (
    <section className="qoves-protocol-page rounded-2xl border border-surface-border bg-white dark:bg-surface-card p-6 sm:p-8 shadow-card">
      {page != null && <PageLabel page={page} />}
      <h2 className="font-display text-2xl font-semibold text-ink mb-1">{title}</h2>
      {subtitle && <p className="text-xs text-ink-muted mb-5 font-sans">{subtitle}</p>}
      {children}
    </section>
  )
}

function BeforeAfterPair({ beforeSrc, afterSrc, label = 'Projected potential' }) {
  return (
    <div className="grid sm:grid-cols-2 gap-4 my-5">
      <div>
        <p className="text-[10px] uppercase tracking-wider text-ink-muted text-center mb-2 font-semibold">Before</p>
        <div className="rounded-xl overflow-hidden bg-surface-warm border border-surface-border aspect-[3/4] flex items-center justify-center">
          {beforeSrc ? (
            <img src={beforeSrc} alt="Before" className="w-full h-full object-cover" />
          ) : (
            <span className="text-xs text-ink-muted">No image</span>
          )}
        </div>
      </div>
      <div>
        <p className="text-[10px] uppercase tracking-wider text-brand text-center mb-2 font-semibold">After</p>
        <div className="rounded-xl overflow-hidden bg-brand-50/40 border border-brand/20 aspect-[3/4] flex items-center justify-center">
          {afterSrc ? (
            <img src={afterSrc} alt="After projected" className="w-full h-full object-cover" />
          ) : (
            <span className="text-xs text-ink-muted">{label}</span>
          )}
        </div>
      </div>
    </div>
  )
}

function RadarMini({ items }) {
  const size = 220
  const cx = size / 2
  const cy = size / 2
  const radius = 78
  const n = items.length
  const angleStep = (Math.PI * 2) / n
  const toPoint = (score, i) => {
    const a = -Math.PI / 2 + i * angleStep
    const r = (score / 100) * radius
    return { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r }
  }
  const poly = (scores) =>
    scores
      .map((score, i) => {
        const p = toPoint(score, i)
        return `${p.x},${p.y}`
      })
      .join(' ')

  return (
    <div className="flex flex-col items-center gap-3">
      <svg width={size} height={size} className="mx-auto">
        {[0.25, 0.5, 0.75, 1].map((lvl) => (
          <circle key={lvl} cx={cx} cy={cy} r={radius * lvl} fill="none" stroke="#e5e7eb" strokeWidth="1" />
        ))}
        {items.map((_, i) => {
          const a = -Math.PI / 2 + i * angleStep
          const x2 = cx + Math.cos(a) * radius
          const y2 = cy + Math.sin(a) * radius
          return <line key={i} x1={cx} y1={cy} x2={x2} y2={y2} stroke="#e5e7eb" strokeWidth="1" />
        })}
        <polygon points={poly(items.map((i) => i.projected))} fill="rgba(15,118,110,0.18)" stroke="#0f766e" strokeWidth="1.5" />
        <polygon points={poly(items.map((i) => i.score))} fill="rgba(51,65,85,0.12)" stroke="#334155" strokeWidth="1.5" />
      </svg>
      <p className="text-[10px] text-ink-muted text-center font-sans">
        Inner: current scores · Outer teal: projected potential
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1 text-[10px] text-ink-muted font-sans">
        {items.map((item) => (
          <span key={item.label}>{item.label}</span>
        ))}
      </div>
    </div>
  )
}

export default function QovesProtocolReport({
  photo,
  landmarks,
  cvReport,
  metrics,
  answers,
  eyeAnalysis,
  protocolData,
  aiNarrative,
}) {
  const clientName = getClientName(answers)
  const edition = formatProtocolEditionDate()
  const month = formatProtocolMonth()
  const featurePages = useMemo(() => buildFeaturePages(cvReport, eyeAnalysis), [cvReport, eyeAnalysis])
  const contents = useMemo(() => buildProtocolContents(clientName), [clientName])
  const closing = useMemo(
    () => buildClosingRecommendations(aiNarrative, cvReport, clientName),
    [aiNarrative, cvReport, clientName]
  )
  const radarItems = useMemo(() => getRadarData(cvReport), [cvReport])

  const [loading, setLoading] = useState(true)
  const [images, setImages] = useState({ fullBefore: null, fullAfter: null, features: {} })

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
        const [fullAfter, ...featurePairs] = await Promise.all([
          projectFullFaceAfter(photoJpeg, landmarks, cvReport, metrics),
          ...featurePages.map(async (page) => {
            const [beforeJpeg, afterJpeg] = await Promise.all([
              cropFeatureBefore(photoJpeg, landmarks, page.projectionId),
              projectFeatureAfter(photoJpeg, landmarks, page.projectionId, cvReport, metrics),
            ])
            return [page.id, { before: beforeJpeg || photoJpeg, after: afterJpeg }]
          }),
        ])
        if (cancelled) return
        const features = Object.fromEntries(featurePairs)
        setImages({ fullBefore: photoJpeg, fullAfter, features })
      } catch (err) {
        console.warn('Protocol image projection failed:', err)
        if (!cancelled) setImages({ fullBefore: photo, fullAfter: null, features: {} })
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    loadImages()
    return () => {
      cancelled = true
    }
  }, [photo, landmarks, cvReport, metrics, featurePages])

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

  return (
    <div className="space-y-6 pb-8 qoves-protocol-document">
      {/* Cover */}
      <section className="rounded-2xl border border-ink/10 bg-ink text-white p-8 sm:p-12 min-h-[420px] flex flex-col justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-[0.25em] text-white/60 mb-8">AuraScan</p>
          <p className="text-sm text-white/70 mb-2">{clientName} · {month}</p>
          <h1 className="font-display text-4xl sm:text-5xl font-semibold leading-tight mb-2">Aesthetic Protocol</h1>
          <p className="text-xs uppercase tracking-[0.2em] text-white/50">Written {edition} · Protocol Edition</p>
        </div>
        <p className="text-xs text-white/50 mt-8">Measurement-guided · MediaPipe + OpenCV</p>
      </section>

      {/* Disclaimer */}
      <SectionBlock title="Disclaimer Policy" page={2}>
        <div className="space-y-4 text-sm text-ink-secondary leading-relaxed font-sans">
          {DISCLAIMER_PARAGRAPHS.map((para, i) => (
            <p key={i}>{para}</p>
          ))}
        </div>
        <p className="text-xs text-ink-muted mt-6 font-sans">
          The following report was commissioned for <strong>{clientName}</strong> on {month}.
        </p>
      </SectionBlock>

      {/* Introduction */}
      <SectionBlock title="Introduction" page={3}>
        <div className="space-y-4 text-sm text-ink-secondary leading-relaxed font-sans mb-8">
          {INTRODUCTION_PARAGRAPHS.map((para, i) => (
            <p key={i}>{para}</p>
          ))}
        </div>
        <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted mb-3">Contents</p>
        <ul className="space-y-2 text-sm font-sans">
          {contents.map((item) => (
            <li key={item.label} className="flex justify-between gap-4 border-b border-surface-border/60 pb-2">
              <span className="text-ink-secondary">{item.label}</span>
              <span className="text-ink-muted tabular-nums">{String(item.page).padStart(2, '0')}</span>
            </li>
          ))}
        </ul>
      </SectionBlock>

      {/* Understanding */}
      <SectionBlock title="Understanding Your Results" page={4}>
        <ol className="space-y-5">
          {UNDERSTANDING_RESULTS.map((item, i) => (
            <li key={i} className="flex gap-4 text-sm text-ink-secondary leading-relaxed font-sans">
              <span className="text-brand font-display font-bold text-lg shrink-0">{String(i + 1).padStart(2, '0')}</span>
              <span>{item}</span>
            </li>
          ))}
        </ol>
      </SectionBlock>

      {/* Client protocol overview */}
      <SectionBlock title={`${clientName}'s Protocol`} page={5}>
        <p className="text-sm text-ink-secondary leading-relaxed font-sans mb-4">
          {protocolData?.summary ||
            'To help you achieve your aesthetic potential, we have developed this science-based protocol grounded in your measured facial analysis. Projected images apply subtle region-specific corrections — not global filters.'}
        </p>
        <BeforeAfterPair beforeSrc={images.fullBefore} afterSrc={images.fullAfter} />
        <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted mb-3">
          Projected potential · 11 key features
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs text-ink-secondary font-sans mb-6">
          {QOVES_PROTOCOL_FEATURES.map((f) => (
            <span key={f.id}>· {f.title}</span>
          ))}
        </div>
        <RadarMini items={radarItems} />
      </SectionBlock>

      {/* Per-feature pages */}
      {featurePages.map((page) => {
        const pair = images.features[page.id] || {}
        const qovesMeta = QOVES_PROTOCOL_FEATURES.find((f) => f.id === page.id)
        return (
          <SectionBlock key={page.id} title={page.title} page={qovesMeta?.page}>
            {page.subsections.map((sub) => (
              <div key={sub.title} className="mb-5">
                <h3 className="text-sm font-semibold text-ink font-display mb-2">{sub.title}</h3>
                <p className="text-sm text-ink-secondary leading-relaxed font-sans">{sub.body}</p>
              </div>
            ))}
            <BeforeAfterPair beforeSrc={pair.before || images.fullBefore} afterSrc={pair.after} />
            <div className="rounded-xl bg-surface-warm dark:bg-surface-raised border border-surface-border p-4">
              <p className="text-[10px] uppercase tracking-wider text-ink-muted mb-2 font-semibold">
                {page.title.replace(' Recommendations', '')} Summary
              </p>
              <p className="text-sm text-ink-secondary leading-relaxed font-sans">{page.summary}</p>
            </div>
          </SectionBlock>
        )
      })}

      {/* Closing — admin AI narrative */}
      <SectionBlock title="Closing Recommendations" page={16} subtitle="Admin-reviewed narrative · CV-grounded">
        <div className="space-y-4 text-sm text-ink-secondary leading-relaxed font-sans">
          {closing.map((para, i) => (
            <p key={i}>{para}</p>
          ))}
        </div>
        {!aiNarrative?.content && (
          <p className="text-xs text-amber-700 mt-4 font-sans">
            Admin can generate AI narrative in review panel; it will appear here and in the downloaded PDF.
          </p>
        )}
      </SectionBlock>
    </div>
  )
}
