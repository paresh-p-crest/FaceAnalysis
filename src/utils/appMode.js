import { getActiveLLM } from './settings'

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

export { getActiveLLM }

export function getAppModeLabel() {
  if (isDemoMode()) return 'Demo (mock)'
  const llm = getActiveLLM()
  return llm === 'aws' ? 'Real · AWS Rekognition' : 'Real · MediaPipe + OpenAI'
}

export function shouldUseAwsCV() {
  return isRealMode() && getActiveLLM() === 'aws'
}

export function shouldUseMediaPipeCV() {
  return isRealMode() && getActiveLLM() === 'openai'
}
