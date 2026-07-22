'use client'

import { useEffect, useMemo, useState } from 'react'
import { FeatureRegionOverlay } from './FaceImageFrame'
import {
  buildCheekRegions,
  buildChinRegion,
} from '../../utils/featureRegionOverlays'

const DEFAULT_IMG_CLASS = 'max-h-48 w-auto object-contain rounded-xl block'

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

/** Pull max-h-* from img classes so the wrapper matches displayed image height. */
function wrapperMaxHeightClass(imgClassName) {
  const match = String(imgClassName || '').match(/\bmax-h-\S+/)
  return match ? match[0] : 'max-h-48'
}

/**
 * Feature hero + notebook region fill, aligned via SegFormer crop bbox when
 * available (needs front photo pixel size). Overlay tracks displayed image size.
 */
export function FeatureRegionHero({
  heroSrc,
  frontPhoto = null,
  landmarks = null,
  featureId,
  featureParsing = null,
  alt = '',
  imgClassName = DEFAULT_IMG_CLASS,
}) {
  const frontSize = useNaturalSize(frontPhoto || null)
  const wrapMaxH = wrapperMaxHeightClass(imgClassName)

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
    <div className={`relative inline-block ${wrapMaxH}`}>
      <img
        src={heroSrc}
        alt={alt}
        className={imgClassName}
      />
      {overlay ? (
        <div className="absolute inset-0 pointer-events-none rounded-xl overflow-hidden">
          {overlay}
        </div>
      ) : null}
    </div>
  )
}
