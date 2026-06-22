import { getActiveProvider } from './settings'

const APP_MODE_KEY = 'aurascan_app_mode'

export function getAppMode() {
  return localStorage.getItem(APP_MODE_KEY) === 'real' ? 'real' : 'demo'
}

export function setAppMode(mode) {
  localStorage.setItem(APP_MODE_KEY, mode === 'real' ? 'real' : 'demo')
}

export function isDemoMode() {
  return getAppMode() !== 'real'
}

export function isRealMode() {
  return !isDemoMode()
}

export { getActiveProvider, getActiveProvider as getActiveLLM }

export function getAppModeLabel() {
  if (isDemoMode()) return 'Demo (mock)'
  const p = getActiveProvider()
  if (p === 'local') return 'Real · Free CV (MediaPipe)'
  if (p === 'aws') return 'Real · AWS Rekognition'
  return 'Real · MediaPipe + OpenAI'
}

export function shouldUseAwsCV() {
  return isRealMode() && getActiveProvider() === 'aws'
}

export function shouldUseMediaPipeCV() {
  return isRealMode() && getActiveProvider() === 'openai'
}

export function shouldUseLocalCV() {
  return isRealMode() && getActiveProvider() === 'local'
}
