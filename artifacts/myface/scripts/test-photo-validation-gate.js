#!/usr/bin/env node
/**
 * Unit checks for FE photo validation upload gate (warning vs error).
 * Run: node artifacts/myface/scripts/test-photo-validation-gate.js
 */
import assert from 'node:assert/strict'
import {
  validationBlocksUpload,
  getFailedValidationChecks,
  getPrimaryValidationErrorMessage,
  getValidationWarningMessages,
  translateValidationMessage,
  combineChecks,
  evaluateHairMaskQuality,
} from '../utils/photoValidation.js'

const t = (key, values) => {
  if (key === 'validation.sharpness.blurry') return 'Image appears slightly blurry'
  if (key === 'validation.noGlasses.possible') return 'Possible glasses detected'
  if (key === 'validation.faceDetected.none') return 'No face detected'
  if (key === 'validation.hairMask.missing') {
    return 'Top of head is not properly visible. Tilt your head down so the crown and hairline show clearly'
  }
  if (key === 'validation.hairMask.weak') {
    return 'Top of head is not clear enough. Fill more of the frame with the crown and hairline'
  }
  if (key === 'validation.faceConfirm.topHeadUnconfirmed') {
    return 'Top-down angle could not be independently confirmed'
  }
  if (key === 'validation.correctPose.wrong') {
    return `Face is ${values?.detected || 'wrong'}, expected ${values?.expected || 'pose'}`
  }
  if (key === 'validation.faceCentered.offCenter') {
    return `Face is ${values?.direction || 'off-center'}`
  }
  if (key === 'validation.faceCentered.left') return 'left'
  return key
}

const warnOnly = {
  overall: 'warn',
  checks: [
    { name: 'sharpness', pass: false, messageKey: 'Photo.validation.sharpness.blurry', severity: 'warning' },
    { name: 'noGlasses', pass: false, messageKey: 'Photo.validation.noGlasses.possible', severity: 'warning' },
  ],
}

const errorOnly = {
  overall: 'fail',
  checks: [
    { name: 'faceDetected', pass: false, messageKey: 'Photo.validation.faceDetected.none', severity: 'error' },
  ],
}

const mixed = {
  overall: 'fail',
  checks: [
    ...warnOnly.checks,
    ...errorOnly.checks,
  ],
}

assert.equal(validationBlocksUpload(warnOnly), false, 'warnings alone must not block upload')
assert.equal(validationBlocksUpload(errorOnly), true, 'error-severity must block upload')
assert.equal(validationBlocksUpload(mixed), true, 'any error blocks even with warnings')
assert.equal(validationBlocksUpload(null), false, 'null result is not blocking')
assert.equal(validationBlocksUpload({ checks: [] }), false, 'empty checks is not blocking')

assert.equal(getFailedValidationChecks(warnOnly, 'warning').length, 2)
assert.equal(getFailedValidationChecks(warnOnly, 'error').length, 0)
assert.equal(getFailedValidationChecks(mixed, 'all').length, 3)

assert.equal(
  getPrimaryValidationErrorMessage(warnOnly, t),
  '',
  'warn-only must not produce a blocking error message',
)
assert.equal(
  getPrimaryValidationErrorMessage(errorOnly, t),
  'No face detected',
)
assert.equal(
  translateValidationMessage(warnOnly.checks[0], t),
  'Image appears slightly blurry',
)
assert.deepEqual(getValidationWarningMessages(warnOnly, t), [
  'Image appears slightly blurry',
  'Possible glasses detected',
])

// topHead hair-primary: strong hair + no face → warn, allow upload
const topHeadHairOnly = combineChecks(
  [{ name: 'hairMask', pass: true, messageKey: 'Photo.validation.hairMask.ok', severity: 'ok' }],
  {
    name: 'faceConfirm',
    pass: false,
    messageKey: 'Photo.validation.faceConfirm.topHeadUnconfirmed',
    severity: 'warning',
  },
)
assert.equal(topHeadHairOnly.overall, 'warn')
assert.equal(validationBlocksUpload(topHeadHairOnly), false)
assert.deepEqual(getValidationWarningMessages(topHeadHairOnly, t), [
  'Top-down angle could not be independently confirmed',
])

// Weak/no hair → reject
const topHeadNoHair = combineChecks({
  name: 'hairMask',
  pass: false,
  messageKey: 'Photo.validation.hairMask.missing',
  severity: 'error',
})
assert.equal(topHeadNoHair.overall, 'fail')
assert.equal(validationBlocksUpload(topHeadNoHair), true)
assert.match(
  getPrimaryValidationErrorMessage(topHeadNoHair, t),
  /Top of head is not properly visible/,
)

// Face + pitch not top-down → warn, still allow upload (hair is the gate)
const topHeadSoftPitch = combineChecks(
  [{ name: 'hairMask', pass: true, messageKey: 'Photo.validation.hairMask.ok', severity: 'ok' }],
  {
    name: 'correctPose',
    pass: false,
    messageKey: 'Photo.validation.correctPose.wrong',
    messageValues: { detected: 'front', expected: 'topHead' },
    severity: 'warning',
  },
)
assert.equal(topHeadSoftPitch.overall, 'warn')
assert.equal(validationBlocksUpload(topHeadSoftPitch), false)

// evaluateHairMaskQuality: empty / solid / scattered
const w = 40
const h = 40
const empty = new Uint8Array(w * h)
assert.equal(evaluateHairMaskQuality(empty, w, h).reason, 'missing')

const solid = new Uint8Array(w * h)
for (let y = 0; y < Math.floor(h * 0.5); y++) {
  for (let x = Math.floor(w * 0.2); x < Math.floor(w * 0.8); x++) {
    solid[y * w + x] = 1
  }
}
assert.equal(evaluateHairMaskQuality(solid, w, h).pass, true)

const speckled = new Uint8Array(w * h)
for (let i = 0; i < speckled.length; i += 17) speckled[i] = 1
assert.equal(evaluateHairMaskQuality(speckled, w, h).pass, false)

console.log('All photo validation gate checks passed.')
