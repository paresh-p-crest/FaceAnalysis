/**
 * Self-check: earCapture gate (shoulder misdetection vs mid-face ear).
 * Run: node artifacts/myface/scripts/test-ear-capture.js
 */

import { evaluateEarCapture, pickProfileEarSide } from '../utils/earCapture.js'

const goodRight = {
  poseId: 'rightProfile',
  status: 'ready',
  edgeCollapseFrac: 0.08,
  confidences: Array(20).fill(0.5),
  repairedIndices: [],
  measurements: {
    verticalHeightNorm: 0.14,
    helixTop: { x: 0.72, y: 0.28 },
    softBottom: { x: 0.72, y: 0.42 },
    xMinNorm: 0.65,
    xMaxNorm: 0.78,
  },
}

const shoulderMisdetect = {
  poseId: 'rightProfile',
  status: 'ready',
  edgeCollapseFrac: 0.08,
  confidences: Array(20).fill(0.4),
  repairedIndices: [],
  measurements: {
    verticalHeightNorm: 0.22,
    helixTop: { x: 0.85, y: 0.55 },
    softBottom: { x: 0.88, y: 0.82 },
    xMinNorm: 0.80,
    xMaxNorm: 0.92,
  },
}

if (!evaluateEarCapture(goodRight).proper) throw new Error('mid-face ear should pass')
if (evaluateEarCapture(shoulderMisdetect).proper) throw new Error('shoulder misdetect should fail')

const goodLeft = {
  ...goodRight,
  poseId: 'leftProfile',
  measurements: {
    verticalHeightNorm: 0.14,
    helixTop: { x: 0.28, y: 0.28 },
    softBottom: { x: 0.28, y: 0.42 },
    xMinNorm: 0.22,
    xMaxNorm: 0.35,
  },
}

const picked = pickProfileEarSide({
  earLandmarkSource: 'ear_landmarker',
  sides: { right: shoulderMisdetect, left: goodLeft },
})
if (picked?.poseId !== 'leftProfile') throw new Error('should pick left when right misdetected')

console.log('test-ear-capture: ok')
