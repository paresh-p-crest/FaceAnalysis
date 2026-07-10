import { useState } from 'react'
import { FaceImageFrame, ProportionFeatureOverlay } from './FaceImageFrame'
import { ReportSectionHeading } from './ReportSectionHeading'

const RATIO_PARTS = {
  nasoAural: { primary: 'Ear', secondary: 'Nose' },
  orbitoNasal: { primary: 'Nose', secondary: 'Eye' },
  nasoOral: { primary: 'Mouth', secondary: 'Nose' },
  orbital: { primary: 'Spacing', secondary: 'Eye' },
}

const RATIO_TABS = [
  { id: 'nasoAural', label: 'Ear', ratioLabel: 'NASO-AURAL RATIO' },
  { id: 'orbitoNasal', label: 'Nose', ratioLabel: 'ORBITO-NASAL RATIO' },
  { id: 'nasoOral', label: 'Mouth', ratioLabel: 'NASO-ORAL PROPORTION' },
  { id: 'orbital', label: 'Eye', ratioLabel: 'ORBITAL PROPORTION' },
]

const BAR_HEIGHT = 148

/** Ratio bar: bottom = first feature (value), top = second feature (1.00). E.g. 1:1 → 50/50 split */
function RatioStackBar({ value }) {
  const ratio = Math.max(0, value)
  const primaryPct = (ratio / (ratio + 1)) * 100
  const secondaryPct = 100 - primaryPct

  return (
    <div
      className="relative w-5 rounded-sm overflow-hidden border border-slate-300/50"
      style={{ height: BAR_HEIGHT }}
    >
      <div
        className="absolute bottom-0 left-0 right-0 bg-[#3d5068]"
        style={{ height: `${primaryPct}%` }}
      />
      <div
        className="absolute left-0 right-0 bg-[#b8c5d4]"
        style={{ bottom: `${primaryPct}%`, height: `${secondaryPct}%` }}
      />
    </div>
  )
}

function RatioBar({ yourValue, idealValue, label1, label2, primaryFeature, secondaryFeature }) {
  return (
    <div className="w-full max-w-md mx-auto lg:mx-0">
      <div className="grid grid-cols-[1fr_auto_1fr] gap-4 items-end">
        <div className="text-center">
          <p className="text-[9px] uppercase tracking-wider text-ink-muted mb-1.5 font-semibold">Your Proportion</p>
          <p className="text-sm font-semibold text-ink font-sans min-h-[40px] flex items-center justify-center">{label1}</p>
          <p className="text-[9px] uppercase tracking-wider text-ink-muted mb-1 mt-4">Value</p>
          <p className="text-base font-display font-bold text-ink">{yourValue.toFixed(2)} : 1.00</p>
        </div>

        <div className="flex flex-col items-center gap-3 px-2 pb-6">
          <div className="flex items-end justify-center gap-5">
            <RatioStackBar value={yourValue} />
            <RatioStackBar value={idealValue} />
          </div>
          <div className="flex items-center gap-3 text-[10px] text-ink-muted font-sans">
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-sm bg-[#3d5068] inline-block" />
              {primaryFeature}
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-sm bg-[#b8c5d4] inline-block" />
              {secondaryFeature}
            </span>
          </div>
        </div>

        <div className="text-center">
          <p className="text-[9px] uppercase tracking-wider text-ink-muted mb-1.5 font-semibold">Ideal Proportion</p>
          <p className="text-sm font-semibold text-ink font-sans min-h-[40px] flex items-center justify-center">{label2}</p>
          <p className="text-[9px] uppercase tracking-wider text-ink-muted mb-1 mt-4">Value</p>
          <p className="text-base font-display font-bold text-ink">{idealValue.toFixed(2)} : 1.00</p>
        </div>
      </div>
    </div>
  )
}

export function ProportionsSection({ proportions }) {
  const [activeTab, setActiveTab] = useState('nasoAural')
  if (!proportions?.ratios) return null

  const ratios = proportions.ratios
  const active = ratios[activeTab]
  const activeImageSrc = active?.imageSrc || proportions.imageSrc

  return (
    <div className="pr-2 space-y-6">
      <ReportSectionHeading
        title="Your proportions per"
        accent="feature"
        subtitle="We've compared your facial proportionality with data specific to your demographic."
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {RATIO_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`rounded-xl border p-4 text-left transition-all ${
              activeTab === tab.id
                ? 'border-brand bg-brand-50 dark:bg-brand/10 shadow-sm'
                : 'border-surface-border bg-white dark:bg-surface-card hover:border-brand/30'
            }`}
          >
            <p className="qoves-report-mono-label mb-2 font-medium leading-tight">
              {tab.ratioLabel}
            </p>
            <p className={`text-base font-display font-semibold ${
              activeTab === tab.id ? 'text-brand' : 'text-ink'
            }`}>
              {tab.label}
            </p>
          </button>
        ))}
      </div>

      {active && (
        <div className="rounded-2xl border border-surface-border bg-white dark:bg-surface-card p-6">
          <p className="text-[10px] uppercase tracking-wider text-ink-muted mb-3 font-medium">
            {active.ratioLabel}
          </p>
          <p className="text-sm text-ink font-sans mb-5 leading-relaxed">
            {active.expectation}
          </p>

          <div className="grid lg:grid-cols-2 gap-8 items-center">
            {activeImageSrc && (
              <FaceImageFrame
                src={activeImageSrc}
                alt="Facial proportions"
                aspect="4/5"
                maxW="280px"
                fit="contain"
                alignOverlay
                overlay={<ProportionFeatureOverlay overlay={active.overlay} />}
              />
            )}

            <RatioBar
              yourValue={active.yourValue}
              idealValue={active.idealValue}
              label1={active.yourLabel}
              label2={active.idealLabel}
              primaryFeature={RATIO_PARTS[activeTab]?.primary}
              secondaryFeature={RATIO_PARTS[activeTab]?.secondary}
            />
          </div>

          <div className="mt-6 pt-4 border-t border-surface-border">
            <p className="text-[10px] uppercase tracking-wider text-ink-muted mb-2 font-medium">Explanation</p>
            <p className="text-sm text-ink-secondary leading-relaxed font-sans">{active.explanation}</p>
          </div>
        </div>
      )}
    </div>
  )
}
