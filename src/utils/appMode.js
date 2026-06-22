import { getActiveLLM } from './settings'

export function isDemoMode() {
  return (import.meta.env.VITE_APP_MODE || 'demo').toLowerCase() !== 'real'
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
