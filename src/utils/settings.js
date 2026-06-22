import { isDemoMode, getAppMode, setAppMode } from './appMode'

const STORAGE_KEYS = {
  activeLLM: 'aurascan_active_llm',
  openai: 'aurascan_openai_key',
  awsAccessKeyId: 'aurascan_aws_access_key_id',
  awsSecretAccessKey: 'aurascan_aws_secret_access_key',
  awsSessionToken: 'aurascan_aws_session_token',
  awsRegion: 'aurascan_aws_region',
}

export function getActiveProvider() {
  const v = localStorage.getItem(STORAGE_KEYS.activeLLM)
  if (v === 'openai' || v === 'aws' || v === 'local') return v
  return 'local'
}

/** @deprecated use getActiveProvider */
export function getActiveLLM() {
  return getActiveProvider()
}

export function loadSettings() {
  return {
    appMode: getAppMode(),
    activeLLM: getActiveLLM(),
    openaiKey: localStorage.getItem(STORAGE_KEYS.openai) || '',
    awsAccessKeyId: localStorage.getItem(STORAGE_KEYS.awsAccessKeyId) || '',
    awsSecretAccessKey: localStorage.getItem(STORAGE_KEYS.awsSecretAccessKey) || '',
    awsSessionToken: localStorage.getItem(STORAGE_KEYS.awsSessionToken) || '',
    awsRegion: localStorage.getItem(STORAGE_KEYS.awsRegion) || 'us-east-1',
  }
}

export function saveSettings({ appMode, activeLLM, openaiKey, awsAccessKeyId, awsSecretAccessKey, awsSessionToken, awsRegion }) {
  setAppMode(appMode)
  const provider = ['aws', 'openai', 'local'].includes(activeLLM) ? activeLLM : 'local'
  localStorage.setItem(STORAGE_KEYS.activeLLM, provider)
  localStorage.setItem(STORAGE_KEYS.openai, openaiKey || '')
  localStorage.setItem(STORAGE_KEYS.awsAccessKeyId, awsAccessKeyId || '')
  localStorage.setItem(STORAGE_KEYS.awsSecretAccessKey, awsSecretAccessKey || '')
  localStorage.setItem(STORAGE_KEYS.awsSessionToken, awsSessionToken || '')
  localStorage.setItem(STORAGE_KEYS.awsRegion, awsRegion || 'us-east-1')
}

export function getOpenAIKey() {
  if (isDemoMode() || getActiveProvider() !== 'openai') return ''
  return localStorage.getItem(STORAGE_KEYS.openai)?.trim() || ''
}

export function getAwsCredentials() {
  if (isDemoMode() || getActiveProvider() !== 'aws') {
    return { accessKeyId: '', secretAccessKey: '', region: 'us-east-1' }
  }
  const s = loadSettings()
  return {
    accessKeyId: s.awsAccessKeyId.trim(),
    secretAccessKey: s.awsSecretAccessKey.trim(),
    sessionToken: s.awsSessionToken.trim(),
    region: s.awsRegion.trim() || 'us-east-1',
  }
}

export function hasAwsCredentials() {
  const { accessKeyId, secretAccessKey } = getAwsCredentials()
  return !!(accessKeyId && secretAccessKey)
}

export function getAnalysisMode() {
  if (isDemoMode()) return 'demo'

  const provider = getActiveProvider()

  if (provider === 'local') return 'local-cv'

  if (provider === 'aws') {
    if (hasAwsCredentials()) return 'aws'
    return 'aws-missing-creds'
  }

  if (!getOpenAIKey()) return 'openai-missing-key'
  return 'mediapipe+openai'
}

export function getModeSummary() {
  const mode = getAnalysisMode()
  const provider = getActiveProvider()
  const labels = {
    demo: 'Demo — all mock data',
    'local-cv': 'Real — MediaPipe + OpenCV eye report ($0)',
    aws: 'Real — AWS Rekognition (active provider)',
    'aws-missing-creds': 'Real — AWS selected but credentials missing',
    'mediapipe+openai': 'Real — MediaPipe + OpenAI (active provider)',
    'openai-missing-key': 'Real — OpenAI API key missing',
  }
  const appLabel = isDemoMode()
    ? 'Demo (mock)'
    : provider === 'local'
      ? 'Real · Free CV'
      : provider === 'aws'
        ? 'Real · AWS'
        : 'Real · OpenAI'
  return { mode, label: labels[mode] || mode, appLabel, activeLLM: provider, activeProvider: provider }
}
