#!/usr/bin/env node
/**
 * Fixture tests for profile noseRatio pose bands (pure math, no MediaPipe).
 * Calibrate real ratios: python scripts/calibrate_profile_nose_ratio.py
 */
import assert from 'node:assert/strict'
import {
  classifyPoseFromNoseRatio,
  evaluateNoseRatioPose,
  POSE_NOSE_RATIO_RANGES,
  translateValidationMessage,
} from '../utils/photoValidation.js'

const t = (key, values) => {
  const map = {
    'validation.detectedPose.leftProfile': 'left profile',
    'validation.detectedPose.rightProfile': 'right profile',
    'validation.detectedPose.left45': 'left 45°',
    'validation.detectedPose.right45': 'right 45°',
    'validation.detectedPose.frontFacing': 'front-facing',
    'validation.expectedPose.leftProfile': 'left profile',
    'validation.expectedPose.rightProfile': 'right profile',
    'validation.correctPose.wrong': `Face is ${values?.detected}, expected ${values?.expected}`,
  }
  return map[key] ?? key
}

/** Synthetic band-centre fixtures — replace with calibrated values from demo photos. */
const FIXTURES = [
  { expectedPose: 'leftProfile', noseRatio: 0.12, shouldPass: true, detectedClass: 'leftProfile' },
  { expectedPose: 'leftProfile', noseRatio: 0.88, shouldPass: false, detectedClass: 'rightProfile' },
  { expectedPose: 'rightProfile', noseRatio: 0.88, shouldPass: true, detectedClass: 'rightProfile' },
  { expectedPose: 'rightProfile', noseRatio: 0.12, shouldPass: false, detectedClass: 'leftProfile' },
  { expectedPose: 'front', noseRatio: 0.50, shouldPass: true, detectedClass: 'front' },
  { expectedPose: 'left45', noseRatio: 0.35, shouldPass: true, detectedClass: 'left45' },
  { expectedPose: 'right45', noseRatio: 0.65, shouldPass: true, detectedClass: 'right45' },
]

let failed = 0

for (const fx of FIXTURES) {
  const classified = classifyPoseFromNoseRatio(fx.noseRatio)
  const evalResult = evaluateNoseRatioPose(fx.noseRatio, fx.expectedPose)
  const passOk = evalResult.pass === fx.shouldPass
  const classOk = classified === fx.detectedClass
  if (!passOk || !classOk) {
    failed += 1
    console.error(
      `FAIL ${fx.expectedPose} ratio=${fx.noseRatio}: pass=${evalResult.pass} (want ${fx.shouldPass}), detected=${classified} (want ${fx.detectedClass})`,
    )
  }
}

assert.ok(POSE_NOSE_RATIO_RANGES.leftProfile.max < POSE_NOSE_RATIO_RANGES.rightProfile.min, 'profile bands must not overlap')

const wrongMsg = translateValidationMessage(
  {
    name: 'correctPose',
    pass: false,
    messageKey: 'Photo.validation.correctPose.wrong',
    messageValues: {
      detected: 'Photo.validation.detectedPose.leftProfile',
      expected: 'Photo.validation.expectedPose.rightProfile',
    },
    severity: 'error',
  },
  t,
)
assert.match(wrongMsg, /left profile/)
assert.match(wrongMsg, /right profile/)

if (failed === 0) {
  console.log(`All ${FIXTURES.length} profile pose fixture checks passed.`)
  process.exit(0)
}
console.error(`${failed} fixture check(s) failed.`)
process.exit(1)
