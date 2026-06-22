/** Portrait frame for cropped face/feature images — avoids wide-banner cropping */
export function FaceImageFrame({ src, alt = '', overlay, aspect = '4/5', maxW = '280px', fit = 'cover' }) {
  if (aspect === 'auto') {
    return (
      <div
        className="relative mx-auto w-full rounded-2xl overflow-hidden ring-1 ring-white/10 mb-5"
        style={{ maxWidth: maxW }}
      >
        <img src={src} alt={alt} className="w-full h-auto block" />
        {overlay}
      </div>
    )
  }

  const aspectClass =
    aspect === '3/1' ? 'aspect-[3/1]' : aspect === '5/2' ? 'aspect-[5/2]' : aspect === '2/1' ? 'aspect-[2/1]' : 'aspect-[4/5]'
  const fitClass = fit === 'contain' ? 'object-contain' : 'object-cover'

  return (
    <div
      className={`relative mx-auto w-full ${aspectClass} rounded-2xl overflow-hidden ring-1 ring-white/10 bg-black/30 mb-5`}
      style={{ maxWidth: maxW }}
    >
      <img src={src} alt={alt} className={`absolute inset-0 w-full h-full ${fitClass}`} />
      {overlay}
    </div>
  )
}

export function SymmetryOverlay({ dots }) {
  return (
    <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
      <line x1="50" y1="4" x2="50" y2="96" stroke="rgba(79,209,197,0.9)" strokeWidth="0.4" strokeDasharray="1.5 1" />
      <polygon points="50,3 48.2,7 51.8,7" fill="rgba(79,209,197,0.9)" />
      <polygon points="50,97 48.2,93 51.8,93" fill="rgba(79,209,197,0.9)" />
      {dots?.map((d) => (
        <circle key={d.id} cx={d.x} cy={d.y} r="0.9" fill="rgba(255,255,255,0.85)" />
      ))}
    </svg>
  )
}

export function ProportionsOverlay({ lines }) {
  if (!lines) return null
  const lineProps = { stroke: 'rgba(79,209,197,0.55)', strokeWidth: '0.35', strokeDasharray: '2 1.5' }
  return (
    <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
      {[lines.hair, lines.brow, lines.nose, lines.chin].map((y, i) => (
        <line key={i} x1="8" y1={y} x2="92" y2={y} {...lineProps} />
      ))}
    </svg>
  )
}
