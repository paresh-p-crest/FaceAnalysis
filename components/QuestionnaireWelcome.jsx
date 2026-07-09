import { Fingerprint, Clock, Scan } from 'lucide-react'

const STATS = [
  { icon: Fingerprint, value: '468+', label: 'Facial landmarks' },
  { icon: Clock, value: '5 min', label: 'Full assessment' },
  { icon: Scan, value: '100%', label: 'Personalized' },
]

export default function QuestionnaireWelcome({ onBegin }) {
  return (
    <div className="min-h-screen flex bg-white dark:bg-slate-900 animate-fade-up">
      {/* Left Column: Welcome */}
      <div className="w-full lg:w-[40%] flex flex-col justify-between p-6 sm:p-16 bg-white dark:bg-slate-950 border-r border-surface-border">
        {/* Brand Header */}
        <div className="flex items-center gap-2.5">
          <span className="font-serif font-bold text-slate-900 dark:text-white text-2xl tracking-tight">MyFace</span>
        </div>

        {/* Content */}
        <div className="my-auto py-12 max-w-lg space-y-8">
          <div>
            <h1 className="font-display text-3xl sm:text-4xl font-bold text-slate-900 dark:text-white leading-tight tracking-tight">
              Your personalized facial analysis starts here
            </h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed mt-4">
              Answer a few quick questions so we can tailor your report to your goals, skin concerns, and demographics. Then upload a photo for AI-powered analysis.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {STATS.map((stat) => (
              <div key={stat.label} className="p-4 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 text-center">
                <stat.icon className="w-5 h-5 text-[#5e9f8b] dark:text-[#5e9f8b] mx-auto mb-2" />
                <div className="text-xl font-bold text-slate-900 dark:text-white">{stat.value}</div>
                <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 uppercase font-medium tracking-wider">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Start Button */}
        <div>
          <button
            onClick={onBegin}
            className="w-full flex items-center bg-[#5e9f8b] hover:bg-[#548f7d] text-white px-6 py-4 rounded-[50px] text-sm font-medium tracking-[-0.03px] transition-all shadow-sm"
          >
            <span className="flex-1 text-left">Get Started</span>
            <span className="text-white/40 mr-4">|</span>
            <span>→</span>
          </button>
          <p className="text-[11px] text-slate-400 dark:text-slate-500 text-center mt-3">
            Takes about 5 minutes
          </p>
        </div>
      </div>

      {/* Right Column: Fluid Wavy Mesh Gradient (Forced Dark Background) */}
      <div className="hidden lg:flex lg:w-[60%] bg-[#0d1e1f] fluid-gradient-mesh flex-col justify-between p-16 relative">
        {/* Top Logo - Q Logo only, no text */}
        <div className="flex items-center gap-3 relative z-10">
          <svg className="w-10 h-10 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <circle cx="12" cy="12" r="8" />
            <path d="M16 16L20 20" />
          </svg>
        </div>

        {/* Bottom Banner Branding */}
        <div className="space-y-6 max-w-xl text-left relative z-10">
          <div className="inline-block px-3 py-1 rounded-full border border-white/20 text-white/80 font-mono text-[10px] uppercase tracking-wider bg-white/5 backdrop-blur-md">
            Complete the questionnaire
          </div>
          <h1 className="font-display text-5xl font-bold text-white tracking-tight leading-tight">
            Onboarding<br />Questions
          </h1>
          <p className="text-sm text-slate-300 leading-relaxed max-w-md">
            Please answer the following questions to help us customize your QOVES journey.
          </p>
        </div>
      </div>
    </div>
  )
}
