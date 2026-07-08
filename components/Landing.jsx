'use client'

import { useState } from 'react'
import { 
  ScanFace, ChevronRight, Check, ShieldCheck, Sparkles, 
  Lock, Upload, Landmark, Zap, Sun, Moon
} from 'lucide-react'
import { useTheme } from '../utils/theme'

const FAQS = [
  { q: 'How does the facial analysis work?', a: 'AuraScan utilizes high-resolution computer vision models to locate 468+ landmark points. We calculate facial thirds proportions, left-right symmetry, jawline angles, and facial shape categories using geometric math.' },
  { q: 'Are my uploaded photos stored securely?', a: 'We take privacy seriously. Your photos are processed securely in-memory and are never permanently saved on our servers. The analysis runs instantly, and the raw images are discarded.' },
  { q: 'Is this medical or diagnostic advice?', a: 'No. AuraScan is designed strictly for informational, educational, and aesthetic assessment purposes. It is not intended to diagnose, treat, or prevent any medical condition.' },
  { q: 'What kind of photo should I upload for best results?', a: 'For optimal results, upload a clear, front-facing photo with neutral facial expressions, good lighting, and no glasses or hair covering your forehead and face.' },
]

const STEPS = [
  { num: '01', title: 'Upload Photo', desc: 'Submit a front-facing selfie with neutral lighting.' },
  { num: '02', title: 'AI Facial Mapping', desc: 'Our model analyzes angles, symmetry, and proportions.' },
  { num: '03', title: 'Receive Premium Report', desc: 'Unlock visual overlays and detailed narrative reviews.' },
]

