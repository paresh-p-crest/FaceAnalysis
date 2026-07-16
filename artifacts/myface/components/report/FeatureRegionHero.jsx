'use client'

import { useEffect, useMemo, useState } from 'react'
import { FeatureRegionOverlay } from './FaceImageFrame'
import {
  buildCheekRegions,
  buildChinRegion,
} from '../../utils/featureRegionOverlays'

function useNaturalSize(src) {
  const [size, setSize] = useState(null)
  useEffect(() => {
    if (!src) {
      setSize(null)
      return undefined
    }
    let cancelled = false
    const img = new Image()
    img.onload = () => {
      if (!cancelled && img.naturalWidth > 0) {
        setSize({ w: img.naturalWidth, h: img.naturalHeight })
      }
    }
    img.onerror = () => {
      if (!cancelled) setSize(null)
    }
    img.src = src
    return () => {
      cancelled = true
    }
  }, [src])
  return size
}

/**
 * Existing feature hero (max-h-48) + notebook region fill, aligned via SegFormer
 * crop bbox when available (needs front photo pixel size).
 */
export function FeatureRegionHero({
  heroSrc,
  frontPhoto = null,
  landmarks = null,
  featureId,
  featureParsing = null,
  alt = '',
}) {
  const frontSize = useNaturalSize(frontPhoto || null)

  const region = useMemo(() => {
    if (!landmarks?.length || !featureId) return null
    const w = frontSize?.w ?? null
    const h = frontSize?.h ?? null
    if (featureId === 'cheeks') {
      return buildCheekRegions(landmarks, featureParsing, null, w, h)
    }
    if (featureId === 'chin') {
      return buildChinRegion(landmarks, featureParsing, null, w, h)
    }
    return null
  }, [landmarks, featureId, featureParsing, frontSize])

  if (!heroSrc) return null

  const overlay =
    region?.paths?.length > 0 ? <FeatureRegionOverlay paths={region.paths} /> : null

  return (
    <div className="relative inline-block max-h-48">
      <img
        src={heroSrc}
        alt={alt}
        className="max-h-48 w-auto object-contain rounded-xl block"
      />
      {overlay ? (
        <div className="absolute inset-0 pointer-events-none rounded-xl overflow-hidden">
          {overlay}
        </div>
      ) : null}
    </div>
  )
}
