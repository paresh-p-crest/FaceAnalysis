import { CreditCard, History, LayoutDashboard, LogOut, Settings, Shield, Sun, Moon, User } from 'lucide-react'
import { useTheme } from '../utils/theme'

export function TopNav({ onDashboard, onAdmin, onHistory, onBilling, onSettings, onAuth, onLogout, user }) {
  const { theme, toggleTheme } = useTheme()
  const isAdmin = user?.role === 'admin'

  return (
    <div className="absolute top-3 right-4 z-40 flex items-center gap-1.5">
      {user ? (
        <>
          <div
            className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white dark:bg-surface-card border border-surface-border text-xs text-ink-secondary shadow-soft max-w-[180px]"
            title={`${user.email} (${user.role})`}
          >
            {isAdmin ? <Shield className="w-3.5 h-3.5 text-brand" /> : <User className="w-3.5 h-3.5 text-brand" />}
            <span className="truncate">{user.email}</span>
          </div>
          <button
            onClick={onLogout}
            className="p-1.5 rounded-lg bg-white dark:bg-surface-card border border-surface-border text-ink-muted hover:text-brand hover:border-brand/30 transition-colors shadow-soft"
            title="Sign out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </>
      ) : (
        <button
          onClick={onAuth}
          className="p-1.5 rounded-lg bg-white dark:bg-surface-card border border-surface-border text-ink-muted hover:text-brand hover:border-brand/30 transition-colors shadow-soft"
          title="Sign in"
        >
          <User className="w-4 h-4" />
        </button>
      )}
      {user && (
        isAdmin ? (
          <button
            onClick={onAdmin}
            className="p-1.5 rounded-lg bg-white dark:bg-surface-card border border-surface-border text-ink-muted hover:text-brand hover:border-brand/30 transition-colors shadow-soft"
            title="Admin Panel"
          >
            <Shield className="w-4 h-4" />
          </button>
        ) : (
          <button
            onClick={onDashboard}
            className="p-1.5 rounded-lg bg-white dark:bg-surface-card border border-surface-border text-ink-muted hover:text-brand hover:border-brand/30 transition-colors shadow-soft"
            title="Dashboard"
          >
            <LayoutDashboard className="w-4 h-4" />
          </button>
        )
      )}
      <button
        onClick={onHistory}
        className="p-1.5 rounded-lg bg-white dark:bg-surface-card border border-surface-border text-ink-muted hover:text-brand hover:border-brand/30 transition-colors shadow-soft"
        title="Analysis History"
      >
        <History className="w-4 h-4" />
      </button>
      {!isAdmin && (
        <button
          onClick={onBilling}
          className="p-1.5 rounded-lg bg-white dark:bg-surface-card border border-surface-border text-ink-muted hover:text-brand hover:border-brand/30 transition-colors shadow-soft"
          title="Billing"
        >
          <CreditCard className="w-4 h-4" />
        </button>
      )}
      {isAdmin && (
        <button
          onClick={onSettings}
          className="p-1.5 rounded-lg bg-white dark:bg-surface-card border border-surface-border text-ink-muted hover:text-brand hover:border-brand/30 transition-colors shadow-soft"
          title="API Settings"
        >
          <Settings className="w-4 h-4" />
        </button>
      )}
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
