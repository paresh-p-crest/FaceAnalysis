'use client'

import { Link } from '../../i18n/navigation'

/**
 * Slate name / protocol plate — full left-column width, compact height (~72% of prior square).
 * Shared by interactive overview + PDF parity.
 */
export function NameProtocolPlate({
  firstName,
  clientName,
  protocolLine,
  assessedLine,
  scoreLine,
  reportHref = null,
  reportLinkLabel = 'View report',
  className = '',
}) {
  const showFullName = Boolean(
    clientName?.trim() && clientName.trim() !== (firstName || '').trim(),
  )

  return (
    <div
      className={`w-full aspect-[100/72] max-h-[12rem] rounded-2xl bg-[#8B9AA3] flex flex-col items-center justify-center gap-1.5 px-3 py-2.5 text-center shrink-0 ${className}`.trim()}
    >
      <p className="text-xl sm:text-2xl font-sans font-semibold text-white leading-tight tracking-tight">
        {firstName}
      </p>
      {showFullName ? (
        <p className="text-[11px] sm:text-xs font-sans text-white/85 leading-tight truncate max-w-full">
          {clientName}
        </p>
      ) : null}
      <p className="text-[10px] sm:text-[11px] font-sans uppercase tracking-[0.12em] text-white/70">
        {protocolLine}
      </p>
      {assessedLine ? (
        <p className="text-[9px] sm:text-[10px] font-sans text-white/60 leading-tight">
          {assessedLine}
        </p>
      ) : null}
      {scoreLine ? (
        <p className="text-[10px] sm:text-[11px] font-sans font-semibold text-white/90 leading-tight tabular-nums">
          {scoreLine}
        </p>
      ) : null}
      {reportHref ? (
        <Link
          href={reportHref}
          className="mt-1 inline-flex items-center rounded-full border border-white/25 bg-white/10 px-2.5 py-1 text-[9px] sm:text-[10px] font-sans font-semibold uppercase tracking-wider text-white hover:bg-white/20 transition-colors"
        >
          {reportLinkLabel}
        </Link>
      ) : null}
    </div>
  )
}
