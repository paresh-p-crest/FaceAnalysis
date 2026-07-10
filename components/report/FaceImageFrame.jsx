/** Portrait frame for cropped face/feature images — avoids wide-banner cropping */
export function FaceImageFrame({ src, alt = '', overlay, aspect = '4/5', maxW = '280px', fit = 'cover', alignOverlay = false }) {
  if (aspect === 'auto') {
    return (
      <div
        className="relative mx-auto w-full rounded-2xl overflow-hidden ring-1 ring-surface-border mb-5"
        style={{ maxWidth: maxW }}
      >
        <img src={src} alt={alt} className="w-full h-auto block" />
        {overlay}
      </div>
    )
  }

  const aspectClass =
    aspect === '3/1' ? 'aspect-[3/1]' : aspect === '5/2' ? 'aspect-[5/2]' : aspect === '2/1' ? 'aspect-[2/1]' : 'aspect-[4/5]'
  const fitClass = alignOverlay || fit === 'contain' ? 'object-contain' : 'object-cover'

  return (
    <div
      className={`relative mx-auto w-full ${aspectClass} rounded-2xl overflow-hidden ring-1 ring-surface-border bg-surface-warm mb-5`}
      style={{ maxWidth: maxW }}
    >
      <img src={src} alt={alt} className={`absolute inset-0 w-full h-full ${fitClass}`} />
      {overlay}
    </div>
  )
}

export function SymmetryOverlay({ dots }) {
  return (
    <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">
      <line x1="50" y1="4" x2="50" y2="96" stroke="rgba(255,255,255,0.92)" strokeWidth="0.4" strokeDasharray="1.5 1" />
      <polygon points="50,3 48.2,7 51.8,7" fill="rgba(255,255,255,0.92)" />
      <polygon points="50,97 48.2,93 51.8,93" fill="rgba(255,255,255,0.92)" />
      {dots?.map((d) => (
        <circle key={d.id} cx={d.x} cy={d.y} r="0.9" fill="rgba(255,255,255,0.9)" />
      ))}
    </svg>
  )
}

export function ProportionsOverlay({ lines }) {
  if (!lines) return null
  const lineProps = { stroke: 'rgba(255,255,255,0.88)', strokeWidth: '0.35', strokeDasharray: '2 1.5' }
  return (
    <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">
      {[lines.hair, lines.brow, lines.nose, lines.chin].map((y, i) => (
        <line key={i} x1="8" y1={y} x2="92" y2={y} {...lineProps} />
      ))}
    </svg>
  )
}

/** Qoves-style per-feature proportion guides (ear / nose / mouth / eye tabs) */
export function ProportionFeatureOverlay({ overlay }) {
  if (!overlay) return null
  const dash = {
    stroke: 'rgba(255,255,255,0.92)',
    strokeWidth: '0.4',
    strokeDasharray: '2 1.5',
  }
  const solid = {
    stroke: 'rgba(255,255,255,0.95)',
    strokeWidth: '0.45',
  }

  return (
    <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">
      {overlay.horizontal?.map((line, i) => (
        <line key={`h-${i}`} x1="4" y1={line.y} x2="96" y2={line.y} {...dash} />
      ))}
      {overlay.vertical?.map((line, i) => (
        <line key={`v-${i}`} x1={line.x} y1="4" x2={line.x} y2="96" {...dash} />
      ))}
      {overlay.segments?.map((seg, i) => (
        <line key={`s-${i}`} x1={seg.x1} y1={seg.y1} x2={seg.x2} y2={seg.y2} {...solid} />
      ))}
      {overlay.dots?.map((d, i) => (
        <circle key={`d-${i}`} cx={d.x} cy={d.y} r="0.9" fill="rgba(255,255,255,0.9)" />
      ))}
    </svg>
  )
}
