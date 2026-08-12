/**
 * Photo upload REQUIRED checklist — first row is pose-specific (correctPose only).
 * Left/right = subject's anatomical side visible to the camera (ADR-050 convention).
 */

/** i18n: index 0 uses Photo.upload.poseInstructions.{activePose}; rest use guidelines.* */
export const GUIDELINE_KEYS = [
  'poseDirection',
  'neutralExpression',
  'clearObstructions',
  'armsLength',
  'oneHead',
  'notCropped',
  'notBlurry',
  'evenLighting',
  'plainBackground',
]

/** Maps each GUIDELINE_KEYS entry to validation check name(s). */
export const GUIDELINE_CHECK_MAP = [
  ['correctPose'],
  ['neutralExpression'],
  ['hairClear', 'noGlasses'],
  ['faceSize', 'faceCentered'],
  ['faceDetected', 'faceRequired', 'hairMask', 'faceConfirm'],
  ['faceSize'],
  ['sharpness'],
  ['brightness'],
  [],
]
