#!/usr/bin/env node
/**
 * Self-check: ears hero uses landmarker contour crops only (not SegFormer squares).
 * Run: node artifacts/myface/scripts/test-ear-hero-fallback.js
 */
import assert from 'node:assert/strict'
import { resolveMeasurementProfilePose } from '../utils/earCapture.js'

function contourEarCropUrl(cropMeta) {
  if (!cropMeta?.publicUrl) return null
  if (cropMeta.sourceMethod === 'segformer_ears') return null
  return cropMeta.publicUrl
}

function resolveEarsParsingUrl(featureParsing, cvEars = null, poseOverride = null) {
  if (featureParsing?.status !== 'ready') return null
  const pose = poseOverride || resolveMeasurementProfilePose(cvEars)
  const crops = featureParsing?.crops || {}
  if (pose === 'rightProfile') return contourEarCropUrl(crops.earsRight)
  if (pose === 'leftProfile') return contourEarCropUrl(crops.earsLeft)
  return null
}

const fp = {
  status: 'ready',
  crops: {
    earsRight: { publicUrl: '/api/media/a/parsing/earsRight.jpg', sourceMethod: 'ear_landmarker_contour' },
    earsLeft: { publicUrl: '/api/media/a/parsing/earsLeft.jpg', sourceMethod: 'ear_landmarker_contour' },
    earsRightSegformer: { publicUrl: '/api/media/a/parsing/earsRightSegformer.jpg', sourceMethod: 'segformer_ears' },
  },
}

assert.equal(
  resolveEarsParsingUrl(fp, { measurementProfilePose: 'rightProfile' }),
  '/api/media/a/parsing/earsRight.jpg',
)
assert.equal(
  resolveEarsParsingUrl(fp, { measurementProfilePose: 'leftProfile' }),
  '/api/media/a/parsing/earsLeft.jpg',
)

const legacySegPrimary = {
  status: 'ready',
  crops: {
    earsRight: { publicUrl: '/api/media/a/parsing/earsRight.jpg', sourceMethod: 'segformer_ears' },
    earsRightSegformer: { publicUrl: '/api/media/a/parsing/earsRightSegformer.jpg', sourceMethod: 'segformer_ears' },
  },
}
assert.equal(resolveEarsParsingUrl(legacySegPrimary, { measurementProfilePose: 'rightProfile' }), null)

console.log('test-ear-hero-fallback: ok')
