import { computeMetrics, generateLandmarks } from './constants'
import { isDemoMode, getActiveLLM, shouldUseAwsCV, shouldUseMediaPipeCV } from './appMode'
import { hasAwsCredentials, getAwsCredentials, getOpenAIKey } from './settings'
import { analyzeFaceWithAWS, computeMetricsFromAWS, landmarksFromAWS } from './awsRekognition'
import { detectProtocolViolations } from './protocolCheck'
import { analyzeWithMediaPipe } from './mediapipeAnalysis'
import {
  analyzeImageStats,
  computeMetricsFromLandmarks,
  landmarksToOverlay,
} from './opencvMetrics'

function validateCredentials() {
  if (shouldUseAwsCV()) {
    const { accessKeyId, secretAccessKey, sessionToken } = getAwsCredentials()
    if (!accessKeyId || !secretAccessKey) {
      return 'AWS credentials not set. Open Settings → AWS tab and save your keys.'
    }
    if (accessKeyId.startsWith('ASIA') && !sessionToken) {
      return 'AWS session token required for sandbox credentials (ASIA keys). Add it in Settings → AWS tab.'
    }
  }
  return null
}

function failResult(error, activeLLM, cvEngine) {
  return {
    mode: 'real',
    success: false,
    cvEngine,
    activeLLM,
    faceDetails: null,
    landmarks: null,
    metrics: null,
    error,
  }
}

export async function runFaceAnalysis(photo, answers) {
  if (isDemoMode()) {
    const fallback = computeMetrics(answers)
    return {
      mode: 'demo',
      success: true,
      cvEngine: 'mock',
      faceDetails: null,
      landmarks: generateLandmarks(),
      metrics: { ...fallback, source: 'mock' },
      error: null,
    }
  }

  const activeLLM = getActiveLLM()
  const credError = validateCredentials()
  if (credError) {
    return failResult(credError, activeLLM, activeLLM === 'aws' ? 'aws' : 'mediapipe+opencv')
  }

  if (shouldUseAwsCV()) {
    try {
      const faceDetails = await analyzeFaceWithAWS(photo)
      if (!faceDetails) {
        return failResult('No face detected in image.', activeLLM, 'aws')
      }
      return {
        mode: 'real',
        success: true,
        cvEngine: 'aws',
        activeLLM,
        faceDetails,
        landmarks: landmarksFromAWS(faceDetails),
        metrics: computeMetricsFromAWS(faceDetails, answers),
        protocolWarnings: detectProtocolViolations(faceDetails),
        error: null,
      }
    } catch (err) {
      return failResult(err.message || 'AWS Rekognition failed.', activeLLM, 'aws')
    }
  }

  if (shouldUseMediaPipeCV()) {
    try {
      const [mpResult, imageStats] = await Promise.all([
        analyzeWithMediaPipe(photo),
        analyzeImageStats(photo),
      ])

      return {
        mode: 'real',
        success: true,
        cvEngine: 'mediapipe+opencv',
        activeLLM,
        faceDetails: null,
        landmarks: landmarksToOverlay(mpResult.landmarks),
        metrics: computeMetricsFromLandmarks(mpResult.landmarks, answers, imageStats),
        error: null,
      }
    } catch (err) {
      return failResult(err.message || 'MediaPipe analysis failed.', activeLLM, 'mediapipe+opencv')
    }
  }

  return failResult('No active provider configured. Open Settings and select AWS or OpenAI tab.', activeLLM, 'none')
}
