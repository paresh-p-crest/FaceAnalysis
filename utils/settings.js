const STORAGE_KEYS = {
  activeLLM: 'myface_active_llm',
  awsAccessKeyId: 'myface_aws_access_key_id',
  awsSecretAccessKey: 'myface_aws_secret_access_key',
  awsSessionToken: 'myface_aws_session_token',
  awsRegion: 'myface_aws_region',
}

const DEFAULT_SETTINGS = {
  activeLLM: 'local',
  awsAccessKeyId: '',
  awsSecretAccessKey: '',
  awsSessionToken: '',
  awsRegion: 'us-east-1',
}

function canUseStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

function storageGet(key, fallback = '') {
  if (!canUseStorage()) return fallback
  return window.localStorage.getItem(key) || fallback
}

function storageSet(key, value) {
  if (!canUseStorage()) return
  window.localStorage.setItem(key, value)
}

export function getActiveProvider() {
  const v = storageGet(STORAGE_KEYS.activeLLM)
  if (v === 'openai') return 'local'
  if (v === 'aws' || v === 'local') return v
  return 'local'
}

/** Temporarily switch provider and return the previous one */
export function setActiveProvider(provider) {
  const prev = getActiveProvider()
  const normalized = provider === 'openai' ? 'local' : provider
  storageSet(STORAGE_KEYS.activeLLM, normalized)
  return prev
}

/** @deprecated use getActiveProvider */
export function getActiveLLM() {
  return getActiveProvider()
}

export function loadSettings() {
  if (!canUseStorage()) return { ...DEFAULT_SETTINGS }
  return {
    activeLLM: getActiveLLM(),
    awsAccessKeyId: storageGet(STORAGE_KEYS.awsAccessKeyId),
    awsSecretAccessKey: storageGet(STORAGE_KEYS.awsSecretAccessKey),
    awsSessionToken: storageGet(STORAGE_KEYS.awsSessionToken),
    awsRegion: storageGet(STORAGE_KEYS.awsRegion, 'us-east-1'),
  }
}

export function saveSettings({ activeLLM, awsAccessKeyId, awsSecretAccessKey, awsSessionToken, awsRegion }) {
  const provider = activeLLM === 'openai' ? 'local' : ['aws', 'local'].includes(activeLLM) ? activeLLM : 'local'
  storageSet(STORAGE_KEYS.activeLLM, provider)
  storageSet(STORAGE_KEYS.awsAccessKeyId, awsAccessKeyId || '')
  storageSet(STORAGE_KEYS.awsSecretAccessKey, awsSecretAccessKey || '')
  storageSet(STORAGE_KEYS.awsSessionToken, awsSessionToken || '')
  storageSet(STORAGE_KEYS.awsRegion, awsRegion || 'us-east-1')
}

export function getAwsCredentials() {
  if (getActiveProvider() !== 'aws') {
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
  const provider = getActiveProvider()

  if (provider === 'local') return 'local-cv'

  if (provider === 'aws') {
    if (hasAwsCredentials()) return 'aws'
    return 'aws-missing-creds'
  }

  return 'local-cv'
}

export function getModeSummary() {
  const mode = getAnalysisMode()
  const provider = getActiveProvider()
  const labels = {
    'local-cv': 'Free CV — MediaPipe + OpenCV ($0)',
    aws: 'AWS Rekognition (active provider)',
    'aws-missing-creds': 'AWS selected — credentials missing',
  }
  const appLabel = provider === 'local' ? 'Free CV' : 'AWS'
  return { mode, label: labels[mode] || mode, appLabel, activeLLM: provider, activeProvider: provider }
}
