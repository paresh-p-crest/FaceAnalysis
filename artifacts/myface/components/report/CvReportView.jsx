'use client'

import { useTranslations } from 'next-intl'
import { EyeReportPanel } from '../EyeReportPanel'
import { SymmetryOverlay, FaceShapeOverlay } from './FaceImageFrame'
import { FeatureRegionHero } from './FeatureRegionHero'
import { BrowReportPanel } from './BrowReportPanel'
import { FeatureReportPanel } from './FeatureReportPanel'
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
import { AiVisualsSection } from './AiVisualsSection'
import { BeautyAssistantSection } from './BeautyAssistantSection'
import { IntroductionSection } from './IntroductionSection'
import { DisclaimerSection } from './DisclaimerSection'
import { ProtocolDocumentViewer } from './ProtocolDocumentViewer'
import { ReportSectionHeading, ReportMetricCard, ReportExplanationCard } from './ReportSectionHeading'
import { AssessmentGridLayout, FeatureAnalysisPage } from './FeatureAnalysisPage'
import {
  FeatureProseBlock,
  resolveEyebrowsNarrative,
  resolveFeatureNarrative,
  eyesNarrativeWithoutBrows,
} from './FeatureProseBlock'
import { resolveFeatureHero } from '../../utils/featureParsing'

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
  aiVisuals,
  aiVisualsLoading,
  aiVisualsError,
  onGenerateVisuals,
  canGenerateVisuals,
  assessmentId,
  canUseAssistant,
  onLoadAssistant,
  onSendAssistant,
  photo,
  photos,
  landmarks,
  metrics,
  answers,
  user = null,
  onDownloadPdf,
  pdfLoading,
  canDownloadPdf,
  showAdminEdit = false,
  adminAssessment = null,
  onNarrativesSaved,
}) {
  const t = useTranslations('Report')

  const narrativeFor = (featureId) =>
    resolveFeatureNarrative(featureNarratives, protocolNarrative, featureId)

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
      />
    )
  }
  if (activeId === 'averageness' && cvReport?.averageness) {
    return <AveragenessSection averageness={cvReport.averageness} landmarks={landmarks} />
  }

  if (activeId === 'faceShape' && cvReport?.faceShape) {
    const fs = cvReport.faceShape
    const primaryMetrics = [
      fs.midfaceWidth != null && { label: t('faceShape.midfaceWidth'), value: fs.midfaceWidth },
      fs.foreheadWidth != null && { label: t('faceShape.foreheadWidth'), value: fs.foreheadWidth },
      fs.lowerThirdWidth != null && { label: t('faceShape.lowerThirdWidth'), value: fs.lowerThirdWidth },
      fs.facialLength != null && { label: t('faceShape.facialLength'), value: fs.facialLength },
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
                <div className="qoves-report-metric-card text-center py-5">
                  <p className="qoves-report-mono-label mb-3">{t('common.shape')}</p>
                  <p className="text-3xl font-display font-bold text-ink">{fs.shape}</p>
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
                <div className="qoves-report-metric-card">
                  <p className="qoves-report-mono-label mb-2">{t('common.explanation')}</p>
                  <p className="text-sm text-ink-secondary leading-relaxed font-sans">{fs.explanation}</p>
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
              <ReportMetricCard label={t('symmetry.symmetryScore')} value={`${s.score}/100`} />
              <ReportMetricCard label={t('symmetry.classification')} value={s.scoreLabel} />
              <div className="qoves-report-metric-card">
                <p className="qoves-report-mono-label mb-2">{t('symmetry.symmetryRange')}</p>
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
                  <span>{s.scaleLeft}</span>
                  <span>{s.scaleRight}</span>
                </div>
              </div>
              {regions.length > 0 && (
                <div className="qoves-report-metric-card">
                  <p className="qoves-report-mono-label mb-3">{t('symmetry.regionalBalance')}</p>
                  <div className="space-y-3">
                    {regions.map((r) => (
                      <div key={r.id}>
                        <div className="flex items-center justify-between gap-3 mb-1">
                          <span className="text-sm text-ink">{r.label}</span>
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
          explanation={s.explanation}
        />
      </div>
    )
  }

  // Proportions (Qoves-style tabbed ratio view)
  if (activeId === 'proportions' && cvReport?.proportions?.ratios) {
    return <ProportionsSection proportions={cvReport.proportions} landmarks={landmarks} photo={photo} photos={photos} />
  }

  // Nose
  if (activeId === 'nose' && cvReport?.nose) {
    return (
      <NoseReportPanel
        nose={cvReport.nose}
        featureParsing={featureParsing}
        narrative={narrativeFor('nose')}
      />
    )
  }

  // Lips
  if (activeId === 'lips' && cvReport?.lips) {
    return (
      <LipsReportPanel
        lips={cvReport.lips}
        featureParsing={featureParsing}
        narrative={narrativeFor('lips')}
      />
    )
  }

  // Eyes (brows live on the separate Eyebrows tab — do not repeat here)
  if (activeId === 'eyes' && eyeAnalysis) {
    return (
      <EyeReportPanel
        eyeAnalysis={eyeAnalysis}
        narrative={eyesNarrativeWithoutBrows(narrativeFor('eyes'))}
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
        narrative={resolveEyebrowsNarrative(featureNarratives, protocolNarrative)}
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
        narrative={narrativeFor('jaw')}
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
        narrative={narrativeFor('chin')}
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
        narrative={narrativeFor('hair')}
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
        narrative={narrativeFor('smile')}
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
        narrative={narrativeFor('neck')}
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
      <FeatureReportPanel
        title={t('ears.title')}
        featureName="ears"
        data={e}
        narrative={narrativeFor('ears')}
        featureId="ears"
        featureParsing={featureParsing}
        imageSrc={earHero}
        imageAlt={t('ears.imageAlt')}
        sections={[
          {
            title: t('ears.proportionsTitle'),
            metrics: [
              { label: t('ears.earSize'), value: `${e.earSize}× IPD`, tooltip: t('ears.earSizeTooltip') },
              { label: t('ears.sizeClass'), value: e.earSizeClass, tooltip: t('ears.sizeClassTooltip') },
              { label: t('ears.symmetry'), value: e.earSymmetry, tooltip: t('ears.symmetryTooltip') },
              { label: t('ears.sizeDifference'), value: `${e.sizeDifference}%`, tooltip: t('ears.sizeDifferenceTooltip') },
            ],
          },
          {
            title: t('ears.positionTitle'),
            metrics: [
              { label: t('ears.protrusion'), value: e.protrusion, tooltip: t('ears.protrusionTooltip') },
              { label: t('ears.protrusionDepth'), value: `${e.earProtrusion}`, tooltip: t('ears.protrusionDepthTooltip') },
              { label: t('ears.verticalPosition'), value: e.earPosition, tooltip: t('ears.verticalPositionTooltip') },
            ],
          },
        ]}
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
        narrative={narrativeFor('cheeks')}
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
    return <SkinReportPanel skin={cvReport.skin} featureParsing={featureParsing} narrative={narrativeFor('skin')} />
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

  if (activeId === 'aiVisuals') {
    return (
      <AiVisualsSection
        aiVisuals={aiVisuals}
        loading={aiVisualsLoading}
        error={aiVisualsError}
        onGenerate={onGenerateVisuals}
        canGenerate={canGenerateVisuals}
      />
    )
  }

  if (activeId === 'beautyAssistant') {
    return (
      <BeautyAssistantSection
        assessmentId={assessmentId}
        canUseAssistant={canUseAssistant}
        onLoad={onLoadAssistant}
        onSend={onSendAssistant}
      />
    )
  }

  return null
}
