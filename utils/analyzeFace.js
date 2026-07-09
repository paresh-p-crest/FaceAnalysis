import { getActiveProvider, shouldUseAwsCV, shouldUseMediaPipeCV, shouldUseLocalCV } from './appMode'
import { getAwsCredentials } from './settings'
import { isBackendApiEnabled, runFaceAnalysisViaBackend } from './apiClient'
import { analyzeFaceWithAWS } from './awsRekognition'
import { detectProtocolViolations } from './protocolCheck'
import { analyzeWithMediaPipe } from './mediapipeAnalysis'
import { analyzeEyes } from './eyeAnalysis'
import { buildCvReport } from './cvReport'
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

async function runLocalCvPath(photo, answers, photos) {
  const [mpResult, imageStats] = await Promise.all([
    analyzeWithMediaPipe(photo),
    analyzeImageStats(photo),
  ])

  const metrics = computeMetricsFromLandmarks(mpResult.landmarks, answers, imageStats)
  const [eyeAnalysis, cvReport] = await Promise.all([
    analyzeEyes(mpResult.landmarks, photo),
    buildCvReport(mpResult.landmarks, photo, metrics, photos, answers),
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

export async function runFaceAnalysis(photo, answers, photos = {}, scanId = null) {
  const provider = getActiveProvider()

  if (isBackendApiEnabled()) {
    try {
      return await runFaceAnalysisViaBackend(photo, answers, photos, provider, scanId)
    } catch (err) {
      return failResult(err.message || 'Backend analysis failed.', provider, 'backend')
    }
  }

  const credError = validateCredentials()
  if (credError) {
    return failResult(credError, provider, provider === 'aws' ? 'aws' : 'mediapipe+opencv')
  }

  if (shouldUseAwsCV()) {
    try {
      // Run Rekognition for face details + MediaPipe for landmarks & structured report
      const [faceDetails, mpResult, imageStats] = await Promise.all([
        analyzeFaceWithAWS(photo),
        analyzeWithMediaPipe(photo),
        analyzeImageStats(photo),
      ])

      const metrics = computeMetricsFromLandmarks(mpResult.landmarks, answers, imageStats)
      const [eyeAnalysis, cvReport] = await Promise.all([
        analyzeEyes(mpResult.landmarks, photo),
        buildCvReport(mpResult.landmarks, photo, metrics, photos, answers),
      ])

      return {
        mode: 'real',
        success: true,
        cvEngine: 'aws',
        activeLLM: provider,
        activeProvider: provider,
        faceDetails,
        landmarks: landmarksToOverlay(mpResult.landmarks),
        metrics,
        eyeAnalysis,
        cvReport,
        protocolWarnings: detectProtocolViolations(faceDetails),
        error: null,
      }
    } catch (err) {
      return failResult(err.message || 'AWS Rekognition failed.', provider, 'aws')
    }
  }

  if (shouldUseLocalCV()) {
    try {
      return await runLocalCvPath(photo, answers, photos)
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
