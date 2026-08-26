'use client'

import { Link } from '../../i18n/navigation'

/**
 * Client name card — left-aligned slate plate (name · customer · brand · assessed).
 * Tall plate with roomy top/bottom padding and stepped gaps between lines.
 */
export function NameProtocolPlate({
  firstName,
  clientName,
  customerLabel,
  protocolBrandLine,
  assessedLine,
  reportHref = null,
  reportLinkLabel = 'View report',
  className = '',
}) {
  const displayName = (clientName || firstName || '').trim()
  const title = displayName.toUpperCase()

  return (
    <div
      className={`w-full rounded-2xl bg-[#8B9AA3] flex flex-col items-start justify-start px-4 pt-8 pb-5 text-left shrink-0 min-h-[9.25rem] ${className}`.trim()}
    >
      <p className="text-base sm:text-lg font-sans font-bold text-white leading-tight tracking-wide uppercase">
        {title || '—'}
      </p>
      <div className="mt-auto w-full">
        {customerLabel ? (
          <p className="text-[9px] sm:text-[10px] font-sans text-white/90 leading-tight mb-2">
            {customerLabel}
          </p>
        ) : null}
        {protocolBrandLine ? (
          <p className="text-[10px] sm:text-[11px] font-sans text-white leading-snug">
            {protocolBrandLine}
          </p>
        ) : null}
        {assessedLine ? (
          <p className="text-[9px] sm:text-[10px] font-sans text-white/95 leading-snug mt-1">
            {assessedLine}
          </p>
        ) : null}
        {reportHref ? (
          <Link
            href={reportHref}
            className="mt-3 inline-flex items-center rounded-full border border-white/25 bg-white/10 px-2.5 py-1 text-[9px] sm:text-[10px] font-sans font-semibold uppercase tracking-wider text-white hover:bg-white/20 transition-colors"
          >
            {reportLinkLabel}
          </Link>
        ) : null}
      </div>
    </div>
  )
}