export default function Landing({ onBegin }) {
  const [activeTab, setActiveTab] = useState('symmetry')
  const [faqOpen, setFaqOpen] = useState(null)
  const { theme, toggleTheme } = useTheme()

  const toggleFaq = (index) => {
    setFaqOpen(faqOpen === index ? null : index)
  }

  return (
    <div className="bg-surface dark:bg-surface text-ink min-h-screen font-sans selection:bg-brand/20 transition-colors duration-300">
      
      {/* 1. Navigation Header */}
      <header className="sticky top-0 z-50 w-full border-b border-surface-border bg-white dark:bg-surface-card transition-colors duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-brand flex items-center justify-center shadow-brand/20 shadow-md">
              <ScanFace className="w-4.5 h-4.5 text-white" />
            </div>
            <span className="font-display font-semibold text-ink text-base sm:text-lg tracking-tight">AuraScan</span>
          </div>
          
          <nav className="hidden md:flex items-center gap-8">
            <a href="#how-it-works" className="text-sm font-medium text-ink-secondary hover:text-brand transition-colors">How It Works</a>
            <a href="#sample-report" className="text-sm font-medium text-ink-secondary hover:text-brand transition-colors">Sample Report</a>
            <a href="#trust-security" className="text-sm font-medium text-ink-secondary hover:text-brand transition-colors">Trust & Security</a>
            <a href="#faq" className="text-sm font-medium text-ink-secondary hover:text-brand transition-colors">FAQ</a>
          </nav>

          <div className="flex items-center gap-3">
            <button
              onClick={toggleTheme}
              className="p-2 rounded-xl bg-surface-raised dark:bg-surface border border-surface-border text-ink-muted hover:text-brand transition-colors"
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <button 
              id="nav-cta-btn"
              onClick={onBegin}
              className="inline-flex items-center gap-1 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold text-white bg-brand hover:bg-brand-dark transition-all duration-200 hover:scale-[1.02] shadow-sm hover:shadow-brand/15"
            >
              Start Journey
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* 2. Hero Section */}
      <section className="relative pt-12 pb-20 md:py-28 overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid lg:grid-cols-12 gap-12 lg:gap-8 items-center">
            
            {/* Left Copy */}
            <div className="lg:col-span-7 space-y-6 animate-fade-up">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-50 border border-brand/10 dark:bg-surface-raised dark:border-surface-border">
                {/* <Sparkles className="w-3.5 h-3.5 text-brand" /> */}
                <span className="text-[10px] font-semibold text-brand tracking-wide uppercase">Join 10,000+ people</span>
              </div>
              <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-bold leading-[1.1] tracking-tight text-ink">
                Understand your <br className="hidden sm:inline" />
                face with <span className="text-brand">precision AI</span>.
              </h1>
              <p className="text-ink-secondary text-base sm:text-lg max-w-xl leading-relaxed">
                Receive structured geometric mappings, symmetry indexing, and personalized face report summaries from a single photo.
              </p>
              
              <div className="pt-2">
                <button
                  id="hero-primary-cta"
                  onClick={onBegin}
                  className="btn-primary text-sm w-full sm:w-auto px-10 py-4 shadow hover:shadow-brand/20 hover:scale-[1.01] transition-all duration-200"
                >
                  Start Your Journey
                </button>
              </div>

              {/* 3 Trust Chips */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-4 pt-4 border-t border-surface-border/50 max-w-lg">
                <div className="flex items-center gap-2 text-xs text-ink-muted">
                  <ShieldCheck className="w-4 h-4 text-brand" />
                  <span>Processed In-Memory</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-ink-muted">
                  <Lock className="w-4 h-4 text-brand" />
                  <span>No Photo Storage</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-ink-muted">
                  <Check className="w-4 h-4 text-brand" />
                  <span>Informational Diagnostic</span>
                </div>
              </div>
            </div>

            {/* Right Portrait Image */}
            <div className="lg:col-span-5 flex justify-center w-full animate-scale-in">
              <div className="relative w-full max-w-[340px] aspect-[3/4] rounded-2xl overflow-hidden shadow-2xl border border-surface-border bg-white dark:bg-surface-card">
                <img 
                  src="/demo-photos/front.jpg" 
                  alt="AuraScan Facial Landmark Diagnostic Portrait" 
                  className="w-full h-full object-cover object-center grayscale-[10%]"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent pointer-events-none" />
                
                {/* Clean Indicator Badge */}
                <div className="absolute bottom-6 left-6 bg-white dark:bg-surface-card rounded-xl px-4 py-2.5 border border-surface-border shadow-md">
                  <p className="text-[9px] uppercase font-bold text-brand tracking-wider">Active Analysis</p>
                  <p className="text-xs font-display font-semibold text-ink mt-0.5">Symmetry Overlays Enabled</p>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* 3. How It Works */}
      <section id="how-it-works" className="py-16 md:py-24 bg-white dark:bg-surface-card border-y border-surface-border transition-colors duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16 space-y-2">
            <span className="text-xs font-semibold text-brand tracking-widest uppercase">Methodology</span>
            <h2 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-ink">Three Simple Steps</h2>
          </div>

          <div className="grid md:grid-cols-3 gap-12 relative">
            {STEPS.map((step, idx) => (
              <div key={step.title} className="relative flex flex-col items-center text-center space-y-4">
                <div className="font-display text-5xl font-extrabold text-brand/15">{step.num}</div>
                <h3 className="font-display font-bold text-ink text-base sm:text-lg">{step.title}</h3>
                <p className="text-xs sm:text-sm text-ink-secondary leading-relaxed max-w-xs">{step.desc}</p>
                {idx < 2 && (
                  <div className="hidden md:block absolute top-6 right-[-25%] w-[40%] h-[1px] bg-surface-border" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 4. Sample Report (Integrated Diagnostic & Overlays) */}
      <section id="sample-report" className="py-20 md:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-2xl mx-auto mb-16 space-y-3">
            <span className="text-xs font-semibold text-brand tracking-wider uppercase">Interactive Preview</span>
            <h2 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-ink">
              Explore Our Landmark Analysis
            </h2>
            <p className="text-xs sm:text-sm text-ink-secondary">
              See how our mathematical engine maps facial zones to output a premium, structured report.
            </p>
          </div>

          <div className="grid lg:grid-cols-12 gap-8 lg:gap-12 items-center">
            
            {/* Left Portrait Image with Dynamic Overlays */}
            <div className="lg:col-span-6 flex justify-center w-full">
              <div className="relative w-full max-w-[360px] aspect-[4/5] rounded-2xl overflow-hidden shadow-xl border border-surface-border bg-white dark:bg-surface-card">
                {activeTab === 'symmetry' && (
                  <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
                    <div className="w-[1.5px] h-full bg-brand/50 absolute left-1/2 top-0" />
                    <div className="absolute left-[30%] top-[40%] w-2 h-2 rounded-full bg-brand border border-white" />
                    <div className="absolute right-[30%] top-[40%] w-2 h-2 rounded-full bg-brand border border-white" />
                    <div className="absolute left-[22%] top-[55%] w-2 h-2 rounded-full bg-brand border border-white" />
                    <div className="absolute right-[22%] top-[55%] w-2 h-2 rounded-full bg-brand border border-white" />
                    <div className="absolute left-1/2 top-[58%] w-2.5 h-2.5 rounded-full bg-brand-dark border border-white" />
                  </div>
                )}
                {activeTab === 'proportions' && (
                  <div className="absolute inset-0 z-10 flex flex-col justify-between py-12 pointer-events-none">
                    <div className="w-full h-[1.5px] bg-brand/35" />
                    <div className="w-full h-[1.5px] bg-brand/35" />
                    <div className="w-full h-[1.5px] bg-brand/35" />
                  </div>
                )}
                <img 
                  src="/demo-photos/front.jpg" 
                  alt="Detailed Face Analysis Map" 
                  className="w-full h-full object-cover object-center grayscale-[5%]"
                />
              </div>
            </div>

            {/* Right Panels & Metrics Selector */}
            <div className="lg:col-span-6 space-y-6">
              
              {/* Tab selector */}
              <div className="flex overflow-x-auto gap-2 p-1 bg-surface-raised dark:bg-surface rounded-2xl border border-surface-border whitespace-nowrap scrollbar-none select-none">
                {['symmetry', 'proportions', 'faceShape', 'skin'].map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`flex-1 shrink-0 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold capitalize transition-all ${
                      activeTab === tab
                        ? 'bg-white dark:bg-surface-card text-brand shadow-sm border border-surface-border'
                        : 'text-ink-muted hover:text-ink'
                    }`}
                  >
                    {tab === 'faceShape' ? 'Face Shape' : tab}
                  </button>
                ))}
              </div>

              {/* Detail Content Panel with circular progress */}
              <div className="border border-surface-border bg-white dark:bg-surface-card rounded-2xl p-6 sm:p-8 space-y-6 min-h-[300px] flex flex-col justify-between shadow-sm">
                
                <div className="grid sm:grid-cols-12 gap-6 items-start">
                  
                  {/* Left Column: Progress Circle */}
                  <div className="sm:col-span-4 flex flex-col items-center text-center p-4 rounded-xl bg-surface-raised dark:bg-surface border border-surface-border">
                    <span className="text-[9px] uppercase font-bold text-ink-muted tracking-wider">Harmony</span>
                    <div className="relative w-20 h-20 my-3 flex items-center justify-center">
                      <svg className="w-full h-full transform -rotate-90">
                        <circle cx="40" cy="40" r="34" className="stroke-surface-border fill-transparent" strokeWidth="4.5" />
                        <circle cx="40" cy="40" r="34" className="stroke-brand fill-transparent" strokeWidth="4.5" strokeDasharray="213.5" strokeDashoffset="21.3" strokeLinecap="round" />
                      </svg>
                      <span className="absolute text-lg font-display font-bold text-ink">92</span>
                    </div>
                    <span className="text-[10px] font-semibold text-brand">Excellent</span>
                  </div>

                  {/* Right Column: Dynamic Tab Details */}
                  <div className="sm:col-span-8 space-y-4">
                    {activeTab === 'symmetry' && (
                      <div className="space-y-3 animate-fade-in">
                        <h4 className="font-display font-semibold text-sm sm:text-base text-ink">Left-Right Balance</h4>
                        <p className="text-xs text-ink-secondary leading-relaxed">
                          Matches matching landmarks from the left hemisphere of the facial contour against their exact mirrors on the right hemisphere.
                        </p>
                        <div className="space-y-2 pt-1">
                          <div className="flex justify-between text-[11px] font-semibold text-ink-secondary">
                            <span>Eyebrow Alignment</span>
                            <span className="text-brand">95.4%</span>
                          </div>
                          <div className="w-full h-1.5 rounded-full bg-surface-raised overflow-hidden">
                            <div className="h-full bg-brand rounded-full" style={{ width: '95.4%' }} />
                          </div>
                        </div>
                      </div>
                    )}

                    {activeTab === 'proportions' && (
                      <div className="space-y-3 animate-fade-in">
                        <h4 className="font-display font-semibold text-sm sm:text-base text-ink">Facial Thirds Harmony</h4>
                        <p className="text-xs text-ink-secondary leading-relaxed">
                          Validates vertical balance ratios: upper (trichion-glabella), middle (glabella-subnasale), and lower (subnasale-menton).
                        </p>
                        <div className="grid grid-cols-3 gap-2 pt-1">
                          {[{ label: 'Upper', val: '1.02' }, { label: 'Mid', val: '1.00' }, { label: 'Lower', val: '0.98' }].map((t) => (
                            <div key={t.label} className="bg-surface-raised dark:bg-surface py-2 rounded-xl text-center border border-surface-border">
                              <p className="text-[8px] uppercase font-bold text-ink-muted">{t.label}</p>
                              <p className="text-xs font-semibold text-ink mt-0.5">{t.val}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {activeTab === 'faceShape' && (
                      <div className="space-y-3 animate-fade-in">
                        <h4 className="font-display font-semibold text-sm sm:text-base text-ink">Geometric Shape</h4>
                        <p className="text-xs text-ink-secondary leading-relaxed">
                          Evaluates the height-to-width ratio alongside cheekbone boundaries to determine global geometric facial shapes.
                        </p>
                        <div className="p-3 bg-surface-raised dark:bg-surface rounded-xl border border-surface-border text-xs text-ink">
                          Primary Match: <span className="font-semibold text-brand">Oval Structure (96.8%)</span>
                        </div>
                      </div>
                    )}

                    {activeTab === 'skin' && (
                      <div className="space-y-3 animate-fade-in">
                        <h4 className="font-display font-semibold text-sm sm:text-base text-ink">Texture & Tone Mapping</h4>
                        <p className="text-xs text-ink-secondary leading-relaxed">
                          Checks skin color contrast, tone distribution, and environmental stress signals.
                        </p>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="border border-surface-border p-2.5 rounded-xl text-center bg-surface-raised dark:bg-surface">
                            <span className="text-[8px] uppercase text-ink-muted">Tone Uniformity</span>
                            <p className="text-xs font-bold text-brand mt-0.5">91.4%</p>
                          </div>
                          <div className="border border-surface-border p-2.5 rounded-xl text-center bg-surface-raised dark:bg-surface">
                            <span className="text-[8px] uppercase text-ink-muted">Clarity Index</span>
                            <p className="text-xs font-bold text-brand mt-0.5">Good</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                </div>

                <button 
                  onClick={onBegin}
                  className="btn-primary text-xs sm:text-sm w-full py-3"
                >
                  Analyze My Face Now
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

            </div>

          </div>
        </div>
      </section>

      {/* 5. Trust, Privacy & Checkout Security */}
      <section id="trust-security" className="py-16 md:py-24 bg-white dark:bg-surface-card border-y border-surface-border transition-colors duration-300">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <div className="text-center space-y-4 max-w-2xl mx-auto mb-12">
            <span className="text-xs font-semibold text-brand tracking-wider uppercase">Privacy Standards</span>
            <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-ink">Secure Diagnostic Security</h2>
            <p className="text-xs sm:text-sm text-ink-secondary leading-relaxed">
              We process data like a diagnostic utility. All photos are analyzed in-memory and discarded post-computation.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 gap-6 mb-12">
            <div className="border border-surface-border p-5 rounded-xl bg-surface-raised dark:bg-surface">
              <h4 className="font-display font-semibold text-sm sm:text-base text-ink mb-1">Absolute Deletion Policy</h4>
              <p className="text-xs text-ink-secondary leading-relaxed">
                Images are temporarily buffered to run our computer vision geometry engine. Once calculations are complete, the images are deleted.
              </p>
            </div>
            <div className="border border-surface-border p-5 rounded-xl bg-surface-raised dark:bg-surface">
              <h4 className="font-display font-semibold text-sm sm:text-base text-ink mb-1">Non-Medical Disclaimer</h4>
              <p className="text-xs text-ink-secondary leading-relaxed">
                AuraScan does not diagnose, treat, or prevent any skin conditions or clinical concerns. Calculations are mathematical summaries.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap justify-center items-center gap-6 opacity-60 text-xs sm:text-sm font-display font-bold tracking-widest text-ink border-t border-surface-border/50 pt-8">
            <span>STRIPE SECURE</span>
            <span className="text-brand">•</span>
            <span>PAYPAL GATEWAY</span>
            <span className="text-brand">•</span>
            <span>SSL CERTIFIED</span>
          </div>
        </div>
      </section>

      {/* 6. FAQ & Final CTA */}
      <section id="faq" className="py-16 md:py-24">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12 space-y-2">
            <span className="text-xs font-semibold text-brand tracking-wider uppercase">FAQ</span>
            <h2 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-ink">Common Questions</h2>
          </div>

          <div className="space-y-4">
            {FAQS.map((faq, index) => {
              const isOpen = faqOpen === index
              return (
                <div key={faq.q} className="border-b border-surface-border pb-4">
                  <button
                    onClick={() => toggleFaq(index)}
                    className="w-full flex justify-between items-center text-left py-3 font-display font-semibold text-ink text-sm sm:text-base focus:outline-none"
                  >
                    <span>{faq.q}</span>
                    <span className="text-brand text-lg font-bold ml-4">
                      {isOpen ? '−' : '+'}
                    </span>
                  </button>
                  <div className={`overflow-hidden transition-all duration-300 ${isOpen ? 'max-h-48 mt-2' : 'max-h-0'}`}>
                    <p className="text-xs sm:text-sm text-ink-secondary leading-relaxed pb-2">
                      {faq.a}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* Final Conversion Section */}
      <section className="py-16 md:py-24 bg-gradient-to-br from-brand-50/50 to-transparent dark:from-surface-raised dark:to-transparent border-t border-surface-border">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 text-center space-y-6">
          <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-ink">
            Ready to explore your facial structure?
          </h2>
          <p className="text-xs sm:text-base text-ink-secondary max-w-lg mx-auto leading-relaxed">
            Start your analysis in minutes. Receive detailed measurements and personal reports securely.
          </p>
          <button
            onClick={onBegin}
            className="btn-primary text-xs sm:text-sm py-4 px-10 rounded-xl shadow-sm hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
          >
            Start Your Journey
            <ChevronRight className="w-4.5 h-4.5" />
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-surface-border bg-white dark:bg-surface-card py-12 transition-colors duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-brand flex items-center justify-center">
                <ScanFace className="w-3.5 h-3.5 text-white" />
              </div>
              <span className="font-display font-semibold text-ink text-sm tracking-tight">AuraScan</span>
            </div>
            <p className="text-xs text-ink-muted">© {new Date().getFullYear()} AuraScan. All rights reserved.</p>
          </div>
          <p className="text-[10px] text-ink-muted text-center leading-relaxed">
            Disclaimer: AuraScan is not a medical application. All measurements and descriptors are mathematically calculated algorithms from image contours and landmarks for educational and aesthetic guidance.
          </p>
        </div>
      </footer>

    </div>
  )
}
