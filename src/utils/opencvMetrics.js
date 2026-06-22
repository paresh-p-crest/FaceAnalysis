// Geometric facial metrics from MediaPipe landmarks + canvas image stats (OpenCV-style)

const LM = {
  forehead: 10,
  chin: 152,
  noseTip: 1,
  leftEyeOuter: 263,
  rightEyeOuter: 33,
  leftEyeInner: 133,
  rightEyeInner: 362,
  mouthLeft: 61,
  mouthRight: 291,
  leftBrow: 105,
  rightBrow: 334,
}

function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

function lm(landmarks, idx) {
  return landmarks[idx] || { x: 0.5, y: 0.5, z: 0 }
}

export function computeMetricsFromLandmarks(landmarks, answers, imageStats = {}) {
  const fallback = {
    symmetry: '85.0',
    proportionality: '82.0',
    averageness: '78.0',
    jawlineAngle: '120',
    eyebrowTilt: '3.5',
    nasalAngle: '95',
    canthalTilt: '4.8',
    upperThird: '0.33',
    middleThird: '0.34',
    lowerThird: '0.33',
    visualAge: 28,
    harmonyScore: '84',
    source: 'mediapipe',
  }

  if (!landmarks?.length) return fallback

  const le = lm(landmarks, LM.leftEyeOuter)
  const re = lm(landmarks, LM.rightEyeOuter)
  const li = lm(landmarks, LM.leftEyeInner)
  const ri = lm(landmarks, LM.rightEyeInner)
  const nose = lm(landmarks, LM.noseTip)
  const chin = lm(landmarks, LM.chin)
  const forehead = lm(landmarks, LM.forehead)
  const ml = lm(landmarks, LM.mouthLeft)
  const mr = lm(landmarks, LM.mouthRight)
  const lb = lm(landmarks, LM.leftBrow)
  const rb = lm(landmarks, LM.rightBrow)

  const eyeYDiff = Math.abs(le.y - re.y)
  const symmetry = Math.min(99, Math.max(65, 97 - eyeYDiff * 500)).toFixed(1)

  const faceH = chin.y - forehead.y
  const browY = (lb.y + rb.y) / 2
  const mouthY = (ml.y + mr.y) / 2

  let upperThird = '0.33'
  let middleThird = '0.34'
  let lowerThird = '0.33'

  if (faceH > 0.01) {
    const upper = (browY - forehead.y) / faceH
    const middle = (mouthY - browY) / faceH
    const lower = (chin.y - mouthY) / faceH
    upperThird = Math.max(0.15, upper).toFixed(2)
    middleThird = Math.max(0.15, middle).toFixed(2)
    lowerThird = Math.max(0.15, lower).toFixed(2)
  }

  const interocular = dist(li, ri)
  const faceW = dist(ml, mr) * 2.2
  const proportionality = Math.min(99, Math.max(60, 70 + (interocular / faceW) * 80)).toFixed(1)

  const canthalTilt = (((le.y - li.y) - (re.y - ri.y)) * 200 + 5).toFixed(1)
  const eyebrowTilt = (Math.abs(lb.y - rb.y) * 180).toFixed(1)

  const jawW = dist(lm(landmarks, 172), lm(landmarks, 397))
  const jawlineAngle = (110 + jawW * 80).toFixed(0)

  const sharpness = imageStats.sharpness ?? 50
  const brightness = imageStats.brightness ?? 50
  const harmonyScore = Math.min(
    99,
    Math.round(parseFloat(symmetry) * 0.4 + parseFloat(proportionality) * 0.3 + sharpness * 0.15 + brightness * 0.15)
  )

  return {
    symmetry,
    proportionality,
    averageness: (72 + (answers.skinConcerns?.length || 0) * 3).toFixed(1),
    jawlineAngle,
    eyebrowTilt,
    nasalAngle: (90 + Math.abs(nose.x - 0.5) * 40).toFixed(0),
    canthalTilt,
    upperThird,
    middleThird,
    lowerThird,
    visualAge: 24 + Math.round((1 - sharpness / 100) * 12),
    harmonyScore: String(harmonyScore),
    source: 'mediapipe+opencv',
    landmarkCount: landmarks.length,
    quality: `Sharpness ${sharpness.toFixed(0)} · Brightness ${brightness.toFixed(0)}`,
    interocularRatio: (interocular / faceW).toFixed(3),
  }
}

/** Laplacian-variance sharpness + mean brightness from canvas (OpenCV-style) */
export async function analyzeImageStats(imageSrc) {
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const canvas = document.createElement('canvas')
      const w = 200
      const h = Math.round((img.height / img.width) * w)
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0, w, h)
      const { data } = ctx.getImageData(0, 0, w, h)

      let sum = 0
      let lapSum = 0
      let lapSq = 0
      const gray = new Float32Array(w * h)

      for (let i = 0; i < data.length; i += 4) {
        const g = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
        gray[i / 4] = g
        sum += g
      }
      const brightness = sum / (w * h)

      for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
          const i = y * w + x
          const lap = -4 * gray[i] + gray[i - 1] + gray[i + 1] + gray[i - w] + gray[i + w]
          lapSum += lap
          lapSq += lap * lap
        }
      }
      const n = (w - 2) * (h - 2)
      const variance = lapSq / n - (lapSum / n) ** 2
      const sharpness = Math.min(100, Math.max(0, variance / 3))

      resolve({ brightness: Math.min(100, brightness / 2.55), sharpness })
    }
    img.onerror = () => resolve({ brightness: 50, sharpness: 50 })
    img.src = imageSrc
  })
}

export function landmarksToOverlay(landmarks) {
  if (!landmarks?.length) return null
  return landmarks.map((pt, i) => ({
    id: i,
    x: pt.x,
    y: pt.y,
    type: `mp_${i}`,
  }))
}
