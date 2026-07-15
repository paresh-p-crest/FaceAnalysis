import { protocolWarningsToMarkdown } from './protocolCheck'
import { formatAnswersSummary } from './onboarding'

export function buildAwsReport(faceDetails, metrics, answers, protocolWarnings = []) {
  if (!faceDetails || !metrics) return null
  const { goals, concerns, severity, occupation, smoking, medicalConditions } = formatAnswersSummary(answers)
  const emotions = (faceDetails.Emotions || [])
    .sort((a, b) => b.Confidence - a.Confidence)
    .slice(0, 3)
    .map((e) => `${e.Type} (${e.Confidence.toFixed(0)}%)`)
    .join(', ')

  const ageLow = faceDetails.AgeRange?.Low ?? '?'
  const ageHigh = faceDetails.AgeRange?.High ?? '?'
  const pose = faceDetails.Pose || {}
  const quality = faceDetails.Quality || {}
  const landmarkCount = faceDetails.Landmarks?.length ?? 0

  const smile = faceDetails.Smile?.Value ? `Yes (${faceDetails.Smile.Confidence?.toFixed(0)}%)` : 'No'
  const eyesOpen = faceDetails.EyesOpen?.Value ? 'Open' : 'Closed'
  const eyeglasses = faceDetails.Eyeglasses?.Value ? 'Detected' : 'Not detected'

  return `${protocolWarningsToMarkdown(protocolWarnings)}## Executive Summary

AWS Rekognition analyzed your facial image with **${faceDetails.Confidence?.toFixed(1)}% detection confidence**, mapping **${landmarkCount} facial landmarks**. Your stated goals: *${goals}*. Skin focus: *${concerns}* (${severity} severity). Lifestyle: ${occupation}, smoking ${smoking}, conditions: ${medicalConditions}.

**Harmony score:** ${metrics.harmonyScore}/100 · **Symmetry:** ${metrics.symmetry}% · **Estimated age:** ${metrics.visualAge} years (range ${ageLow}–${ageHigh})

---

## Structural Analysis

### Facial Proportions
- **Vertical thirds (upper / middle / lower):** ${metrics.upperThird} / ${metrics.middleThird} / ${metrics.lowerThird}
- **Proportionality index:** ${metrics.proportionality}%
- **Jawline angle (estimated):** ${metrics.jawlineAngle}°

### Head Pose (AWS measured)
- **Yaw:** ${pose.Yaw?.toFixed(1) ?? '—'}° · **Pitch:** ${pose.Pitch?.toFixed(1) ?? '—'}° · **Roll:** ${pose.Roll?.toFixed(1) ?? '—'}°

### Image Quality
- **Sharpness:** ${quality.Sharpness?.toFixed(0) ?? '—'} · **Brightness:** ${quality.Brightness?.toFixed(0) ?? '—'}
${metrics.pose ? `- **Pose summary:** ${metrics.pose}` : ''}

### Periorbital & Expression
- **Eyes:** ${eyesOpen} · **Smile detected:** ${smile}
- **Eyeglasses:** ${eyeglasses}
- **Dominant emotions:** ${emotions || 'N/A'}

### Symmetry
Facial symmetry index: **${metrics.symmetry}%** — derived from left/right eye landmark alignment.

---

## Detected Attributes (AWS Rekognition)

| Attribute | Value |
|-----------|-------|
| Gender | ${faceDetails.Gender?.Value ?? '—'} (${faceDetails.Gender?.Confidence?.toFixed(0) ?? '—'}%) |
| Age range | ${ageLow}–${ageHigh} years |
| Beard | ${faceDetails.Beard?.Value ? 'Yes' : 'No'} |
| Mustache | ${faceDetails.Mustache?.Value ? 'Yes' : 'No'} |
| Eyes open | ${eyesOpen} |
| Mouth open | ${faceDetails.MouthOpen?.Value ? 'Yes' : 'No'} |

---

## Personalized 30-Day Protocol

### Week 1–2: Baseline
- Maintain neutral expression and frontal pose for progress photos
- AM routine: cleanser → moisturizer → SPF 30+
- PM routine: gentle cleanser → hydrating moisturizer
${faceDetails.Eyeglasses?.Value ? '- **Remove glasses** for follow-up photos to improve periorbital accuracy' : '- Continue protocol-compliant photo habits'}

### Week 3–4: Targeted focus
- Address proportionality (${metrics.proportionality}%) with posture awareness and balanced midface care
- ${Math.abs(pose.Pitch ?? 0) > 10 ? 'Practice camera-at-eye-level to reduce head pitch' : 'Maintain current frontal alignment'}
- Track symmetry (${metrics.symmetry}%) with monthly comparison photos

### Strengths to maintain
1. **Detection confidence** — ${faceDetails.Confidence?.toFixed(1)}% face match quality
2. **Symmetry score** — ${metrics.symmetry}% from landmark analysis
3. **Image quality** — Sharpness ${quality.Sharpness?.toFixed(0) ?? '—'}/100

### Areas for review
1. **Head pitch** — ${Math.abs(pose.Pitch ?? 0).toFixed(1)}° (ideal: near 0° for frontal analysis)
2. **Proportionality** — ${metrics.proportionality}% — review midface balance
3. **Expression** — ${faceDetails.Smile?.Value ? 'Smile detected; use neutral expression for baseline' : 'Neutral expression — good for analysis'}
`
}