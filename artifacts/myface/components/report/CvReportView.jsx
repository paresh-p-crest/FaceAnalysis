'use client'

import { useTranslations, useLocale } from 'next-intl'
import { EyeReportPanel } from '../EyeReportPanel'
import { SymmetryOverlay, FaceShapeOverlay } from './FaceImageFrame'
import { FeatureRegionHero } from './FeatureRegionHero'
import { BrowReportPanel } from './BrowReportPanel'
import { EarReportPanel } from './EarReportPanel'
import { NoseReportPanel } from './NoseReportPanel'
import { LipsReportPanel } from './LipsReportPanel'
import { CheekReportPanel } from './CheekReportPanel'
import { JawReportPanel } from './JawReportPanel'
import { ChinReportPanel } from './ChinReportPanel'
import { HairReportPanel } from './HairReportPanel'
import { SmileReportPanel } from './SmileReportPanel'
import { NeckReportPanel } from './NeckReportPanel'
import { SkinReportPanel } from './SkinReportPanel'
import { DimorphismSection } from './DimorphismSection'
import { AveragenessSection } from './AveragenessSection'
import { ProportionsSection } from './ProportionsSection'
import { IntroductionSection } from './IntroductionSection'
import { DisclaimerSection } from './DisclaimerSection'
import { ProtocolDocumentViewer } from './ProtocolDocumentViewer'
import { AiVisualsSection } from '../AiVisualsSection'
import { AI_VISUAL_TYPE_BY_SECTION_ID } from './reportNavConfig'
import { ReportSectionHeading, ReportMetricCard, ReportExplanationCard } from './ReportSectionHeading'
import { AssessmentGridLayout, FeatureAnalysisPage } from './FeatureAnalysisPage'
import { resolveFeatureHero } from '../../utils/featureParsing'
import { pickLocalizedCvText, useCvLabel, SYMMETRY_REGION_LABEL_KEY } from '../../utils/cvReportLocale'

