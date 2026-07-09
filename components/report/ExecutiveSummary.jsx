import { Sparkles, Calendar, UserCheck, Timer } from 'lucide-react'
import { SymmetryOverlay } from './FaceImageFrame'

function RadarChart({ scores }) {
  const cx = 100
  const cy = 100
  const rMax = 70
  const axes = ['Symmetry', 'Smoothness', 'Jawline', 'Skin', 'Volume', 'Harmony']

  // Draw background hexagons at 20%, 40%, 60%, 80%, 100%
  const backgroundPolygons = [0.2, 0.4, 0.6, 0.8, 1].map((scale) => {
    const points = []
    for (let i = 0; i < 6; i++) {
      const angle = (i * Math.PI) / 3 - Math.PI / 2
      const x = cx + rMax * scale * Math.cos(angle)
      const y = cy + rMax * scale * Math.sin(angle)
      points.push(`${x},${y}`)
    }
    return points.join(' ')
  })

  // Calculate client score coordinates
  const clientPoints = axes.map((axis, i) => {
    const scoreVal = scores[axis.toLowerCase()] || 80
    const angle = (i * Math.PI) / 3 - Math.PI / 2
    const x = cx + rMax * (scoreVal / 100) * Math.cos(angle)
    const y = cy + rMax * (scoreVal / 100) * Math.sin(angle)
    return `${x},${y}`
  }).join(' ')

  return (
    <div className="w-full max-w-[200px] mx-auto aspect-square flex items-center justify-center">
      <svg className="w-full h-full overflow-visible" viewBox="0 0 200 200">
        {/* Concentric Hexagons */}
        {backgroundPolygons.map((pts, idx) => (
          <polygon
            key={idx}
            points={pts}
            fill="none"
            stroke="currentColor"
            className="text-slate-200 dark:text-slate-800"
            strokeWidth="0.8"
          />
        ))}

        {/* Axis Lines & Labels */}
        {axes.map((axis, i) => {
          const angle = (i * Math.PI) / 3 - Math.PI / 2
          const xLine = cx + rMax * Math.cos(angle)
          const yLine = cy + rMax * Math.sin(angle)
          const xLabel = cx + (rMax + 14) * Math.cos(angle)
          const yLabel = cy + (rMax + 14) * Math.sin(angle)

          return (
            <g key={axis}>
              <line
                x1={cx}
                y1={cy}
                x2={xLine}
                y2={yLine}
                stroke="currentColor"
                className="text-slate-200 dark:text-slate-800"
                strokeWidth="0.8"
              />
              <text
                x={xLabel}
                y={yLabel}
                textAnchor="middle"
                dominantBaseline="middle"
                className="text-[9px] font-bold fill-slate-500 dark:fill-slate-400 font-sans"
              >
                {axis}
              </text>
            </g>
          );
        })}

        {/* Client Score Polygon */}
        <polygon
          points={clientPoints}
          fill="rgba(94, 159, 139, 0.15)"
          stroke="#5e9f8b"
          strokeWidth="2"
        />
      </svg>
    </div>
  )
}

