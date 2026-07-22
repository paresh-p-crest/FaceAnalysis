'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Check, ChevronDown, Languages } from 'lucide-react'
import { usePathname, useRouter } from '../i18n/navigation'
import { routing } from '../i18n/routing'

const LOCALE_LABELS = {
  en: 'English',
  de: 'Deutsch',
}

export function LocaleSwitcher({ className = '', compact = false }) {
  const t = useTranslations('Nav')
  const locale = useLocale()
  const pathname = usePathname()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  const close = useCallback(() => setOpen(false), [])
  const toggle = useCallback(() => setOpen((v) => !v), [])

  const switchLocale = useCallback(
    (nextLocale) => {
      if (nextLocale === locale) {
        close()
        return
      }
      router.replace(pathname, { locale: nextLocale })
      router.refresh()
      close()
    },
    [locale, pathname, router, close],
  )

  useEffect(() => {
    if (!open) return undefined
    const onKeyDown = (event) => {
      if (event.key === 'Escape') close()
    }
    const onPointerDown = (event) => {
      if (ref.current && !ref.current.contains(event.target)) close()
    }
    window.addEventListener('keydown', onKeyDown)
    document.addEventListener('mousedown', onPointerDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('mousedown', onPointerDown)
    }
  }, [open, close])

  return (
    <div className={`relative ${className}`} ref={ref}>
      <button
        type="button"
        onClick={toggle}
        className={`site-navbar-pill ${
          compact ? 'px-2.5 py-1' : 'px-3 py-1'
        }`}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={t('language')}
      >
        <Languages className="w-3.5 h-3.5 shrink-0 text-ink-muted" aria-hidden />
        <span className="uppercase tracking-wide">{locale}</span>
        <ChevronDown
          className={`w-3 h-3 shrink-0 text-ink-muted transition-transform ${open ? 'rotate-180' : ''}`}
          aria-hidden
        />
      </button>
      {open && (
        <ul
          role="listbox"
          aria-label={t('language')}
          className="absolute right-0 top-full mt-1.5 min-w-[140px] rounded-2xl border border-surface-border bg-surface-card shadow-card py-1 z-50"
        >
          {routing.locales.map((code) => {
            const active = code === locale
            return (
              <li key={code} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => switchLocale(code)}
                  className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-xs font-medium transition-colors text-left ${
                    active
                      ? 'text-brand bg-brand-50/50'
                      : 'text-ink-secondary hover:bg-surface-warm hover:text-brand'
                  }`}
                >
                  <span>{LOCALE_LABELS[code] || code.toUpperCase()}</span>
                  {active && <Check className="w-3.5 h-3.5 shrink-0" aria-hidden />}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
