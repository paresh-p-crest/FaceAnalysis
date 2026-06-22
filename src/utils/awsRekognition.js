import { getAwsCredentials, hasAwsCredentials } from './settings'

export async function analyzeFaceWithAWS(imageDataUrl) {
  if (!hasAwsCredentials()) return null

  const creds = getAwsCredentials()
  const imageBase64 = imageDataUrl.includes(',') ? imageDataUrl.split(',')[1] : imageDataUrl

  const res = await fetch('/api/analyze-face', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      imageBase64,
      accessKeyId: creds.accessKeyId,
      secretAccessKey: creds.secretAccessKey,
      sessionToken: creds.sessionToken,
      region: creds.region,
    }),
  })

  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(data.error || `AWS analysis failed (${res.status})`)
  }

  return data.faceDetails || null
}

export function landmarksFromAWS(faceDetails) {
  if (!faceDetails?.Landmarks?.length) return null
  return faceDetails.Landmarks.map((lm, i) => ({
    id: i,
    x: lm.X,
    y: lm.Y,
    type: lm.Type,
  }))
}

export function computeMetricsFromAWS(faceDetails, answers) {
  if (!faceDetails) return null

  const defaults = {
    symmetry: '85.0',
    canthalTilt: '4.5',
    upperThird: '0.33',
    middleThird: '0.34',
    lowerThird: '0.33',
    averageness: '75.0',
  }

  const landmarks = faceDetails.Landmarks || []
  const leftEye = landmarks.find((l) => l.Type === 'eyeLeft')
  const rightEye = landmarks.find((l) => l.Type === 'eyeRight')
  const nose = landmarks.find((l) => l.Type === 'nose')
  const chin = landmarks.find((l) => l.Type === 'chinBottom')
  const mouthTop = landmarks.find((l) => l.Type === 'mouthUp')

  let symmetry = defaults.symmetry
  if (leftEye && rightEye) {
    const eyeYDiff = Math.abs(leftEye.Y - rightEye.Y)
    symmetry = Math.min(99, Math.max(60, 97 - eyeYDiff * 400)).toFixed(1)
  }

  const pose = faceDetails.Pose || {}
  const quality = faceDetails.Quality || {}
  const ageLow = faceDetails.AgeRange?.Low ?? 25
  const ageHigh = faceDetails.AgeRange?.High ?? 35

  let upperThird = defaults.upperThird
  let middleThird = defaults.middleThird
  let lowerThird = defaults.lowerThird

  if (leftEye && chin && mouthTop) {
    const eyeY = (leftEye.Y + rightEye.Y) / 2
    const total = chin.Y - eyeY + 0.15
    if (total > 0) {
      const upper = (mouthTop.Y - eyeY) / total
      const lower = (chin.Y - mouthTop.Y) / total
      const middle = 1 - upper - lower
      upperThird = Math.max(0.2, upper).toFixed(2)
      middleThird = Math.max(0.2, middle).toFixed(2)
      lowerThird = Math.max(0.2, lower).toFixed(2)
    }
  }

  const sharpness = quality.Sharpness ?? 50
  const brightness = quality.Brightness ?? 50
  const harmony = Math.min(
    99,
    Math.round(sharpness * 0.35 + brightness * 0.15 + parseFloat(symmetry) * 0.5)
  )

  return {
    symmetry,
    proportionality: Math.min(99, (sharpness * 0.7 + 25)).toFixed(1),
    averageness: defaults.averageness,
    jawlineAngle: (112 + Math.abs(pose.Yaw || 0) * 1.5).toFixed(0),
    eyebrowTilt: Math.abs(pose.Roll || 0).toFixed(1),
    nasalAngle: (92 + Math.abs(pose.Pitch || 0) * 2).toFixed(0),
    canthalTilt: defaults.canthalTilt,
    upperThird,
    middleThird,
    lowerThird,
    visualAge: Math.round((ageLow + ageHigh) / 2),
    harmonyScore: String(harmony),
    source: 'aws',
    confidence: faceDetails.Confidence?.toFixed(1),
    emotions: faceDetails.Emotions?.slice(0, 3).map((e) => `${e.Type} (${e.Confidence?.toFixed(0)}%)`).join(', '),
    pose: `Yaw ${pose.Yaw?.toFixed(1)}° · Pitch ${pose.Pitch?.toFixed(1)}° · Roll ${pose.Roll?.toFixed(1)}°`,
    quality: `Sharpness ${sharpness.toFixed(0)} · Brightness ${brightness.toFixed(0)}`,
    smile: faceDetails.Smile?.Value ? `Yes (${faceDetails.Smile.Confidence?.toFixed(0)}%)` : 'No',
    eyesOpen: faceDetails.EyesOpen?.Value ? 'Open' : 'Closed',
  }
}
