import { useState } from 'react'
import { X, Settings as SettingsIcon, Key, Cloud, Info, CheckCircle2, Cpu, Loader2, Wifi, WifiOff } from 'lucide-react'
import { loadSettings, saveSettings } from '../utils/settings'
import { testAwsConnection } from '../utils/awsRekognition'
import { OPENAI_REPORT_MODEL } from '../utils/constants'

const TABS = [
  { id: 'local', label: 'Free CV', icon: Cpu },
  { id: 'aws', label: 'AWS', icon: Cloud },
  { id: 'openai', label: 'OpenAI', icon: Key },
]

export default function Settings({ open, onClose }) {
  const [form, setForm] = useState(loadSettings)
  const [activeTab, setActiveTab] = useState(form.activeLLM || 'local')
  const [saved, setSaved] = useState(false)
  const [testStatus, setTestStatus] = useState(null) // null | 'testing' | { ok, error? }
  const [savedFields, setSavedFields] = useState(false)

  if (!open) return null

  const handleSave = () => {
    const prev = loadSettings()
    saveSettings({ ...form, activeLLM: activeTab })
    setSaved(true)
    setSavedFields(true)
    setTimeout(() => { setSaved(false); setSavedFields(false) }, 2000)
    if (prev.activeLLM !== activeTab) {
      setTimeout(() => window.location.reload(), 400)
    }
  }

  const handleTestAws = async () => {
    setTestStatus('testing')
    // Save current fields first so getAwsCredentials picks them up
    const prev = loadSettings()
    saveSettings({ ...form, activeLLM: activeTab })
    // Small delay for localStorage to flush
    await new Promise((r) => setTimeout(r, 50))
    const result = await testAwsConnection()
    setTestStatus(result)
    // Restore previous settings if we changed them
    if (prev.activeLLM !== activeTab) {
      saveSettings({ ...prev })
    }
    setTimeout(() => setTestStatus(null), 4000)
  }

  const TAB_LABELS = {
    local: { app: 'Free CV', desc: 'MediaPipe + OpenCV ($0)' },
    aws: { app: 'AWS', desc: 'Amazon Rekognition' },
    openai: { app: 'OpenAI', desc: `GPT-4o-mini` },
  }
  const headerLabel = TAB_LABELS[activeTab]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-lg bg-white dark:bg-surface-card rounded-3xl p-6 sm:p-8 shadow-modal animate-scale-in max-h-[90vh] overflow-y-auto border border-surface-border">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center">
              <SettingsIcon className="w-5 h-5 text-brand" />
            </div>
            <div>
              <h2 className="font-display text-lg font-semibold text-ink">API Settings</h2>
              <div className="flex items-center gap-2 mt-1">
                <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-medium bg-brand-50 text-brand border border-brand/20">
                  {headerLabel.app}
                </span>
                <span className="text-[10px] text-ink-muted">· {headerLabel.desc}</span>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-surface-warm text-ink-muted transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mb-5 p-3 rounded-xl bg-surface-warm border border-surface-border flex gap-3">
          <Info className="w-4 h-4 text-brand shrink-0 mt-0.5" />
          <div className="text-xs text-ink-secondary leading-relaxed">
            {activeTab === 'local'
              ? 'Free CV — MediaPipe + OpenCV in your browser. No API keys. Eye report with template text (no LLM).'
              : 'Keys stored in browser only (localStorage). Never sent to our servers.'}
          </div>
        </div>

        {/* Provider tabs */}
        <div className="flex gap-1 p-1 rounded-xl bg-surface-warm dark:bg-surface-raised border border-surface-border mb-6">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                activeTab === tab.id
                  ? 'bg-white dark:bg-surface-card text-brand shadow-soft border border-surface-border'
                  : 'text-ink-muted hover:text-ink-secondary'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        <div className="space-y-4">
          {activeTab === 'local' ? (
            <div className="rounded-xl border border-brand/20 bg-brand-50 p-4">
              <p className="text-sm text-ink font-medium mb-2">No credentials required</p>
              <p className="text-xs text-ink-secondary leading-relaxed">
                Runs entirely in the browser. Free eye analysis report from landmark geometry and pixel sampling.
              </p>
              <p className="text-[10px] text-ink-muted leading-relaxed mt-3">
                <span className="text-ink-secondary">CV:</span> MediaPipe Face Landmarker + OpenCV
                <span className="text-ink-faint mx-1">·</span>
                <span className="text-ink-secondary">Report:</span> Rule-based template (no LLM)
                <span className="text-ink-faint mx-1">·</span>
                <span className="text-brand">$0 API cost</span>
              </p>
            </div>
          ) : activeTab === 'aws' ? (
            <>
              <input
                type="text"
                placeholder="AWS Access Key ID"
                value={form.awsAccessKeyId}
                onChange={(e) => setForm({ ...form, awsAccessKeyId: e.target.value })}
                className="input-field"
              />
              <input
                type="password"
                placeholder="AWS Secret Access Key"
                value={form.awsSecretAccessKey}
                onChange={(e) => setForm({ ...form, awsSecretAccessKey: e.target.value })}
                className="input-field"
              />
              <input
                type="password"
                placeholder="AWS Session Token (required for ASIA… keys)"
                value={form.awsSessionToken}
                onChange={(e) => setForm({ ...form, awsSessionToken: e.target.value })}
                className="input-field"
              />
              <input
                type="text"
                placeholder="AWS Region (e.g. us-east-1)"
                value={form.awsRegion}
                onChange={(e) => setForm({ ...form, awsRegion: e.target.value })}
                className="input-field"
              />
              <button
                onClick={handleTestAws}
                disabled={!form.awsAccessKeyId || !form.awsSecretAccessKey || testStatus === 'testing'}
                className="w-full mt-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border border-surface-border transition-all hover:border-brand/40 hover:bg-brand-50 disabled:opacity-40 disabled:pointer-events-none"
              >
                {testStatus === 'testing' ? (
                  <><Loader2 className="w-4 h-4 animate-spin text-brand" /> Testing connection…</>
                ) : testStatus?.ok ? (
                  <><CheckCircle2 className="w-4 h-4 text-green-600" /> {testStatus.message || 'Connected successfully'}</>
                ) : testStatus && !testStatus.ok ? (
                  <><WifiOff className="w-4 h-4 text-red-500" /> {testStatus.error}</>
                ) : (
                  <><Wifi className="w-4 h-4 text-ink-muted" /> Test Connection</>
                )}
              </button>
              <p className="text-[10px] text-ink-muted leading-relaxed">
                <span className="text-ink-secondary">CV:</span> Amazon Rekognition DetectFaces
                <span className="text-ink-faint mx-1">·</span>
                <span className="text-ink-secondary">Report:</span> Template from AWS data (no LLM / Bedrock)
              </p>
            </>
          ) : (
            <>
              <input
                type="password"
                placeholder="OpenAI API Key (sk-...)"
                value={form.openaiKey}
                onChange={(e) => setForm({ ...form, openaiKey: e.target.value })}
                className="input-field"
              />
              <p className="text-[10px] text-ink-muted leading-relaxed">
                <span className="text-ink-secondary">CV:</span> MediaPipe Face Landmarker + OpenCV
                <span className="text-ink-faint mx-1">·</span>
                <span className="text-ink-secondary">Report model:</span> {OPENAI_REPORT_MODEL}
              </p>
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
