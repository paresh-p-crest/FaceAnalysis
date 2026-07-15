/**
 * Compute the visible image content box inside a container for CSS object-fit.
 * Returns pixel offsets/sizes relative to the container (img's client box).
 *
 * Landmark overlays in 0–100 image-% space must be positioned over this box
 * (not the full letterboxed/cropped container) for correct MediaPipe mapping.
 *
 * @param {HTMLImageElement} img
 * @param {'contain'|'cover'|'fill'} fit
 */
export function getObjectFitContentRect(img, fit = 'contain') {
  if (!img) return null
  const cw = img.clientWidth
  const ch = img.clientHeight
  const nw = img.naturalWidth
  const nh = img.naturalHeight
  if (!cw || !ch || !nw || !nh) return null

  if (fit === 'fill') {
    return { left: 0, top: 0, width: cw, height: ch }
  }

  const containerRatio = cw / ch
  const imageRatio = nw / nh
  const mode = fit === 'cover' ? 'cover' : 'contain'

  let width
  let height
  if (mode === 'contain') {
    if (imageRatio > containerRatio) {
      width = cw
      height = cw / imageRatio
    } else {
      height = ch
      width = ch * imageRatio
    }
  } else if (imageRatio > containerRatio) {
    height = ch
    width = ch * imageRatio
  } else {
    width = cw
    height = cw / imageRatio
  }

  return {
    left: (cw - width) / 2,
    top: (ch - height) / 2,
    width,
    height,
  }
}
