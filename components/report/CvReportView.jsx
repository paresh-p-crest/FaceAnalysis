import { EyeReportPanel } from '../EyeReportPanel'
import { ScoreScalePanel } from './ReportPanels'
import { FaceImageFrame, SymmetryOverlay, ProportionsOverlay } from './FaceImageFrame'
import { ExecutiveSummary } from './ExecutiveSummary'
import { FeatureSection, ProtocolSection } from './FeatureSection'
import { BrowReportPanel } from './BrowReportPanel'
import { FeatureReportPanel } from './FeatureReportPanel'
import { CheekReportPanel } from './CheekReportPanel'
import { SkinReportPanel } from './SkinReportPanel'
import { DimorphismSection } from './DimorphismSection'
import { AveragenessSection } from './AveragenessSection'
import { ProportionsSection } from './ProportionsSection'
import { Loader2 } from 'lucide-react'

export function CvReportView({ activeId, cvReport, eyeAnalysis, protocolData, protocolLoading }) {
  // ── Executive Summary ──
  if (activeId === 'summary') {
    return <ExecutiveSummary cvReport={cvReport} eyeAnalysis={eyeAnalysis} />
  }

  // ── Dimorphism ──
  if (activeId === 'dimorphism' && cvReport?.dimorphism) {
    return <DimorphismSection dimorphism={cvReport.dimorphism} />
  }

  // ── Averageness ──
  if (activeId === 'averageness' && cvReport?.averageness) {
    return <AveragenessSection averageness={cvReport.averageness} />
  }

  // ── Face Shape ──
  if (activeId === 'faceShape' && cvReport?.faceShape) {
    const fs = cvReport.faceShape
    return (
      <FeatureSection
        title="Face Shape Analysis"
        subtitle="Geometric landmark classification"
        imageSrc={fs.imageSrc}
        imageAspect="4/5"
        explanation={fs.explanation}
        metrics={[
          { label: 'Face shape', value: fs.shape },
          { label: 'Width/Height ratio', value: fs.widthHeightRatio },
          { label: 'Jaw width', value: `${fs.jawWidth}%` },
          { label: 'Cheek width', value: `${fs.cheekWidth}%` },
        ]}
      />
    )
  }

  // ── Symmetry ──
  if (activeId === 'symmetry' && cvReport?.symmetry) {
    const s = cvReport.symmetry
    return (
      <ScoreScalePanel
        title="Facial symmetry"
        subtitle="Left-right landmark balance · MediaPipe + OpenCV"
        score={s.score}
        scoreLabel={s.scoreLabel}
        scaleLeft={s.scaleLeft}
        scaleRight={s.scaleRight}
        scaleMarkerPct={s.scaleMarkerPct}
        rangeHighlight={s.rangeHighlight}
        explanation={s.explanation}
        imageSrc={s.imageSrc}
        overlay={s.symmetryDots ? <SymmetryOverlay dots={s.symmetryDots} /> : null}
      />
    )
  }

  // ── Proportions (Qoves-style tabbed ratio view) ──
  if (activeId === 'proportions' && cvReport?.proportions?.ratios) {
    return <ProportionsSection proportions={cvReport.proportions} />
  }

  // ── Jaw & Chin ──
  if (activeId === 'jawChin' && cvReport?.jawChin) {
    const j = cvReport.jawChin
    return (
      <FeatureSection
        title="Jaw & Chin Analysis"
        subtitle="Lower facial structure · contour and projection"
        score={j.score}
        scoreMax={100}
        scoreLabel={j.scoreLabel}
        scaleLeft="Soft"
        scaleRight="Strong"
        scaleMarkerPct={j.score}
        rangeHighlight={{ left: 55, width: 40 }}
        explanation={j.explanation}
        imageSrc={j.imageSrc}
        imageAspect="auto"
        metrics={[
          { label: 'Jaw shape', value: j.jawShape },
          { label: 'Chin type', value: j.chinType },
          { label: 'Face ratio', value: j.faceRatio },
          { label: 'Jaw angle', value: `${j.jawAngle}°` },
          { label: 'Chin depth', value: j.chinDepth },
        ]}
      />
    )
  }

  // ── Eyes ──
  if (activeId === 'eyes' && eyeAnalysis) {
    return <EyeReportPanel eyeAnalysis={eyeAnalysis} />
  }

  // ── Eyebrows ──
  if (activeId === 'eyebrows' && cvReport?.eyebrows) {
    return <BrowReportPanel eyebrows={cvReport.eyebrows} />
  }

  // ── Nose ──
  if (activeId === 'nose' && cvReport?.nose) {
    const n = cvReport.nose
    return (
      <FeatureSection
        title="Nose Analysis"
        subtitle="Nasal proportionality and structure"
        score={n.score}
        scoreMax={100}
        scoreLabel={n.scoreLabel}
        scaleLeft="Narrow"
        scaleRight="Broad"
        scaleMarkerPct={Math.min(100, Math.max(0, parseFloat(n.widthLengthRatio) * 150))}
        rangeHighlight={{ left: 40, width: 30 }}
        explanation={n.explanation}
        imageSrc={n.imageSrc}
        imageAspect="auto"
        metrics={[
          { label: 'Width class', value: n.width },
          { label: 'Width/Length ratio', value: n.widthLengthRatio },
          { label: 'Nose/Face ratio', value: n.noseRatio },
          { label: 'Bridge width', value: `${n.bridgeWidth}%` },
        ]}
      />
    )
  }

  // ── Lips ──
  if (activeId === 'lips' && cvReport?.lips) {
    const l = cvReport.lips
    return (
      <FeatureSection
        title="Lip Analysis"
        subtitle="Perioral proportionality and volume"
        score={l.score}
        scoreMax={100}
        scoreLabel={l.scoreLabel}
        scaleLeft="Thin"
        scaleRight="Full"
        scaleMarkerPct={Math.min(100, Math.max(0, parseFloat(l.lipFullness) * 200))}
        rangeHighlight={{ left: 35, width: 35 }}
        explanation={l.explanation}
        imageSrc={l.imageSrc}
        imageAspect="auto"
        metrics={[
          { label: 'Fullness', value: l.fullness },
          { label: 'Philtrum', value: l.philtrum },
          { label: 'Lip width ratio', value: l.lipWidthRatio },
          { label: 'Philtrum/Lip ratio', value: l.philtrumToLipRatio },
          { label: 'Lip fullness index', value: l.lipFullness },
        ]}
      />
    )
  }

  // ── Jaw ──
  if (activeId === 'jaw' && cvReport?.jaw) {
    const j = cvReport.jaw
    return (
      <FeatureReportPanel
        title="Jaw Analysis"
        data={j}
        imageSrc={j.imageSrc}
        imageAlt="Your jaw"
        sections={[
          {
            title: 'Mandibular Structure',
            metrics: [
              { label: 'Jaw width', value: `${j.jawWidth}%`, tooltip: 'Jaw width as a percentage of facial width. A balanced jaw frames the lower face harmoniously.' },
              { label: 'Width class', value: j.jawWidthClass, tooltip: 'Classification of jaw width relative to cheek width. Balanced jaws provide strong facial framing.' },
              { label: 'Mandibular angle', value: `${j.jawAngle}°`, tooltip: 'The angle of the mandible. Defined angles (120-140°) create a sculpted look; softer angles create a rounder appearance.' },
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
    return (
      <FeatureReportPanel
        title="Chin Analysis"
        data={c}
        imageSrc={c.imageSrc}
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

  // ── Hair ──
  if (activeId === 'hair' && cvReport?.hair) {
    const h = cvReport.hair
    const hasTopHeadData = h.densityPct !== undefined && h.densityPct !== null
    return (
      <FeatureReportPanel
        title="Hair Analysis"
        data={h}
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
              { label: 'Texture type', value: h.textureType, tooltip: 'Hair texture estimated from edge analysis — curly/wavy hair has more complex edge patterns.' },
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
          { label: 'Note', value: 'Upload a top-of-head photo for real hair density & color analysis', tooltip: 'MediaPipe face mesh doesn\'t capture hair directly. This analysis uses proportional estimates from facial landmarks.' },
        ] : undefined}
      />
    )
  }

  // ── Smile ──
  if (activeId === 'smile' && cvReport?.smile) {
    const s = cvReport.smile
    const hasSmilePhotoData = s.teethVisibility && s.teethVisibility !== 'N/A'
    return (
      <FeatureReportPanel
        title="Smile Analysis"
        data={s}
        imageSrc={s.imageSrc}
        imageAlt="Your smile"
        sections={[
          {
            title: 'Mouth Proportions',
            metrics: [
              { label: 'Mouth width', value: `${s.mouthWidthRatio}× IPD`, tooltip: 'Mouth width relative to interpupillary distance. The golden ratio suggests 1.2-1.5× for balanced proportions.' },
              { label: 'Width class', value: s.mouthWidthClass, tooltip: 'Classification of mouth width. Balanced mouths complement nose and eye proportions.' },
              { label: 'Smile width', value: `${s.smileWidthRatio}× nose`, tooltip: 'Smile width relative to nose width. A wider smile creates a more expressive appearance.' },
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

  // ── Neck ──
  if (activeId === 'neck' && cvReport?.neck) {
    const n = cvReport.neck
    return (
      <FeatureReportPanel
        title="Neck Analysis"
        data={n}
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
              { label: 'Transition angle', value: `${n.jawNeckAngle}°`, tooltip: 'The angle between jawline and neck. Defined angles (120-150°) create a sculpted appearance.' },
              { label: 'Head posture', value: n.headPosture, tooltip: 'Estimated head position from landmark z-depths. Neutral posture is optimal for facial aesthetics.' },
            ],
          },
        ]}
      />
    )
  }

  // ── Ears ──
  if (activeId === 'ears' && cvReport?.ears) {
    const e = cvReport.ears
    return (
      <FeatureReportPanel
        title="Ear Analysis"
        data={e}
        imageSrc={e.imageSrc}
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

  // ── Cheeks ──
  if (activeId === 'cheeks' && cvReport?.cheeks) {
    return <CheekReportPanel cheeks={cvReport.cheeks} />
  }

  // ── Skin Quality ──
  if (activeId === 'skin' && cvReport?.skin) {
    return <SkinReportPanel skin={cvReport.skin} />
  }

  // ── Protocol/Recommendations ──
  if (activeId === 'protocol') {
    if (protocolLoading) {
      return (
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <Loader2 className="w-8 h-8 text-brand animate-spin" />
          <p className="text-ink-muted text-sm font-sans">Generating personalized protocol…</p>
        </div>
      )
    }

    const recs = protocolData?.recommendations || []
    const sourceLabel = protocolData?.source === 'openai' ? 'AI-generated' : 'Template-based'

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${
            protocolData?.source === 'openai'
              ? 'bg-brand-50 text-brand border-brand/20'
              : 'bg-surface-warm text-ink-muted border-surface-border'
          }`}>
            {sourceLabel}
          </span>
        </div>
        {protocolData?.summary && (
          <p className="text-sm text-ink-secondary leading-relaxed font-sans">{protocolData.summary}</p>
        )}
        <ProtocolSection recommendations={recs} />
      </div>
    )
  }

  return null
}