export function CvReportView({
  activeId,
  cvReport,
  eyeAnalysis,
  featureNarratives = null,
  featureParsing = null,
  projectedAfter = null,
  projectedAnalysis = null,
  protocolNarrative,
  protocolLoading,
  aiNarrative,
  assessmentId,
  photo,
  photos,
  landmarks,
  metrics,
  answers,
  user = null,
  assessmentOwner = null,
  onDownloadPdf,
  pdfLoading,
  canDownloadPdf,
  showAdminEdit = false,
  adminAssessment = null,
  onNarrativesSaved,
  createdAt = null,
  updatedAt = null,
  onNavigate,
  aiVisuals = null,
  aiVisualsBeforeSrc = null,
  visualAge = null,
}) {
  const t = useTranslations('Report')
  const locale = useLocale()
  const cvLabel = useCvLabel()

  if (activeId === 'intro') {
    return <IntroductionSection />
  }

  if (activeId === 'disclaimer') {
    return <DisclaimerSection />
  }

  if (activeId === 'dimorphism' && cvReport?.dimorphism) {
    return (
      <DimorphismSection
        dimorphism={cvReport.dimorphism}
        photo={photo}
        featureParsing={featureParsing}
        landmarks={landmarks}
      />
    )
  }
  if (activeId === 'averageness' && cvReport?.averageness) {
    return <AveragenessSection averageness={cvReport.averageness} landmarks={landmarks} />
  }

  if (activeId === 'faceShape' && cvReport?.faceShape) {
    const fs = cvReport.faceShape
    const primaryMetrics = [
      fs.midfaceWidth != null && { label: t('faceShape.midfaceWidth'), value: cvLabel(fs.midfaceWidth) },
      fs.foreheadWidth != null && { label: t('faceShape.foreheadWidth'), value: cvLabel(fs.foreheadWidth) },
      fs.lowerThirdWidth != null && { label: t('faceShape.lowerThirdWidth'), value: cvLabel(fs.lowerThirdWidth) },
      fs.facialLength != null && { label: t('faceShape.facialLength'), value: cvLabel(fs.facialLength) },
    ].filter(Boolean)
    const extraMetrics = [
      fs.lengthToMidfaceRatio != null && { label: t('faceShape.lengthMidface'), value: fs.lengthToMidfaceRatio },
      fs.widthHeightRatio != null && { label: t('faceShape.widthHeightRatio'), value: fs.widthHeightRatio },
    ].filter(Boolean)

    // Prefer front photo + SVG overlay (image-%); fall back to baked imageSrc alone
    const useSvgOverlay = Boolean(fs.overlay && photo)
    return (
      <div className="space-y-6">
        <ReportSectionHeading
          title={t('faceShape.title')}
          accent={t('faceShape.accent')}
          subtitle={t('faceShape.subtitle')}
        />
        <AssessmentGridLayout
          photo={photo || fs.imageSrc}
          photoOverlay={useSvgOverlay ? <FaceShapeOverlay overlay={fs.overlay} /> : null}
          photoFit="contain"
          rightCards={
            <>
              {fs.shape != null && (
                <div className="report-view-metric-card text-center py-5">
                  <p className="report-view-mono-label mb-3">{t('common.shape')}</p>
                  <p className="text-3xl font-display font-bold text-ink">{cvLabel(fs.shape)}</p>
                </div>
              )}
              {primaryMetrics.length > 0 && (
                <div className="grid grid-cols-2 gap-3">
                  {primaryMetrics.map((m) => (
                    <ReportMetricCard key={m.label} label={m.label} value={m.value} />
                  ))}
                </div>
              )}
              {fs.explanation && (
                <div className="report-view-metric-card">
                  <p className="report-view-mono-label mb-2">{t('common.explanation')}</p>
                  <p className="text-sm text-ink-secondary leading-relaxed font-sans">
                    {pickLocalizedCvText(fs, locale)}
                  </p>
                </div>
              )}
            </>
          }
          metrics={extraMetrics}
        />
      </div>
    )
  }

  if (activeId === 'symmetry' && cvReport?.symmetry) {
    const s = cvReport.symmetry
    const regions = Array.isArray(s.regions) ? s.regions : []
    return (
      <div className="space-y-6">
        <ReportSectionHeading
          title={t('symmetry.title')}
          accent={t('symmetry.accent')}
          subtitle={t('symmetry.subtitle')}
        />
        <AssessmentGridLayout
          photo={s.imageSrc}
          photoOverlay={
            s.symmetryDots ? (
              <SymmetryOverlay dots={s.symmetryDots} midline={s.symmetryMidline} />
            ) : null
          }
          photoFit="contain"
          rightCards={
            <>
              <ReportMetricCard label={t('symmetry.symmetryScore')} value={`${s.score}/100`} translateValue={false} />
              <ReportMetricCard label={t('symmetry.classification')} value={cvLabel(s.scoreLabel)} />
              <div className="report-view-metric-card">
                <p className="report-view-mono-label mb-2">{t('symmetry.symmetryRange')}</p>
                <div className="relative h-2 rounded-full bg-surface-border mt-3 mb-2">
                  {s.rangeHighlight && (
                    <div
                      className="absolute top-0 bottom-0 rounded-full bg-brand/20"
                      style={{ left: `${s.rangeHighlight.left}%`, width: `${s.rangeHighlight.width}%` }}
                    />
                  )}
                  <div
                    className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-sm bg-ink"
                    style={{ left: `calc(${s.scaleMarkerPct ?? s.score}% - 6px)` }}
                  />
                </div>
                <div className="flex justify-between text-[11px] text-ink-muted">
                  <span>{cvLabel(s.scaleLeft)}</span>
                  <span>{cvLabel(s.scaleRight)}</span>
                </div>
              </div>
              {regions.length > 0 && (
                <div className="report-view-metric-card">
                  <p className="report-view-mono-label mb-3">{t('symmetry.regionalBalance')}</p>
                  <div className="space-y-3">
                    {regions.map((r) => (
                      <div key={r.id}>
                        <div className="flex items-center justify-between gap-3 mb-1">
                          <span className="text-sm text-ink">
                            {cvLabel(SYMMETRY_REGION_LABEL_KEY[r.id] || r.label)}
                          </span>
                          <span className="text-sm font-medium text-ink tabular-nums">{r.score}/100</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-surface-border overflow-hidden">
                          <div
                            className="h-full rounded-full bg-brand/70"
                            style={{ width: `${Math.max(8, Math.min(100, r.score))}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="text-[11px] text-ink-muted mt-3">
                    {t('symmetry.regionalNote')}
                  </p>
                </div>
              )}
            </>
          }
          explanation={pickLocalizedCvText(s, locale)}
        />
      </div>
    )
  }

  // Proportions (report-style tabbed ratio view)
  if (activeId === 'proportions' && cvReport?.proportions?.ratios) {
    return <ProportionsSection proportions={cvReport.proportions} landmarks={landmarks} photo={photo} photos={photos} />
  }

  // Nose
  if (activeId === 'nose' && cvReport?.nose) {
    return (
      <NoseReportPanel
        nose={cvReport.nose}
        featureParsing={featureParsing}
      />
    )
  }

  // Lips
  if (activeId === 'lips' && cvReport?.lips) {
    return (
      <LipsReportPanel
        lips={cvReport.lips}
        featureParsing={featureParsing}
      />
    )
  }

  // Eyes (brows live on the separate Eyebrows tab — do not repeat here)
  if (activeId === 'eyes' && eyeAnalysis) {
    return (
      <EyeReportPanel
        eyeAnalysis={eyeAnalysis}
        featureParsing={featureParsing}
        photo={photo}
        landmarks={landmarks}
      />
    )
  }

  // Eyebrows
  if (activeId === 'eyebrows' && cvReport?.eyebrows) {
    return (
      <BrowReportPanel
        eyebrows={cvReport.eyebrows}
        featureParsing={featureParsing}
        photo={photo}
        landmarks={landmarks}
      />
    )
  }

  // Jaw
  if (activeId === 'jaw' && cvReport?.jaw) {
    const j = cvReport.jaw
    const jawSrc =
      j.photoSource === 'rightProfile'
        ? j.imageSrcFront || j.imageSrc
        : j.imageSrc || j.imageSrcFront
    return (
      <JawReportPanel
        jaw={j}
        featureParsing={featureParsing}
        imageSrc={jawSrc}
      />
    )
  }

  // ── Chin ──
  if (activeId === 'chin' && cvReport?.chin) {
    const c = cvReport.chin
    const chinSrc =
      c.photoSource === 'rightProfile'
        ? c.imageSrcFront || c.imageSrc
        : c.imageSrc || c.imageSrcFront
    const chinHero = resolveFeatureHero('chin', c, featureParsing) || chinSrc
    return (
      <ChinReportPanel
        chin={c}
        featureParsing={featureParsing}
        imageSrc={chinSrc}
        heroSlot={
          chinHero && landmarks?.length ? (
            <FeatureRegionHero
              heroSrc={chinHero}
              frontPhoto={photo}
              landmarks={landmarks}
              featureId="chin"
              featureParsing={featureParsing}
              alt={t('ears.yourChinAlt')}
            />
          ) : null
        }
      />
    )
  }

  // ── Hair ──
  if (activeId === 'hair' && cvReport?.hair) {
    const h = cvReport.hair
    return (
      <HairReportPanel
        hair={h}
        featureParsing={featureParsing}
        imageSrc={h.imageSrc}
      />
    )
  }

  // ── Smile ──
  if (activeId === 'smile' && cvReport?.smile) {
    const s = cvReport.smile
    return (
      <SmileReportPanel
        smile={s}
        featureParsing={featureParsing}
        imageSrc={s.imageSrc}
      />
    )
  }

  // ── Neck ──
  if (activeId === 'neck' && cvReport?.neck) {
    const n = cvReport.neck
    return (
      <NeckReportPanel
        neck={n}
        featureParsing={featureParsing}
        imageSrc={n.imageSrc}
      />
    )
  }

  // ── Ears ──
  if (activeId === 'ears' && cvReport?.ears) {
    const e = cvReport.ears
    const photosMap = photos || cvReport?.photos
    const earHero =
      resolveFeatureHero('ears', e, featureParsing) ||
      e.imageSrcLeft ||
      photosMap?.leftProfile ||
      e.imageSrc

    return (
      <EarReportPanel
        ears={e}
        featureParsing={featureParsing}
        imageSrc={earHero}
      />
    )
  }

  // â”€â”€ Cheeks â”€â”€
  if (activeId === 'cheeks' && cvReport?.cheeks) {
    const cheekHero =
      resolveFeatureHero('cheeks', cvReport.cheeks, featureParsing) || cvReport.cheeks.imageSrc
    return (
      <CheekReportPanel
        cheeks={cvReport.cheeks}
        featureParsing={featureParsing}
        heroSlot={
          cheekHero && landmarks?.length ? (
            <FeatureRegionHero
              heroSrc={cheekHero}
              frontPhoto={photo}
              landmarks={landmarks}
              featureId="cheeks"
              featureParsing={featureParsing}
              alt={t('ears.yourCheeksAlt')}
            />
          ) : null
        }
      />
    )
  }

  // â”€â”€ Skin Quality â”€â”€
  if (activeId === 'skin' && cvReport?.skin) {
    return <SkinReportPanel skin={cvReport.skin} featureParsing={featureParsing} />
  }

  if (activeId === 'protocol') {
    return (
      <ProtocolDocumentViewer
        photo={photo}
        photos={photos}
        landmarks={landmarks}
        cvReport={cvReport}
        metrics={metrics}
        answers={answers}
        user={user}
        assessmentOwner={assessmentOwner}
        eyeAnalysis={eyeAnalysis}
        protocolNarrative={protocolNarrative}
        featureNarratives={featureNarratives}
        aiNarrative={aiNarrative}
        protocolLoading={protocolLoading}
        projectedAfter={projectedAfter}
        projectedAnalysis={projectedAnalysis}
        onDownloadPdf={onDownloadPdf}
        pdfLoading={pdfLoading}
        canDownloadPdf={canDownloadPdf}
        showAdminEdit={showAdminEdit}
        assessmentId={assessmentId}
        adminAssessment={adminAssessment}
        onNarrativesSaved={onNarrativesSaved}
      />
    )
  }

  const aiVisualType = AI_VISUAL_TYPE_BY_SECTION_ID[activeId]
  if (aiVisualType) {
    return (
      <AiVisualsSection
        aiVisuals={aiVisuals}
        activeType={aiVisualType}
        beforeSrc={aiVisualsBeforeSrc}
        visualAge={visualAge}
        loading={false}
        error=""
        canGenerate={false}
        showGenerate={false}
      />
    )
  }

  return null
}
