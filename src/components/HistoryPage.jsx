import { History, Trash2, ChevronLeft, ScanFace } from 'lucide-react'
import { loadHistory, deleteAllHistory, formatHistoryDate } from '../utils/historyStorage'

export default function HistoryPage({ onBack, onViewItem }) {
  const items = loadHistory()

  const handleDeleteAll = () => {
    if (!window.confirm('Delete all analysis history?')) return
    deleteAllHistory()
    onBack()
  }

  return (
    <div className="min-h-screen px-6 py-12 pt-20 animate-fade-up font-sans">
      <div className="max-w-4xl mx-auto pt-12">
        <button onClick={onBack} className="btn-ghost text-sm mb-8">
          <ChevronLeft className="w-4 h-4" />
          Back
        </button>

        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl glass-strong flex items-center justify-center">
              <History className="w-5 h-5 text-accent" />
            </div>
            <div>
              <h1 className="font-display text-2xl font-semibold text-white tracking-tight">Analysis History</h1>
              <p className="text-sm text-slate-500 font-sans">{items.length} saved {items.length === 1 ? 'result' : 'results'}</p>
            </div>
          </div>
          {items.length > 0 && (
            <button
              onClick={handleDeleteAll}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-sans text-red-400 border border-red-500/25 hover:bg-red-500/10 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete all
            </button>
          )}
        </div>

        {items.length === 0 ? (
          <div className="glass rounded-3xl p-16 text-center">
            <ScanFace className="w-12 h-12 text-slate-600 mx-auto mb-4" />
            <p className="font-display text-white mb-2">No analyses yet</p>
            <p className="text-sm text-slate-500 font-sans">Complete an assessment to see results here.</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {items.map((item) => (
              <button
                key={item.id}
                onClick={() => onViewItem(item.id)}
                className="glass rounded-2xl overflow-hidden text-left hover:border-accent/30 border border-transparent transition-all group"
              >
                <div className="aspect-[4/3] overflow-hidden">
                  <img
                    src={item.photo}
                    alt=""
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                </div>
                <div className="p-4">
                  <p className="font-display text-sm font-semibold text-white truncate tracking-tight">
                    {item.label || 'Facial analysis'}
                  </p>
                  <p className="text-xs text-slate-500 font-sans mt-1">{formatHistoryDate(item.createdAt)}</p>
                  <p className="text-xs text-accent/80 font-sans mt-2">
                    {item.cvLabel} · {item.reportSource || '—'}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
