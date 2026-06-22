import { EyeReportPanel } from '../EyeReportPanel'
import { ScoreScalePanel } from './ReportPanels'
import { FaceImageFrame, SymmetryOverlay, ProportionsOverlay } from './FaceImageFrame'

export function CvReportView({ activeId, cvReport, eyeAnalysis }) {
  if (activeId === 'symmetry' && cvReport?.symmetry) {
    const s = cvReport.symmetry
    return (
      <ScoreScalePanel
        title="Facial symmetry"
        subtitle="Left-right landmark balance · MediaPipe + OpenCV"
        score={s.score}
        scoreLabel={s.scoreLabel}
        scaleLeft={s.scaleLeft}
        scaleRight={s.scaleRight}
        scaleMarkerPct={s.scaleMarkerPct}
        rangeHighlight={s.rangeHighlight}
        explanation={s.explanation}
        imageSrc={s.imageSrc}
        overlay={s.symmetryDots ? <SymmetryOverlay dots={s.symmetryDots} /> : null}
      />
    )
  }

  if (activeId === 'proportions' && cvReport?.proportions) {
    const p = cvReport.proportions
    return (
      <ScoreScalePanel
        title="Facial proportions"
        subtitle="Vertical thirds analysis"
        score={p.score}
        scoreLabel={p.scoreLabel}
        scaleLeft={p.scaleLeft}
        scaleRight={p.scaleRight}
        scaleMarkerPct={p.scaleMarkerPct}
        rangeHighlight={p.rangeHighlight}
        explanation={p.explanation}
        imageSrc={p.imageSrc}
        overlay={p.proportionLines ? <ProportionsOverlay lines={p.proportionLines} /> : null}
      >
        <div className="grid grid-cols-3 gap-2 mb-2">
          {[
            { label: 'Upper third', value: p.upperThird },
            { label: 'Middle third', value: p.middleThird },
            { label: 'Lower third', value: p.lowerThird },
          ].map((row) => (
            <div key={row.label} className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-3 text-center">
              <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">{row.label}</p>
              <p className="text-lg font-display font-bold text-accent">{row.value}</p>
            </div>
          ))}
        </div>
      </ScoreScalePanel>
    )
  }

  if (activeId === 'eyes' && eyeAnalysis) {
    return <EyeReportPanel eyeAnalysis={eyeAnalysis} />
  }

  if (activeId === 'eyebrows' && cvReport?.eyebrows) {
    const m = cvReport.eyebrows.metrics
    const k = parseFloat(m.peakHeight)
    const min = parseFloat(m.peakMin)
    const max = parseFloat(m.peakMax)
    const sliderPct = Math.min(100, Math.max(0, ((k - min) / (max - min)) * 100))

    return (
      <div className="overflow-y-auto max-h-[calc(100vh-12rem)] pr-2 space-y-6">
        <div>
          <h3 className="font-display text-lg font-semibold text-white mb-1">An overview of your eyebrows</h3>
          <p className="text-[10px] text-slate-500 font-sans mb-4">MediaPipe + OpenCV · template report · $0 API</p>
        </div>
        {cvReport.eyebrows.crop && (
          <FaceImageFrame
            src={cvReport.eyebrows.crop}
            alt="Your eyebrows"
            aspect="auto"
            maxW="380px"
          />
        )}
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: 'Eyebrow position', value: m.position },
            { label: 'Eyebrow tilt', value: m.tilt },
            { label: 'Eyebrow virility', value: m.virility },
            { label: 'Eyebrow shape', value: m.shape },
          ].map((card) => (
            <div key={card.label} className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-3">
              <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">{card.label}</p>
              <p className="text-sm font-medium text-white">{card.value}</p>
            </div>
          ))}
        </div>
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4">
          <p className="text-xs text-slate-400 mb-1">
            {m.inRange ? 'Within the typical range for your demographic' : 'Outside typical demographic range'}
          </p>
          <p className="text-sm font-medium text-white mb-1">Brow peak vertical height</p>
          <div className="flex items-baseline gap-2 mb-4">
            <span className="text-2xl font-display font-bold text-accent">{m.peakHeight}</span>
            <span className="text-xs text-slate-500">mm (estimated)</span>
          </div>
          <div className="relative h-2 rounded-full bg-white/[0.06] mb-2">
            <div className="absolute top-0 bottom-0 rounded-full bg-accent/25" style={{ left: '0%', width: '100%' }} />
            <div
              className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-accent"
              style={{ left: `calc(${sliderPct}% - 6px)` }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-slate-600 font-sans">
            <span>{m.peakMin} mm</span>
            <span>typical range</span>
            <span>{m.peakMax} mm</span>
          </div>
        </div>
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500 mb-2">Explanation</p>
          <p className="text-sm text-slate-300 leading-relaxed font-sans">{m.explanation}</p>
        </div>
      </div>
    )
  }

  return null
}
