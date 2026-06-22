import { History, Settings } from 'lucide-react'

export function TopNav({ onHistory, onSettings }) {
  return (
    <div className="fixed top-5 right-5 z-40 flex items-center gap-2">
      <button
        onClick={onHistory}
        className="p-2.5 rounded-xl glass border border-white/10 text-slate-400 hover:text-accent hover:border-accent/30 transition-colors"
        title="Analysis History"
      >
        <History className="w-5 h-5" />
      </button>
      <button
        onClick={onSettings}
        className="p-2.5 rounded-xl glass border border-white/10 text-slate-400 hover:text-accent hover:border-accent/30 transition-colors"
        title="API Settings"
      >
        <Settings className="w-5 h-5" />
      </button>
    </div>
  )
}
