'use client'

import { ChevronLeft } from 'lucide-react'
import { LocaleSwitcher } from '../LocaleSwitcher'

/**
 * Shared analysis-flow top bar: optional back (left), optional trailing slot, locale (right).
 */
export function AnalysisFlowHeader({
  backLabel,
  onBack,
  backClassName = '',
  backWithChevron = false,
  leading = null,
  trailing = null,
  className = '',
}) {
  return (
    <header className={`analysis-flow-header ${className}`.trim()}>
      <div className="analysis-flow-header__left">
        {leading}
        {onBack && backLabel ? (
          <button
            type="button"
            onClick={onBack}
            className={`analysis-flow-header__back ${backWithChevron ? 'analysis-flow-header__back--plain' : ''} ${backClassName}`.trim()}
          >
            {backWithChevron ? <ChevronLeft className="w-4 h-4 shrink-0" aria-hidden /> : null}
            {backLabel}
          </button>
        ) : null}
      </div>
      <div className="analysis-flow-header__right">
        {trailing}
        <LocaleSwitcher />
      </div>
    </header>
  )
}
