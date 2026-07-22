/** Exact brand wordmark asset — use instead of styled “MyFace” text. */
export const BRAND_WORDMARK_SRC = '/brand/myface-wordmark.png'

const SIZES = {
  sm: { height: 22 },
  md: { height: 32 },
  lg: { height: 40 },
  xl: { height: 52 },
}

/**
 * @param {{ size?: 'sm'|'md'|'lg'|'xl', className?: string, invert?: boolean }} props
 * invert: white wordmark on dark panels (CSS filter)
 */
export function BrandLogo({ size = 'md', className = '', invert = false }) {
  const { height } = SIZES[size] || SIZES.md
  return (
    // eslint-disable-next-line @next/next/no-img-element -- brand asset; plain img works in PDF HTML + app chrome
    <img
      src={BRAND_WORDMARK_SRC}
      alt="MyFace"
      height={height}
      className={`brand-logo ${invert ? 'brand-logo-invert' : ''} ${className}`.trim()}
      style={{ height, width: 'auto' }}
      draggable={false}
    />
  )
}
