'use client'

import { LocaleSwitcher } from './LocaleSwitcher'

export function AuthShell({ children }) {
  return (
    <div className="relative min-h-screen overflow-x-hidden font-sans bg-surface text-ink">
      <div className="fixed top-3 right-3 z-40">
        <LocaleSwitcher />
      </div>
      <div className="min-h-screen flex items-center justify-center px-4 py-12">
        {children}
      </div>
    </div>
  )
}
