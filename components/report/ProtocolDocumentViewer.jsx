import { useMemo, useState } from 'react'
import { Download, Loader2, Maximize2, Minimize2 } from 'lucide-react'
import QovesProtocolReport from './QovesProtocolReport'

const ZOOM_LEVELS = [0.75, 1, 1.25]

export function ProtocolDocumentViewer({
  photo,
  photos,
  landmarks,
  cvReport,
  metrics,
  answers,
  user = null,
  eyeAnalysis,
  protocolNarrative,
  aiNarrative,
  protocolLoading,
  onDownloadPdf,
  pdfLoading,
  canDownloadPdf,
}) {
  const [zoomIdx, setZoomIdx] = useState(1)
  const [fullscreen, setFullscreen] = useState(false)

  const zoom = ZOOM_LEVELS[zoomIdx]

  const toolbar = (
    <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-4 border-b border-surface-border sticky top-0 bg-surface-raised z-10 -mx-1 px-1">
      <p className="font-display text-sm font-bold text-ink">Protocol</p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setZoomIdx((i) => Math.max(0, i - 1))}
          disabled={zoomIdx === 0}
          className="px-2 py-1 rounded-lg border border-surface-border text-xs disabled:opacity-40"
        >
          −
        </button>
        <span className="text-xs font-mono w-12 text-center">{Math.round(zoom * 100)}%</span>
        <button
          type="button"
          onClick={() => setZoomIdx((i) => Math.min(ZOOM_LEVELS.length - 1, i + 1))}
          disabled={zoomIdx === ZOOM_LEVELS.length - 1}
          className="px-2 py-1 rounded-lg border border-surface-border text-xs disabled:opacity-40"
        >
          +
        </button>
        <button
          type="button"
          onClick={() => setFullscreen((v) => !v)}
          className="p-1.5 rounded-lg border border-surface-border"
          title={fullscreen ? 'Exit fullscreen' : 'Fullscreen'}
        >
          {fullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
        </button>
        <button
          type="button"
          onClick={onDownloadPdf}
          disabled={pdfLoading || !canDownloadPdf}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[50px] text-xs font-bold bg-brand text-white hover:bg-brand-dark disabled:opacity-50"
        >
          {pdfLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
          Download PDF
        </button>
      </div>
    </div>
  )

  const scrollStyle = useMemo(() => ({
    transform: `scale(${zoom})`,
    transformOrigin: 'top center',
  }), [zoom])

  if (protocolLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <Loader2 className="w-8 h-8 text-brand animate-spin" />
        <p className="text-ink-muted text-sm font-sans">Preparing aesthetic protocol…</p>
      </div>
    )
  }

  return (
    <div
      className={
        fullscreen
          ? 'fixed inset-0 z-50 bg-surface-raised p-4 sm:p-6 overflow-y-auto'
          : 'qoves-protocol-viewer'
      }
    >
      {toolbar}
      <div className="qoves-protocol-scroll" style={scrollStyle}>
        <QovesProtocolReport
          photo={photo}
          photos={photos}
          landmarks={landmarks}
          cvReport={cvReport}
          metrics={metrics}
          answers={answers}
          user={user}
          eyeAnalysis={eyeAnalysis}
          protocolNarrative={protocolNarrative}
          aiNarrative={aiNarrative}
          paginated={false}
        />
      </div>
    </div>
  )
}
