/**
 * Self-check: naso-aural profile plate — right first via earCapture.
 * Run: node artifacts/myface/scripts/test-naso-aural-profile-pose.js
 */

import { pickProfileEarSide, resolveMeasurementProfilePose } from '../utils/earCapture.js'

function profilePhotoForPose(photos, poseId, fallbackSrc = null) {
  const primary = poseId === 'leftProfile' ? photos?.leftProfile : photos?.rightProfile
  if (primary) return primary
  if (fallbackSrc && poseId && new RegExp(poseId, 'i').test(String(fallbackSrc))) return fallbackSrc
  return null
}

const photos = {
  leftProfile: '/media/leftProfile.jpg',
  rightProfile: '/media/rightProfile.jpg',
}

const mkSide = (poseId, helixY, lobeY, xMin, xMax) => ({
  status: 'ready',
  poseId,
  landmarks: Array(20).fill(0),
  edgeCollapseFrac: 0.08,
  confidences: Array(20).fill(0.5),
  repairedIndices: [],
  measurements: {
    verticalHeightNorm: lobeY - helixY,
    helixTop: { x: xMax - 0.06, y: helixY },
    softBottom: { x: xMax - 0.06, y: lobeY },
    xMinNorm: xMin,
    xMaxNorm: xMax,
  },
})

const ears = {
  earLandmarkSource: 'ear_landmarker',
  sides: {
    right: mkSide('rightProfile', 0.28, 0.42, 0.65, 0.78),
    left: mkSide('leftProfile', 0.28, 0.42, 0.22, 0.35),
  },
}

if (pickProfileEarSide(ears)?.poseId !== 'rightProfile') {
  throw new Error('right must win when both proper')
}

const badRight = {
  ...ears,
  sides: {
    right: mkSide('rightProfile', 0.55, 0.82, 0.80, 0.92),
    left: ears.sides.left,
  },
}
if (pickProfileEarSide(badRight)?.poseId !== 'leftProfile') {
  throw new Error('left when right shoulder misdetect')
}

const pose = resolveMeasurementProfilePose({ measurementProfilePose: 'leftProfile' })
if (pose !== 'leftProfile') throw new Error('measurementProfilePose respected')

console.log('test-naso-aural-profile-pose: ok')
