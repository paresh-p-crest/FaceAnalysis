export const STAGES = {
  LANDING: 'landing',
  QUESTIONNAIRE: 'questionnaire',
  PROTOCOL: 'protocol',
  UPLOAD: 'upload',
  SCANNING: 'scanning',
  REPORT: 'report',
  HISTORY: 'history',
}

export const DEMO_PHOTO_URL =
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=600&h=750&fit=crop&crop=face'

export const PHOTO_POSES = [
  { id: 'front', label: 'Front Face', required: true, hint: 'Entire face head-on with a neutral expression' },
  { id: 'profile', label: 'Side Profile', required: false, hint: 'Right side profile (optional)' },
]

export const SCAN_MESSAGES = [
  'Locating 468 facial landmark points…',
  'Mapping facial thirds & fifths…',
  'Calculating symmetry indices…',
  'Assessing jawline & chin geometry…',
  'Evaluating periorbital structure…',
  'Cross-referencing demographic norms…',
  'Generating personalized protocol…',
]

export const INITIAL_ANSWERS = {
  goals: [],
  skinConcerns: [],
  concernSeverity: '',
  occupation: '',
  smoking: '',
  medicalConditions: [],
  ageRange: '',
  gender: '',
}

// Deterministic pseudo-metrics from answers (demo realism)
export function computeMetrics(answers) {
  const seed =
    (answers.goals?.length || 0) * 17 +
    (answers.skinConcerns?.length || 0) * 23 +
    (answers.concernSeverity === 'severe' ? 5 : answers.concernSeverity === 'significant' ? 11 : 29) +
    (answers.smoking === 'daily' ? 3 : answers.smoking === 'regularly' ? 7 : 11) +
    (answers.medicalConditions?.filter((m) => m !== 'none').length || 0) * 5 +
    (answers.ageRange === '55+' ? 3 : answers.ageRange === '45-54' ? 7 : 13) +
    (answers.gender === 'male' ? 7 : answers.gender === 'female' ? 13 : 19)

  const base = 78 + (seed % 15)
  return {
    symmetry: (base + 8.4 + (seed % 7)).toFixed(1),
    proportionality: (base + 3.2 + (seed % 5)).toFixed(1),
    averageness: (72 + (seed % 18)).toFixed(1),
    jawlineAngle: (118 + (seed % 12)).toFixed(0),
    eyebrowTilt: (3.2 + (seed % 30) / 10).toFixed(1),
    nasalAngle: (96 + (seed % 14)).toFixed(0),
    canthalTilt: (4.5 + (seed % 20) / 10).toFixed(1),
    upperThird: (0.31 + (seed % 4) / 100).toFixed(2),
    middleThird: (0.36 + (seed % 5) / 100).toFixed(2),
    lowerThird: (0.33 - (seed % 4) / 100).toFixed(2),
    visualAge: 26 + (seed % 8),
    harmonyScore: (base + 5).toFixed(0),
  }
}

// Grid of landmark dots (normalized 0-1 positions approximating face mesh)
export function generateLandmarks(count = 48) {
  const points = []
  const cx = 0.5
  const cy = 0.42

  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2
    const rx = 0.22 + Math.sin(i * 0.7) * 0.04
    const ry = 0.28 + Math.cos(i * 0.5) * 0.05
    points.push({
      id: i,
      x: cx + Math.cos(angle) * rx * (0.6 + (i % 5) * 0.08),
      y: cy + Math.sin(angle) * ry * (0.8 + (i % 3) * 0.06),
    })
  }

  // Inner feature clusters
  const features = [
    [0.38, 0.35], [0.62, 0.35], // eyes
    [0.5, 0.48], // nose
    [0.44, 0.58], [0.56, 0.58], // mouth
    [0.35, 0.28], [0.65, 0.28], // brows
    [0.5, 0.72], // chin
  ]
  features.forEach(([x, y], i) => {
    for (let j = 0; j < 4; j++) {
      points.push({
        id: count + i * 4 + j,
        x: x + (Math.random() - 0.5) * 0.04,
        y: y + (Math.random() - 0.5) * 0.03,
      })
    }
  })

  return points
}
