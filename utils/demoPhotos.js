/**
 * Real demo photos for the upload step.
 * Place the 5 images in public/demo-photos/ with these exact filenames:
 *   front.jpg, left-profile.jpg, right-profile.jpg, left-45.jpg, right-45.jpg
 */

export const DEMO_PHOTOS = {
  front: '/demo-photos/front.jpg',
  leftProfile: '/demo-photos/left-profile.jpg',
  rightProfile: '/demo-photos/right-profile.jpg',
  left45: '/demo-photos/left-45.jpg',
  right45: '/demo-photos/right-45.jpg',
  smile: '/demo-photos/smile.jpg',
  topHead: '/demo-photos/top-head.jpg',
}

export function getDemoPhoto(poseId) {
  return DEMO_PHOTOS[poseId] || DEMO_PHOTOS.front
}

/** All demo photo URLs keyed by pose id */
export function getAllDemoPhotos() {
  return { ...DEMO_PHOTOS }
}
