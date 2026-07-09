const STORAGE_KEYS = {
  activeLLM: 'myface_active_llm',
  openai: 'myface_openai_key',
  awsAccessKeyId: 'myface_aws_access_key_id',
  awsSecretAccessKey: 'myface_aws_secret_access_key',
  awsSessionToken: 'myface_aws_session_token',
  awsRegion: 'myface_aws_region',
}

export function getActiveProvider() {
  const v = localStorage.getItem(STORAGE_KEYS.activeLLM)
  if (v === 'openai' || v === 'aws' || v === 'local') return v
  return 'local'
}

/** Temporarily switch provider and return the previous one */
export function setActiveProvider(provider) {
  const prev = getActiveProvider()
  localStorage.setItem(STORAGE_KEYS.activeLLM, provider)
  return prev
}

/** @deprecated use getActiveProvider */
export function getActiveLLM() {
  return getActiveProvider()
}

export function loadSettings() {
  return {
    activeLLM: getActiveLLM(),
    openaiKey: localStorage.getItem(STORAGE_KEYS.openai) || '',
    awsAccessKeyId: localStorage.getItem(STORAGE_KEYS.awsAccessKeyId) || '',
    awsSecretAccessKey: localStorage.getItem(STORAGE_KEYS.awsSecretAccessKey) || '',
    awsSessionToken: localStorage.getItem(STORAGE_KEYS.awsSessionToken) || '',
    awsRegion: localStorage.getItem(STORAGE_KEYS.awsRegion) || 'us-east-1',
  }
}

export function saveSettings({ activeLLM, openaiKey, awsAccessKeyId, awsSecretAccessKey, awsSessionToken, awsRegion }) {
  const provider = ['aws', 'openai', 'local'].includes(activeLLM) ? activeLLM : 'local'
  localStorage.setItem(STORAGE_KEYS.activeLLM, provider)
  localStorage.setItem(STORAGE_KEYS.openai, openaiKey || '')
  localStorage.setItem(STORAGE_KEYS.awsAccessKeyId, awsAccessKeyId || '')
  localStorage.setItem(STORAGE_KEYS.awsSecretAccessKey, awsSecretAccessKey || '')
  localStorage.setItem(STORAGE_KEYS.awsSessionToken, awsSessionToken || '')
  localStorage.setItem(STORAGE_KEYS.awsRegion, awsRegion || 'us-east-1')
}

export function getOpenAIKey() {
  if (getActiveProvider() !== 'openai') return ''
  return localStorage.getItem(STORAGE_KEYS.openai)?.trim() || ''
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

  if (!getOpenAIKey()) return 'openai-missing-key'
  return 'mediapipe+openai'
}

export function getModeSummary() {
  const mode = getAnalysisMode()
  const provider = getActiveProvider()
  const labels = {
    'local-cv': 'Free CV — MediaPipe + OpenCV ($0)',
    aws: 'AWS Rekognition (active provider)',
    'aws-missing-creds': 'AWS selected — credentials missing',
    'mediapipe+openai': 'MediaPipe + OpenAI (active provider)',
    'openai-missing-key': 'OpenAI API key missing',
  }
  const appLabel = provider === 'local'
    ? 'Free CV'
    : provider === 'aws'
      ? 'AWS'
      : 'OpenAI'
  return { mode, label: labels[mode] || mode, appLabel, activeLLM: provider, activeProvider: provider }
}
