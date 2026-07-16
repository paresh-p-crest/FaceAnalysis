/**
 * Normalize a photo src to a data URL for the backend — full quality.
 *
 * The main upload flow now sends the original File bytes via multipart (see
 * apiClient.uploadAssessmentPhoto), so there is NO client-side downscale or
 * JPEG re-encode anywhere. This helper only normalizes a fetchable src (path,
 * URL, blob) into a data URL, preserving the original bytes exactly.
 */

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

/** Normalize a photo src (path, URL, blob, or data URL) to a data URL — no re-encode. */
export async function prepareImageForBackend(src) {
  if (!src || typeof src !== 'string') return src
  if (src.startsWith('data:')) return src
  if (!isFetchableImageSrc(src)) {
    throw new Error(`Unsupported image source: ${src.slice(0, 48)}`)
  }
  const res = await fetch(src)
  if (!res.ok) throw new Error(`Could not load image ${src}`)
  return blobToDataUrl(await res.blob())
}

export async function preparePhotosForBackend(photos = {}) {
  const entries = await Promise.all(
    Object.entries(photos)
      .filter(([, value]) => Boolean(value))
      .map(async ([key, value]) => [key, await prepareImageForBackend(value)])
  )
  return Object.fromEntries(entries)
}
