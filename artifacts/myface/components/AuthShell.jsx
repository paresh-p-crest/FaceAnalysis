'use client'

export function AuthShell({ children }) {
  return (
    <div className="relative min-h-screen overflow-x-hidden font-sans bg-surface text-ink">
      {children}
    </div>
  )
}
