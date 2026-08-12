'use client'

import { useEffect, useState } from 'react'
import { fetchMediaToken, mediaUrl, subscribeMediaToken } from './apiClient'

/**
 * Resolve a media URL with the current user's signed token, and re-resolve when
 * the token is minted or cleared (logout / account switch).
 *
 * Needed because <img src> is set once: a first paint without a token (or with a
 * previous user's token) would 404 under MEDIA_AUTH_REQUIRED and never retry.
 */
export function useMediaUrl(url) {
  const [src, setSrc] = useState(() => (url ? mediaUrl(url) : null))

  useEffect(() => {
    if (!url) {
      setSrc(null)
      return undefined
    }
    setSrc(mediaUrl(url))
    if (typeof url === 'string' && url.includes('/api/media/')) {
      fetchMediaToken().catch(() => {})
    }
    return subscribeMediaToken(() => setSrc(mediaUrl(url)))
  }, [url])

  return src
}
