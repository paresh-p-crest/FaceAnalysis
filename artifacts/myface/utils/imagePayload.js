/** Resize/compress images before sending to the backend API. */

const UPLOAD_MAX_PX = 1600
const UPLOAD_QUALITY = 0.88

function isFetchableImageSrc(src) {
  return (
    src.startsWith('/')
    || src.startsWith('http://')
    || src.startsWith('https://')
    || src.startsWith('blob:')
  )
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(new Error('Could not read image data'))
    reader.readAsDataURL(blob)
  })
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`Could not decode image ${src}`))
    img.src = src
  })
}

async function compressDataUrl(dataUrl, maxPx = UPLOAD_MAX_PX, quality = UPLOAD_QUALITY) {
  if (!dataUrl?.startsWith?.('data:image') || typeof document === 'undefined') {
    return dataUrl
  }
  const img = await loadImage(dataUrl)
  const scale = Math.min(1, maxPx / Math.max(img.width, img.height, 1))
  const w = Math.max(1, Math.round(img.width * scale))
  const h = Math.max(1, Math.round(img.height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) return dataUrl
  ctx.drawImage(img, 0, 0, w, h)
  return canvas.toDataURL('image/jpeg', quality)
}

async function maybeCompressDataUrl(dataUrl) {
  if (!dataUrl?.startsWith?.('data:image')) return dataUrl
  return compressDataUrl(dataUrl)
}

/** Normalize a photo src (path, URL, blob, or data URL) for POST /api/assessments. */
export async function prepareImageForBackend(src) {
  if (!src || typeof src !== 'string') return src
  if (src.startsWith('data:')) {
    return maybeCompressDataUrl(src)
  }
  if (!isFetchableImageSrc(src)) {
    throw new Error(`Unsupported image source: ${src.slice(0, 48)}`)
  }
  const res = await fetch(src)
  if (!res.ok) throw new Error(`Could not load image ${src}`)
  const dataUrl = await blobToDataUrl(await res.blob())
  return maybeCompressDataUrl(dataUrl)
}

export async function preparePhotosForBackend(photos = {}) {
  const entries = await Promise.all(
    Object.entries(photos)
      .filter(([, value]) => Boolean(value))
      .map(async ([key, value]) => [key, await prepareImageForBackend(value)])
  )
  return Object.fromEntries(entries)
}
