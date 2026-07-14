import { EyeReportPanel } from '../EyeReportPanel'
import { SymmetryOverlay, FaceShapeOverlay } from './FaceImageFrame'
import { BrowReportPanel } from './BrowReportPanel'
import { FeatureReportPanel } from './FeatureReportPanel'
import { CheekReportPanel } from './CheekReportPanel'
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

export function CvReportView({
  activeId,
  cvReport,
  eyeAnalysis,
  featureNarratives = null,
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
}) {
  const narrativeFor = (featureId) =>
    resolveFeatureNarrative(featureNarratives, protocolNarrative, featureId)

  if (activeId === 'intro') {
    return <IntroductionSection />
  }

  if (activeId === 'disclaimer') {
    return <DisclaimerSection />
  }

  if (activeId === 'dimorphism' && cvReport?.dimorphism) {
    return <DimorphismSection dimorphism={cvReport.dimorphism} photo={photo} />
  }
  if (activeId === 'averageness' && cvReport?.averageness) {
    return <AveragenessSection averageness={cvReport.averageness} landmarks={landmarks} />
  }

  if (activeId === 'faceShape' && cvReport?.faceShape) {
    const fs = cvReport.faceShape
    const primaryMetrics = [
      fs.midfaceWidth != null && { label: 'Midface Width', value: fs.midfaceWidth },
      fs.foreheadWidth != null && { label: 'Forehead Width', value: fs.foreheadWidth },
      fs.lowerThirdWidth != null && { label: 'Lower Third Width', value: fs.lowerThirdWidth },
      fs.facialLength != null && { label: 'Facial Length', value: fs.facialLength },
    ].filter(Boolean)
    const extraMetrics = [
      fs.lengthToMidfaceRatio != null && { label: 'Length / Midface', value: fs.lengthToMidfaceRatio },
      fs.widthHeightRatio != null && { label: 'W / H Ratio', value: fs.widthHeightRatio },
    ].filter(Boolean)

    // Prefer front photo + SVG overlay (image-%); fall back to baked imageSrc alone
    const useSvgOverlay = Boolean(fs.overlay && photo)
    return (
      <div className="space-y-6">
        <ReportSectionHeading
          title="An overview of your"
          accent="face shape"
          subtitle="We've assessed your face shape as a whole, considering natural variations and facial angles."
        />
        <AssessmentGridLayout
          photo={photo || fs.imageSrc}
          photoOverlay={useSvgOverlay ? <FaceShapeOverlay overlay={fs.overlay} /> : null}
          photoFit="contain"
          rightCards={
            <>
              {fs.shape != null && (
                <div className="qoves-report-metric-card text-center py-5">
                  <p className="qoves-report-mono-label mb-3">Shape</p>
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
                  <p className="qoves-report-mono-label mb-2">Explanation</p>
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
          title="An overview of your"
          accent="symmetry"
          subtitle="We've assessed your facial symmetry as a whole, taking into account natural deviations and facial pose."
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
              <ReportMetricCard label="Symmetry Score" value={`${s.score}/100`} />
              <ReportMetricCard label="Classification" value={s.scoreLabel} />
              <div className="qoves-report-metric-card">
                <p className="qoves-report-mono-label mb-2">Symmetry Range</p>
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
                  <p className="qoves-report-mono-label mb-3">Regional balance</p>
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
                    Overall score already accounts for natural pose and left–right variation across these regions.
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
    const n = cvReport.nose
    const hasProfileAngles =
      n.nasofrontalAngleDeg != null || n.nasolabialAngleDeg != null || n.dorsalHumpDeviation != null
    const summaryCards = [
      { label: 'Width Class', value: n.width },
      { label: 'Width/Length', value: n.widthLengthRatio },
      { label: 'Nose/Face Ratio', value: n.noseRatio },
      { label: 'Bridge Width', value: `${n.bridgeWidth}%` },
    ]
    if (n.nasofrontalAngleDeg != null) {
      summaryCards.push({ label: 'Nasofrontal', value: `${n.nasofrontalAngleDeg}°` })
    }
    if (n.nasolabialAngleDeg != null) {
      summaryCards.push({
        label: 'Nasolabial',
        value: `${n.nasolabialAngleDeg}°`,
        tooltip: n.nasolabialNormalRange ? `Typical range ${n.nasolabialNormalRange}` : undefined,
      })
    }
    if (n.dorsalHumpLabel || n.dorsalHumpDeviation != null) {
      summaryCards.push({
        label: 'Dorsal hump',
        value: n.dorsalHumpLabel || String(n.dorsalHumpDeviation),
      })
    }
    const details = [{
      title: 'Nasal Proportions',
      metricLabel: 'Width/Length Ratio',
      metricValue: n.widthLengthRatio,
      markerPct: Math.min(100, Math.max(0, parseFloat(n.widthLengthRatio) * 150)),
      rangeMin: 40,
      rangeMax: 70,
    }]
    if (hasProfileAngles) {
      details.push({
        title: 'Profile Angles',
        metricLabel: 'Nasofrontal',
        metricValue: n.nasofrontalAngleDeg != null ? `${n.nasofrontalAngleDeg}°` : '—',
        markerPct: n.nasofrontalAngleDeg != null
          ? Math.min(100, Math.max(0, ((n.nasofrontalAngleDeg - 100) / 50) * 100))
          : 50,
        rangeMin: 115,
        rangeMax: 130,
      })
    }
    return (
      <FeatureAnalysisPage
        featureName="nose"
        subtitle="Nasal proportionality and structure"
        heroImage={n.imageSrc}
        summaryCards={summaryCards}
        details={details}
      >
        <FeatureProseBlock narrative={narrativeFor('nose')} fallbackExplanation={n.explanation} />
      </FeatureAnalysisPage>
    )
  }

  // Lips
  if (activeId === 'lips' && cvReport?.lips) {
    const l = cvReport.lips
    return (
      <FeatureAnalysisPage
        featureName="lips"
        subtitle="Perioral proportionality and volume"
        heroImage={l.imageSrc}
        summaryCards={[
          { label: 'Fullness', value: l.fullness },
          { label: 'Philtrum', value: l.philtrum },
          { label: 'Lip Width Ratio', value: l.lipWidthRatio },
          { label: 'Philtrum/Lip', value: l.philtrumToLipRatio },
        ]}
        details={[{
          title: 'Lip Volume',
          metricLabel: 'Lip Fullness Index',
          metricValue: l.lipFullness,
          markerPct: Math.min(100, Math.max(0, parseFloat(l.lipFullness) * 200)),
          rangeMin: 35,
          rangeMax: 70,
        }]}
      >
        <FeatureProseBlock narrative={narrativeFor('lips')} fallbackExplanation={l.explanation} />
      </FeatureAnalysisPage>
    )
  }

  // Eyes (brows live on the separate Eyebrows tab — do not repeat here)
  if (activeId === 'eyes' && eyeAnalysis) {
    return (
      <EyeReportPanel
        eyeAnalysis={eyeAnalysis}
        narrative={eyesNarrativeWithoutBrows(narrativeFor('eyes'))}
      />
    )
  }

  // Eyebrows
  if (activeId === 'eyebrows' && cvReport?.eyebrows) {
    return (
      <BrowReportPanel
        eyebrows={cvReport.eyebrows}
        narrative={resolveEyebrowsNarrative(featureNarratives, protocolNarrative)}
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
      <FeatureReportPanel
        title="Jaw Analysis"
        featureName="jaw"
        data={j}
        narrative={narrativeFor('jaw')}
        imageSrc={jawSrc}
        imageAlt="Your jaw"
        sections={[
          {
            title: 'Mandibular Structure',
            metrics: [
              { label: 'Jaw width', value: `${j.jawWidth}%`, tooltip: 'Jaw width as a percentage of facial width. A balanced jaw frames the lower face harmoniously.' },
              { label: 'Width class', value: j.jawWidthClass, tooltip: 'Classification of jaw width relative to cheek width. Balanced jaws provide strong facial framing.' },
              { label: 'Mandibular angle', value: `${j.jawAngle}Â°`, tooltip: 'The angle of the mandible. Defined angles (120-140Â°) create a sculpted look; softer angles create a rounder appearance.' },
              { label: 'Definition', value: j.mandibularDefinition, tooltip: 'How angular or soft the jawline appears. Defined jawlines are associated with facial attractiveness.' },
            ],
          },
          {
            title: 'Jaw Proportions',
            metrics: [
              { label: 'Jaw length', value: `${j.jawLength}%`, tooltip: 'Jaw length as a percentage of face height. Balanced length contributes to harmonious lower facial thirds.' },
              { label: 'Length class', value: j.jawLengthClass, tooltip: 'Classification of jaw length. Balanced jaws maintain proportion with mid and upper face.' },
              { label: 'Contour smoothness', value: j.contourSmoothness, tooltip: 'How smooth the jawline contour appears. Smooth contours create an elegant profile.' },
              { label: 'Jawline definition', value: j.jawlineDefinition, tooltip: 'Shadow and depth definition along the jawline edge. Well-defined jawlines create facial dimension.' },
            ],
          },
        ]}
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
    return (
      <FeatureReportPanel
        title="Chin Analysis"
        featureName="chin"
        data={c}
        narrative={narrativeFor('chin')}
        imageSrc={chinSrc}
        imageAlt="Your chin"
        sections={[
          {
            title: 'Chin Proportions',
            metrics: [
              { label: 'Chin height', value: `${c.chinHeight}%`, tooltip: 'Chin height as a percentage of face height. A balanced chin contributes to harmonious lower facial thirds.' },
              { label: 'Height class', value: c.chinHeightClass, tooltip: 'Classification of chin height. Balanced chins complement the nose and forehead proportions.' },
              { label: 'Chin width', value: `${c.chinWidth}%`, tooltip: 'Chin width as a percentage of face width. Balanced width frames the lower face elegantly.' },
              { label: 'Width class', value: c.chinWidthClass, tooltip: 'Classification of chin width. Narrow chins create a delicate look; wider chins add strength.' },
            ],
          },
          {
            title: 'Chin Shape & Projection',
            metrics: [
              { label: 'Projection', value: c.projection, tooltip: 'Forward projection of the chin relative to the nose. Balanced projection creates a harmonious profile.' },
              { label: 'Shape', value: c.chinShape, tooltip: 'Contour shape of the chin. Round, soft square, or pointed — each contributes to facial character.' },
              { label: 'Labiomental angle', value: `${c.labiomentalAngle}°`, tooltip: 'The angle between the lower lip and chin. A defined angle (90-120°) creates a balanced profile.' },
              { label: 'Fold classification', value: c.labiomentalClassification, tooltip: 'Depth of the labiomental sulcus. Defined folds create facial dimension without appearing aged.' },
            ],
          },
        ]}
      />
    )
  }

  // â”€â”€ Hair â”€â”€
  if (activeId === 'hair' && cvReport?.hair) {
    const h = cvReport.hair
    const hasTopHeadData = h.densityPct !== undefined && h.densityPct !== null
    return (
      <FeatureReportPanel
        title="Hair Analysis"
        featureName="hair"
        data={h}
        narrative={narrativeFor('hair')}
        imageSrc={h.imageSrc}
        imageAlt="Your hair region"
        sections={[
          {
            title: 'Hair Overview',
            metrics: [
              { label: 'Hairline', value: h.hairline, tooltip: 'Hairline position and shape. A well-defined hairline frames the forehead harmoniously.' },
              { label: 'Density estimate', value: h.densityEstimate, tooltip: hasTopHeadData ? 'Real density measured from top-of-head photo.' : 'Estimated hair density from facial proportions.' },
              { label: 'Coverage', value: h.coverageEstimate, tooltip: hasTopHeadData ? 'Coverage measured from top-of-head photo pixel analysis.' : 'How well the hair covers the scalp.' },
              { label: 'Forehead exposure', value: h.foreheadExposure, tooltip: 'How much of the forehead is exposed by the hairline.' },
            ],
          },
          ...(hasTopHeadData ? [{
            title: 'Color & Texture',
            metrics: [
              { label: 'Hair color', value: h.hairColor, tooltip: 'Detected hair color from pixel analysis of the top-of-head photo.' },
              { label: 'Color sample', value: h.hairColorHex || 'N/A', tooltip: 'Average color of dark pixels in the hair region.' },
              { label: 'Texture type', value: h.textureType, tooltip: 'Hair texture estimated from edge analysis â€” curly/wavy hair has more complex edge patterns.' },
              { label: 'Density %', value: `${h.densityPct}%`, tooltip: 'Percentage of dark (hair) pixels in the top-of-head photo.' },
            ],
          }, {
            title: 'Crown & Scalp',
            metrics: [
              { label: 'Thinning', value: h.thinningArea, tooltip: 'Crown thinning detected by comparing left and right crown darkness.' },
              { label: 'Crown visibility', value: h.crownVisibility, tooltip: 'Whether thinning at the crown area is visible in the top-down photo.' },
            ],
          }] : []),
        ]}
        extraMetrics={!hasTopHeadData ? [
          { label: 'Note', value: 'Upload a top-of-head photo for real hair density & color analysis', tooltip: 'Hair density is estimated from your photos. A top-of-head photo improves accuracy.' },
        ] : undefined}
      />
    )
  }

  // â”€â”€ Smile â”€â”€
  if (activeId === 'smile' && cvReport?.smile) {
    const s = cvReport.smile
    const hasSmilePhotoData = s.teethVisibility && s.teethVisibility !== 'N/A'
    return (
      <FeatureReportPanel
        title="Smile Analysis"
        featureName="smile"
        data={s}
        narrative={narrativeFor('smile')}
        imageSrc={s.imageSrc}
        imageAlt="Your smile"
        sections={[
          {
            title: 'Mouth Proportions',
            metrics: [
              { label: 'Mouth width', value: `${s.mouthWidthRatio}Ã— IPD`, tooltip: 'Mouth width relative to interpupillary distance. The golden ratio suggests 1.2-1.5Ã— for balanced proportions.' },
              { label: 'Width class', value: s.mouthWidthClass, tooltip: 'Classification of mouth width. Balanced mouths complement nose and eye proportions.' },
              { label: 'Smile width', value: `${s.smileWidthRatio}Ã— nose`, tooltip: 'Smile width relative to nose width. A wider smile creates a more expressive appearance.' },
              { label: 'Smile width class', value: s.smileWidthClass, tooltip: 'Classification of smile width relative to nose. Wide smiles convey warmth and expressiveness.' },
            ],
          },
          {
            title: 'Smile Characteristics',
            metrics: [
              { label: 'Lip curvature', value: s.curvature, tooltip: 'The natural curvature of the lips. Upturned lips create a friendlier resting expression.' },
              { label: 'Curvature angle', value: `${s.curvaturePct}%`, tooltip: 'Numerical curvature measurement. Positive values indicate upturned, negative downturned.' },
              { label: 'Lip balance', value: s.lipBalance, tooltip: 'Upper to lower lip ratio. Balanced lips contribute to harmonious perioral aesthetics.' },
              { label: 'Nasolabial fold', value: s.nasolabialFold, tooltip: 'Prominence of the smile lines. Subtle folds indicate youthful skin with good elasticity.' },
            ],
          },
          ...(hasSmilePhotoData ? [{
            title: 'Teeth & Smile Quality',
            metrics: [
              { label: 'Teeth visibility', value: s.teethVisibility, tooltip: 'How much teeth are visible when smiling. Moderate to high visibility indicates an expressive smile.' },
              { label: 'Teeth whiteness', value: s.teethWhiteness, tooltip: 'Brightness of teeth detected from the smile photo. Whiter teeth enhance smile aesthetics.' },
              { label: 'Smile arc', value: s.smileArc, tooltip: 'The curvature of the upper teeth line. A consonant U-shape is considered ideal.' },
              { label: 'Gum exposure', value: s.gumExposure, tooltip: 'Amount of gum visible when smiling. Minimal gum show is generally preferred.' },
            ],
          }] : []),
        ]}
      />
    )
  }

  // â”€â”€ Neck â”€â”€
  if (activeId === 'neck' && cvReport?.neck) {
    const n = cvReport.neck
    return (
      <FeatureReportPanel
        title="Neck Analysis"
        featureName="neck"
        data={n}
        narrative={narrativeFor('neck')}
        imageSrc={n.imageSrc}
        imageAlt="Your neck"
        sections={[
          {
            title: 'Neck Proportions',
            metrics: [
              { label: 'Neck width', value: `${n.neckWidth}%`, tooltip: 'Neck width relative to interpupillary distance. A balanced neck frames the face elegantly.' },
              { label: 'Width class', value: n.neckWidthClass, tooltip: 'Classification of neck width. Balanced necks complement the jaw and shoulder proportions.' },
              { label: 'Neck length', value: `${n.neckLength}%`, tooltip: 'Neck length as a percentage of face height. Longer necks are associated with elegance.' },
              { label: 'Length class', value: n.neckLengthClass, tooltip: 'Classification of neck length. Balanced length harmonizes with overall body proportions.' },
            ],
          },
          {
            title: 'Posture & Transition',
            metrics: [
              { label: 'Jaw-neck transition', value: n.jawNeckTransition, tooltip: 'How smoothly the jawline transitions to the neck. Defined transitions create a clean silhouette.' },
              { label: 'Transition angle', value: `${n.jawNeckAngle}Â°`, tooltip: 'The angle between jawline and neck. Defined angles (120-150Â°) create a sculpted appearance.' },
              { label: 'Head posture', value: n.headPosture, tooltip: 'Head position relative to the shoulder line. Neutral posture is optimal for facial aesthetics.' },
              ...(n.headPostureAngleDeg != null
                ? [{ label: 'Posture angle', value: `${n.headPostureAngleDeg}°`, tooltip: 'Ear-to-shoulder offset from vertical. Near 0° is neutral; larger positive values suggest forward head posture.' }]
                : []),
              ...(n.shoulderWidthPct != null
                ? [{ label: 'Shoulder span', value: `${n.shoulderWidthPct}% IPD`, tooltip: 'Shoulder width relative to interpupillary distance from body pose landmarks.' }]
                : []),
              ...(n.dataSource
                ? [{ label: 'Data source', value: n.dataSource === 'measured' ? 'Jaw + shoulders' : 'Approximate', tooltip: n.limitation || 'Measured when shoulders are visible in the front photo.' }]
                : []),
            ],
          },
        ]}
      />
    )
  }

  // ── Ears ──
  if (activeId === 'ears' && cvReport?.ears) {
    const e = cvReport.ears
    const leftEarSrc = e.imageSrcLeft || photos?.leftProfile || cvReport?.photos?.leftProfile
    const rightEarSrc = e.imageSrcRight || photos?.rightProfile || cvReport?.photos?.rightProfile
    const profileImages = (leftEarSrc || rightEarSrc)
      ? { left: leftEarSrc, right: rightEarSrc }
      : undefined

    return (
      <FeatureReportPanel
        title="Ear Analysis"
        featureName="ears"
        data={e}
        narrative={narrativeFor('ears')}
        profileImages={profileImages}
        imageSrc={profileImages ? undefined : e.imageSrc}
        imageAlt="Your ears"
        sections={[
          {
            title: 'Ear Proportions',
            metrics: [
              { label: 'Ear size', value: `${e.earSize}× IPD`, tooltip: 'Ear size relative to interpupillary distance. Proportionate ears frame the face without drawing attention.' },
              { label: 'Size class', value: e.earSizeClass, tooltip: 'Classification of ear size. Balanced ears contribute to harmonious facial framing.' },
              { label: 'Symmetry', value: e.earSymmetry, tooltip: 'Left-right ear size balance. Symmetric ears indicate balanced facial development.' },
              { label: 'Size difference', value: `${e.sizeDifference}%`, tooltip: 'Percentage difference between left and right ear size. Under 5% is considered symmetric.' },
            ],
          },
          {
            title: 'Ear Position & Shape',
            metrics: [
              { label: 'Protrusion', value: e.protrusion, tooltip: 'How far the ears project from the head. Moderate protrusion creates a balanced silhouette.' },
              { label: 'Protrusion depth', value: `${e.earProtrusion}`, tooltip: 'Z-depth measurement of ear protrusion from the facial plane.' },
              { label: 'Vertical position', value: e.earPosition, tooltip: 'Ear vertical alignment relative to facial features. Mid-set ears align with brow-to-nose base.' },
            ],
          },
        ]}
      />
    )
  }

  // â”€â”€ Cheeks â”€â”€
  if (activeId === 'cheeks' && cvReport?.cheeks) {
    return <CheekReportPanel cheeks={cvReport.cheeks} narrative={narrativeFor('cheeks')} />
  }

  // â”€â”€ Skin Quality â”€â”€
  if (activeId === 'skin' && cvReport?.skin) {
    return <SkinReportPanel skin={cvReport.skin} narrative={narrativeFor('skin')} />
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
        aiNarrative={aiNarrative}
        protocolLoading={protocolLoading}
        onDownloadPdf={onDownloadPdf}
        pdfLoading={pdfLoading}
        canDownloadPdf={canDownloadPdf}
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
