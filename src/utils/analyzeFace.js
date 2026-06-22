import { computeMetrics, generateLandmarks } from './constants'
import { isDemoMode, getActiveProvider, shouldUseAwsCV, shouldUseMediaPipeCV, shouldUseLocalCV } from './appMode'
import { getAwsCredentials } from './settings'
import { analyzeFaceWithAWS, computeMetricsFromAWS, landmarksFromAWS } from './awsRekognition'
import { detectProtocolViolations } from './protocolCheck'
import { analyzeWithMediaPipe } from './mediapipeAnalysis'
import { analyzeEyes, mockEyeAnalysis } from './eyeAnalysis'
import { buildCvReport, mockCvReport } from './cvReport'
import {
  analyzeImageStats,
  computeMetricsFromLandmarks,
  landmarksToOverlay,
} from './opencvMetrics'

function validateCredentials() {
  if (shouldUseLocalCV()) return null
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

function failResult(error, provider, cvEngine) {
  return {
    mode: 'real',
    success: false,
    cvEngine,
    activeLLM: provider,
    activeProvider: provider,
    faceDetails: null,
    landmarks: null,
    metrics: null,
    eyeAnalysis: null,
    cvReport: null,
    error,
  }
}

async function runLocalCvPath(photo, answers) {
  const [mpResult, imageStats] = await Promise.all([
    analyzeWithMediaPipe(photo),
    analyzeImageStats(photo),
  ])

  const metrics = computeMetricsFromLandmarks(mpResult.landmarks, answers, imageStats)
  const [eyeAnalysis, cvReport] = await Promise.all([
    analyzeEyes(mpResult.landmarks, photo),
    buildCvReport(mpResult.landmarks, photo, metrics),
  ])

  return {
    mode: 'real',
    success: true,
    cvEngine: 'local-cv',
    activeLLM: 'local',
    activeProvider: 'local',
    faceDetails: null,
    landmarks: landmarksToOverlay(mpResult.landmarks),
    metrics,
    eyeAnalysis,
    cvReport,
    error: null,
  }
}

async function runMediaPipePath(photo, answers) {
  const [mpResult, imageStats] = await Promise.all([
    analyzeWithMediaPipe(photo),
    analyzeImageStats(photo),
  ])

  return {
    mode: 'real',
    success: true,
    cvEngine: 'mediapipe+opencv',
    activeLLM: 'openai',
    activeProvider: 'openai',
    faceDetails: null,
    landmarks: landmarksToOverlay(mpResult.landmarks),
    metrics: computeMetricsFromLandmarks(mpResult.landmarks, answers, imageStats),
    eyeAnalysis: null,
    cvReport: null,
    error: null,
  }
}

export async function runFaceAnalysis(photo, answers) {
  if (isDemoMode()) {
    const fallback = computeMetrics(answers)
    const metrics = { ...fallback, source: 'mock' }
    return {
      mode: 'demo',
      success: true,
      cvEngine: 'mock',
      activeProvider: 'local',
      faceDetails: null,
      landmarks: generateLandmarks(),
      metrics,
      eyeAnalysis: mockEyeAnalysis(photo),
      cvReport: mockCvReport(photo, metrics),
      error: null,
    }
  }

  const provider = getActiveProvider()
  const credError = validateCredentials()
  if (credError) {
    return failResult(credError, provider, provider === 'aws' ? 'aws' : 'mediapipe+opencv')
  }

  if (shouldUseAwsCV()) {
    try {
      const faceDetails = await analyzeFaceWithAWS(photo)
      if (!faceDetails) {
        return failResult('No face detected in image.', provider, 'aws')
      }
      return {
        mode: 'real',
        success: true,
        cvEngine: 'aws',
        activeLLM: provider,
        activeProvider: provider,
        faceDetails,
        landmarks: landmarksFromAWS(faceDetails),
        metrics: computeMetricsFromAWS(faceDetails, answers),
        eyeAnalysis: null,
        protocolWarnings: detectProtocolViolations(faceDetails),
        error: null,
      }
    } catch (err) {
      return failResult(err.message || 'AWS Rekognition failed.', provider, 'aws')
    }
  }

  if (shouldUseLocalCV()) {
    try {
      return await runLocalCvPath(photo, answers)
    } catch (err) {
      return failResult(err.message || 'MediaPipe analysis failed.', provider, 'local-cv')
    }
  }

  if (shouldUseMediaPipeCV()) {
    try {
      return await runMediaPipePath(photo, answers)
    } catch (err) {
      return failResult(err.message || 'MediaPipe analysis failed.', provider, 'mediapipe+opencv')
    }
  }

  return failResult('No active provider configured. Open Settings and select a provider tab.', provider, 'none')
}
