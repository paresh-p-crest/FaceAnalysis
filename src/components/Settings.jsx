import { useState } from 'react'
import { X, Settings as SettingsIcon, Key, Cloud, Info, CheckCircle2 } from 'lucide-react'
import { loadSettings, saveSettings, getModeSummary } from '../utils/settings'

const TABS = [
  { id: 'aws', label: 'AWS', icon: Cloud },
  { id: 'openai', label: 'OpenAI', icon: Key },
]

export default function Settings({ open, onClose }) {
  const [form, setForm] = useState(loadSettings)
  const [activeTab, setActiveTab] = useState(form.activeLLM || 'aws')
  const [saved, setSaved] = useState(false)

  if (!open) return null

  const isDemo = form.appMode !== 'real'

  const handleSave = () => {
    const prevMode = loadSettings().appMode
    saveSettings({ ...form, activeLLM: activeTab })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
    if (prevMode !== form.appMode) {
      setTimeout(() => window.location.reload(), 400)
    }
  }

  const { label, appLabel } = getModeSummary()

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-lg glass-strong rounded-3xl p-6 sm:p-8 animate-fade-up max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
              <SettingsIcon className="w-5 h-5 text-accent" />
            </div>
            <div>
              <h2 className="font-display text-lg font-semibold text-white">API Settings</h2>
              <div className="flex items-center gap-2 mt-1">
                <span
                  className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-medium font-sans ${
                    isDemo
                      ? 'bg-amber-500/10 text-amber-300 border border-amber-500/20'
                      : 'bg-accent/10 text-accent border border-accent/20'
                  }`}
                >
                  {appLabel}
                </span>
                <span className="text-[10px] text-slate-600 font-sans">· {label}</span>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/5 text-slate-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mb-5 flex items-center justify-between gap-3">
          <span className="text-[10px] text-slate-500 font-sans uppercase tracking-wider">App mode</span>
          <div className="flex gap-1 p-0.5 rounded-lg bg-white/[0.04] border border-white/[0.06]">
            {['demo', 'real'].map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setForm({ ...form, appMode: mode })}
                className={`px-3 py-1 rounded-md text-[10px] font-medium font-sans capitalize transition-all ${
                  form.appMode === mode
                    ? mode === 'demo'
                      ? 'bg-amber-500/15 text-amber-300'
                      : 'bg-accent/15 text-accent'
                    : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-5 p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] flex gap-3">
          <Info className="w-4 h-4 text-accent shrink-0 mt-0.5" />
          <div className="text-xs text-slate-400 leading-relaxed font-sans">
            {isDemo
              ? 'Demo uses mock analysis. Switch to Real and add credentials below for live analysis.'
              : 'Real mode — active tab = active provider. Keys stored in browser only.'}
          </div>
        </div>

        {/* Provider tabs */}
        <div className="flex gap-1 p-1 rounded-xl bg-white/[0.04] border border-white/[0.06] mb-6">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab.id
                  ? 'bg-accent/15 text-accent border border-accent/30'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
              {activeTab === tab.id && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent/20">Active</span>
              )}
            </button>
          ))}
        </div>

        <div className="space-y-4">
          {activeTab === 'aws' ? (
            <>
              <p className="text-xs text-slate-500">
                AWS Rekognition for face detection. Keys starting with <code className="text-accent/70">ASIA</code> need a session token (AWS Academy/sandbox).
              </p>
              <input
                type="text"
                placeholder="AWS Access Key ID"
                value={form.awsAccessKeyId}
                onChange={(e) => setForm({ ...form, awsAccessKeyId: e.target.value })}
                disabled={isDemo}
                className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-accent/40 disabled:opacity-40"
              />
              <input
                type="password"
                placeholder="AWS Secret Access Key"
                value={form.awsSecretAccessKey}
                onChange={(e) => setForm({ ...form, awsSecretAccessKey: e.target.value })}
                disabled={isDemo}
                className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-accent/40 disabled:opacity-40"
              />
              <input
                type="password"
                placeholder="AWS Session Token (required for ASIA… keys)"
                value={form.awsSessionToken}
                onChange={(e) => setForm({ ...form, awsSessionToken: e.target.value })}
                disabled={isDemo}
                className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-accent/40 disabled:opacity-40"
              />
              <input
                type="text"
                placeholder="AWS Region (e.g. us-east-1)"
                value={form.awsRegion}
                onChange={(e) => setForm({ ...form, awsRegion: e.target.value })}
                disabled={isDemo}
                className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-accent/40 disabled:opacity-40"
              />
            </>
          ) : (
            <>
              <p className="text-xs text-slate-500">
                MediaPipe + OpenCV for CV analysis · OpenAI for AI report text.
              </p>
              <input
                type="password"
                placeholder="OpenAI API Key (sk-...)"
                value={form.openaiKey}
                onChange={(e) => setForm({ ...form, openaiKey: e.target.value })}
                disabled={isDemo}
                className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-accent/40 disabled:opacity-40"
              />
            </>
          )}
        </div>

        <div className="flex gap-3 mt-8">
          <button onClick={onClose} className="btn-ghost flex-1 text-sm">Cancel</button>
          <button onClick={handleSave} className="btn-primary flex-1 text-sm">
            {saved ? (
              <>
                <CheckCircle2 className="w-4 h-4" />
                Saved
              </>
            ) : (
              'Save Settings'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
