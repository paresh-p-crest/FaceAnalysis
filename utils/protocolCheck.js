export const PROTOCOL_ITEMS = [
  { id: 'glasses', label: 'Take off any glasses and hat' },
  { id: 'lighting', label: 'Use natural, even lighting on your face' },
  { id: 'background', label: 'Use a plain, neutral background' },
  { id: 'hair', label: 'Tie long hair back — face, neck and ears visible' },
  { id: 'makeup', label: 'Remove heavy makeup (light makeup OK)' },
  { id: 'clothing', label: 'Avoid neck-covering clothes (e.g. turtlenecks)' },
  { id: 'filters', label: "Don't use filters on the photo" },
]

export const PHOTO_POSES = [
  {
    id: 'front',
    label: 'Front Face',
    required: true,
    hint: 'Entire face head-on with a neutral expression',
  },
  {
    id: 'leftProfile',
    label: 'Left Profile',
    required: false,
    hint: 'Left side profile (optional)',
  },
  {
    id: 'rightProfile',
    label: 'Right Profile',
    required: false,
    hint: 'Right side profile (optional)',
  },
  {
    id: 'left45',
    label: 'Left 45°',
    required: false,
    hint: 'Three-quarter angle from left (optional)',
  },
  {
    id: 'right45',
    label: 'Right 45°',
    required: false,
    hint: 'Three-quarter angle from right (optional)',
  },
  {
    id: 'smile',
    label: 'Smile',
    required: false,
    hint: 'Smile naturally showing teeth (optional, improves smile analysis)',
  },
  {
    id: 'topHead',
    label: 'Top of Head',
    required: false,
    hint: 'Tilt head down showing top of head and hairline (optional, improves hair analysis)',
  },
]

/** Post-analysis protocol check from AWS Rekognition (real mode) */
export function detectProtocolViolations(faceDetails) {
  if (!faceDetails) return []

  const warnings = []
  const conf = (attr) => attr?.Value && (attr?.Confidence ?? 0) > 75

  if (conf(faceDetails.Eyeglasses)) {
    warnings.push({
      id: 'glasses-detected',
      severity: 'high',
      message: 'Eyeglasses detected — remove glasses and retake for accurate periorbital analysis.',
    })
  }
  if (conf(faceDetails.Sunglasses)) {
    warnings.push({
      id: 'sunglasses-detected',
      severity: 'high',
      message: 'Sunglasses detected — eyes must be fully visible.',
    })
  }

  const pose = faceDetails.Pose || {}
  if (Math.abs(pose.Yaw ?? 0) > 12) {
    warnings.push({
      id: 'pose-yaw',
      severity: 'medium',
      message: `Head turned sideways (${pose.Yaw?.toFixed(0)}° yaw) — use a direct front-facing photo.`,
    })
  }
  if (Math.abs(pose.Pitch ?? 0) > 15) {
    warnings.push({
      id: 'pose-pitch',
      severity: 'medium',
      message: `Head tilted up/down (${pose.Pitch?.toFixed(0)}° pitch) — keep camera at eye level.`,
    })
  }

  const quality = faceDetails.Quality || {}
  if ((quality.Sharpness ?? 100) < 35) {
    warnings.push({
      id: 'blur',
      severity: 'medium',
      message: 'Image appears blurry — use a sharper, well-focused photo.',
    })
  }
  if ((quality.Brightness ?? 50) < 25 || (quality.Brightness ?? 50) > 90) {
    warnings.push({
      id: 'lighting',
      severity: 'low',
      message: 'Uneven or poor lighting detected — retake with even, natural light.',
    })
  }

  if (!faceDetails.EyesOpen?.Value && (faceDetails.EyesOpen?.Confidence ?? 0) > 70) {
    warnings.push({
      id: 'eyes-closed',
      severity: 'medium',
      message: 'Eyes appear closed — keep eyes open with a neutral expression.',
    })
  }

  return warnings
}

export function protocolWarningsToMarkdown(warnings) {
  if (!warnings?.length) return ''
  return `## Photo Protocol Notice

The following issues may reduce analysis accuracy:

${warnings.map((w) => `- **${w.severity.toUpperCase()}:** ${w.message}`).join('\n')}

*Recommendation: Retake photos following the protocol checklist for best results.*

---`
}
