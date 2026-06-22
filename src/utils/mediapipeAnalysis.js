import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision'

let landmarker = null

async function getLandmarker() {
  if (landmarker) return landmarker

  const vision = await FilesetResolver.forVisionTasks(
    'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm'
  )

  landmarker = await FaceLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath:
        'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
      delegate: 'GPU',
    },
    runningMode: 'IMAGE',
    numFaces: 1,
    outputFaceBlendshapes: false,
    outputFacialTransformationMatrixes: false,
  })

  return landmarker
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

export async function analyzeWithMediaPipe(imageSrc) {
  const detector = await getLandmarker()
  const image = await loadImage(imageSrc)
  const result = detector.detect(image)

  const landmarks = result.faceLandmarks?.[0] || null
  if (!landmarks) {
    throw new Error('No face detected by MediaPipe')
  }

  return { landmarks, faceCount: result.faceLandmarks.length }
}