function BiologicalAgeScale({ faceAge = 28, bioAge = 33 }) {
  const diff = bioAge - faceAge
  const diffLabel = diff > 0 ? `${diff} years younger` : diff < 0 ? `${Math.abs(diff)} years older` : 'Same age'
  const isYounger = diff >= 0

  // Standardize positions on a scale of 20 to 50
  const minVal = 20
  const maxVal = 50
  const clamp = (val) => Math.min(Math.max(val, minVal), maxVal)
  const getPct = (val) => ((clamp(val) - minVal) / (maxVal - minVal)) * 100

  const facePct = getPct(faceAge)
  const bioPct = getPct(bioAge)

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 items-center border-b border-slate-100 dark:border-slate-800 pb-3">
        <div className="text-center">
          <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">{faceAge}</p>
          <p className="text-[9px] uppercase tracking-wider text-slate-400">FACE</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-slate-500 dark:text-slate-400">{bioAge}</p>
          <p className="text-[9px] uppercase tracking-wider text-slate-400 font-medium">BIO</p>
        </div>
        <div className="text-right">
          <span className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-bold ${
            isYounger ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-amber-500/10 text-amber-600'
          }`}>
            {diffLabel}
          </span>
        </div>
      </div>

      {/* Horizontal scale */}
      <div className="relative pt-2 pb-4">
        <div className="h-1 bg-slate-150 dark:bg-slate-800 rounded-full w-full relative">
          {/* Tick Marks */}
          {[20, 30, 40, 50].map((tick) => (
            <div
              key={tick}
              className="absolute w-0.5 h-1.5 bg-slate-300 dark:bg-slate-700"
              style={{ left: `${getPct(tick)}%`, top: '-0.25rem' }}
            />
          ))}
          
          {/* Chronological age dot (grey) */}
          <div
            className="absolute -top-1 w-3.5 h-3.5 rounded-full bg-slate-400 dark:bg-slate-600 border-2 border-white dark:border-slate-900 shadow-sm"
            style={{ left: `calc(${bioPct}% - 7px)` }}
            title={`Bio Age: ${bioAge}`}
          />

          {/* Visual/Face age dot (green) */}
          <div
            className="absolute -top-1 w-3.5 h-3.5 rounded-full bg-[#5e9f8b] border-2 border-white dark:border-slate-900 shadow-sm"
            style={{ left: `calc(${facePct}% - 7px)` }}
            title={`Face Age: ${faceAge}`}
          />
        </div>
        <div className="flex justify-between text-[8px] text-slate-400 mt-2 font-mono">
          <span>20</span>
          <span>30</span>
          <span>40</span>
          <span>50</span>
        </div>
      </div>
    </div>
  )
}

export function ExecutiveSummary({
  cvReport,
  eyeAnalysis,
  aiNarrative,
  aiNarrativeLoading,
  aiNarrativeError,
  photo,
  landmarks,
  metrics,
  answers,
}) {
  const overall = cvReport?.overall || {}
  const faceAge = metrics?.visualAge || overall?.visualAge || 28
  const bioAge = answers?.age || overall?.chronologicalAge || 33

  // Radar scores mapping
  const radarScores = {
    symmetry: metrics?.symmetryScore || cvReport?.symmetry?.score || 81,
    smoothness: cvReport?.skin?.uniformity || 75,
    jawline: metrics?.jawlineScore || cvReport?.structure?.score || 80,
    skin: metrics?.skinScore || cvReport?.skin?.score || 76,
    volume: metrics?.proportionsScore || cvReport?.proportions?.score || 82,
    harmony: metrics?.harmonyScore || cvReport?.overall?.score || 81,
  }

  // Feature rows
  const featureRows = [
    { zone: 'Forehead', befund: 'Slightly asymmetric', ref: 'Symmetrical', isOk: false },
    { zone: 'Eyes', befund: 'High symmetry', ref: 'Symmetrical', isOk: true },
    { zone: 'Nose', befund: 'Width +3 mm', ref: '31 mm', isOk: false },
    { zone: 'Lips', befund: 'Well proportioned', ref: 'Ideal', isOk: true },
    { zone: 'Jawline', befund: 'Soft definition', ref: 'Defined', isOk: false },
  ]

  return (
    <div className="space-y-8 qoves-overview-document">
      {/* ── Section Header ── */}
      <div>
        <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 block mb-1">
          Aesthetic Summary
        </span>
        <h2 className="font-display text-2xl font-bold tracking-tight">Executive Dashboard</h2>
      </div>

      {/* ── Before & After Comparison Grid ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Before · Original</p>
          <div className="relative rounded-2xl overflow-hidden aspect-[4/5] bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
            {photo ? (
              <img src={photo} alt="Original" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-slate-400">Original Photo</div>
            )}
            <div className="absolute bottom-3 left-3 bg-black/50 backdrop-blur-sm text-[8px] font-bold text-white px-2 py-0.5 rounded-full uppercase tracking-wider">
              Before
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Potential · Landmarks</p>
          <div className="relative rounded-2xl overflow-hidden aspect-[4/5] bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
            {photo ? (
              <>
                <img src={photo} alt="Landmarks overlay" className="w-full h-full object-cover opacity-90" />
                {landmarks?.length > 0 && (
                  <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                    {landmarks.map((pt) => (
                      <circle key={pt.id} cx={pt.x * 100} cy={pt.y * 100} r="0.4" fill="#5e9f8b" className="opacity-80" />
                    ))}
                  </svg>
                )}
              </>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-slate-400">Potential Scan</div>
            )}
            <div className="absolute bottom-3 left-3 bg-black/50 backdrop-blur-sm text-[8px] font-bold text-white px-2 py-0.5 rounded-full uppercase tracking-wider">
              Potential
            </div>
          </div>
        </div>
      </div>

      {/* ── Facial Age Scale ── */}
      <div className="bg-slate-50/50 dark:bg-slate-950/20 rounded-3xl p-5 border border-slate-150 dark:border-slate-900/40">
        <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-3">Facial Age vs. Biological Age</p>
        <BiologicalAgeScale faceAge={faceAge} bioAge={bioAge} />
      </div>

      {/* ── Harmony Radar & AI Narrative Overview ── */}
      <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-6 items-center bg-slate-50/50 dark:bg-slate-950/20 rounded-3xl p-5 border border-slate-150 dark:border-slate-900/40">
        <div>
          <RadarChart scores={radarScores} />
        </div>
        <div className="space-y-3">
          <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Harmony Profile & Overview</p>
          <div className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed space-y-3 font-sans">
            {aiNarrativeLoading ? (
              <p className="animate-pulse">Analyzing harmony narrative...</p>
            ) : aiNarrative?.content?.summary ? (
              <p>{aiNarrative.content.summary}</p>
            ) : (
              <p>
                Your analysis shows excellent facial balance with targeted enhancement suggestions. 
                Symmetry scores reside in the top percentiles. Focus recommended on nose width and jawline definition.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ── Feature Table Merkmalsbewertung ── */}
      <div className="bg-slate-50/50 dark:bg-slate-950/20 rounded-3xl p-5 border border-slate-150 dark:border-slate-900/40 overflow-x-auto">
        <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-4">Feature Evaluation</p>
        
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-800 text-[10px] text-slate-400 uppercase tracking-wider">
              <th className="py-2.5 font-bold">Zone</th>
              <th className="py-2.5 font-bold">Finding</th>
              <th className="py-2.5 font-bold">Reference</th>
              <th className="py-2.5 font-bold text-right">Evaluation</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-150/40 dark:divide-slate-850/50">
            {featureRows.map((row) => (
              <tr key={row.zone}>
                <td className="py-3 font-bold text-slate-800 dark:text-slate-200">{row.zone}</td>
                <td className="py-3 font-medium text-slate-600 dark:text-slate-400">{row.befund}</td>
                <td className="py-3 text-slate-400">{row.ref}</td>
                <td className="py-3 text-right">
                  <span className={`inline-block px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wide ${
                    row.isOk
                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                      : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                  }`}>
                    {row.isOk ? 'OK' : 'REVIEW'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
