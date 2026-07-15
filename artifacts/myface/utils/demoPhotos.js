/**
 * Real demo photos for the upload step.
 * Place the 5 images in public/demo-photos/ with these exact filenames:
 *   front.png, left-profile.png, right-profile.png, left-45.png, right-45.png
 */

export const DEMO_PHOTOS = {
  front: '/demo-photos/front.png',
  leftProfile: '/demo-photos/left-profile.png',
  rightProfile: '/demo-photos/right-profile.png',
  left45: '/demo-photos/left-45.png',
  right45: '/demo-photos/right-45.png',
  smile: '/demo-photos/smile.png',
  topHead: '/demo-photos/top-head.png',
}

export function getDemoPhoto(poseId) {
  return DEMO_PHOTOS[poseId] || DEMO_PHOTOS.front
}

/** All demo photo URLs keyed by pose id */
export function getAllDemoPhotos() {
  return { ...DEMO_PHOTOS }
}
