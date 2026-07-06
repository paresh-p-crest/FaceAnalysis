import { History, Settings, Sun, Moon, RotateCcw } from 'lucide-react'
import { useTheme } from '../utils/theme'

export function TopNav({ onHistory, onSettings, onRestart }) {
  const { theme, toggleTheme } = useTheme()

  return (
    <div className="absolute top-3 right-4 z-40 flex items-center gap-1.5">
      <button
        onClick={onHistory}
        className="p-1.5 rounded-lg bg-white dark:bg-surface-card border border-surface-border text-ink-muted hover:text-brand hover:border-brand/30 transition-colors shadow-soft"
        title="Analysis History"
      >
        <History className="w-4 h-4" />
      </button>
      <button
        onClick={onSettings}
        className="p-1.5 rounded-lg bg-white dark:bg-surface-card border border-surface-border text-ink-muted hover:text-brand hover:border-brand/30 transition-colors shadow-soft"
        title="API Settings"
      >
        <Settings className="w-4 h-4" />
      </button>
      <button
        onClick={toggleTheme}
        className="p-1.5 rounded-lg bg-white dark:bg-surface-card border border-surface-border text-ink-muted hover:text-brand hover:border-brand/30 transition-colors shadow-soft"
        title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      >
        {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
      </button>
    </div>
  )
}
