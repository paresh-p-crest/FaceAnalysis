import { getActiveProvider } from './settings'

export { getActiveProvider, getActiveProvider as getActiveLLM }

export function shouldUseAwsCV() {
  return getActiveProvider() === 'aws'
}

export function shouldUseMediaPipeCV() {
  return getActiveProvider() === 'openai'
}

export function shouldUseLocalCV() {
  return getActiveProvider() === 'local'
}
