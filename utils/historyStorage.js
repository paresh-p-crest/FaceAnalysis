const STORAGE_KEY = 'aurascan_history'
const MAX_ITEMS = 8
const MAX_STORAGE_BYTES = 2_500_000
const MAX_REPORT_CHARS = 12_000
const HEAVY_KEYS = new Set([
  'imageSrc',
  'overlayImage',
  'annotatedImage',
  'landmarks',
  'symmetryDots',
  'mesh',
  'points',
  'photos',
])

function isImageData(value) {
  return typeof value === 'string' && value.startsWith('data:image')
}

function stripHeavyData(value, key = '') {
  if (isImageData(value)) return undefined
  if (typeof value === 'string') {
    if (key === 'report' && value.length > MAX_REPORT_CHARS) return `${value.slice(0, MAX_REPORT_CHARS)}...`
    return value
  }
  if (!value || typeof value !== 'object') return value
  if (HEAVY_KEYS.has(key)) return undefined
  if (Array.isArray(value)) {
    if (value.length > 150) return undefined
    return value.map((item) => stripHeavyData(item)).filter((item) => item !== undefined)
  }

  return Object.entries(value).reduce((acc, [childKey, childValue]) => {
    const cleaned = stripHeavyData(childValue, childKey)
    if (cleaned !== undefined) acc[childKey] = cleaned
    return acc
  }, {})
}

function compactEntry(entry, strict = false) {
  const isCloudReport = !!entry?.assessmentId || !!entry?.savedToDb
  const base = {
    id: entry.id,
    createdAt: entry.createdAt,
    label: entry.label,
    assessmentId: entry.assessmentId,
    savedToDb: entry.savedToDb,
    reportStatus: entry.reportStatus,
    reportSource: entry.reportSource,
    reportError: entry.reportError,
    cvLabel: entry.cvLabel,
  }

  if (isCloudReport || strict) {
    return {
      ...base,
      answers: strict ? undefined : stripHeavyData(entry.answers),
      analysis: {
        success: entry.analysis?.success,
        savedToDb: entry.analysis?.savedToDb || entry.savedToDb,
        assessmentId: entry.analysis?.assessmentId || entry.assessmentId,
        reportStatus: entry.analysis?.reportStatus || entry.reportStatus,
        cvEngine: entry.analysis?.cvEngine,
        activeProvider: entry.analysis?.activeProvider,
        metrics: strict ? undefined : stripHeavyData(entry.analysis?.metrics),
      },
    }
  }

  return {
    ...base,
    photo: isImageData(entry.photo) ? entry.photo : undefined,
    answers: stripHeavyData(entry.answers),
    analysis: stripHeavyData(entry.analysis),
    eyeAnalysis: stripHeavyData(entry.eyeAnalysis),
    cvReport: stripHeavyData(entry.cvReport),
    report: stripHeavyData(entry.report, 'report'),
    protocolData: stripHeavyData(entry.protocolData),
    aiNarrative: stripHeavyData(entry.aiNarrative),
  }
}

export function loadHistory() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function persist(items) {
  const compacted = items.slice(0, MAX_ITEMS).map((item) => compactEntry(item))
  let payload = JSON.stringify(compacted)
  if (payload.length > MAX_STORAGE_BYTES) {
    payload = JSON.stringify(compacted.slice(0, 3).map((item) => compactEntry(item, true)))
  }

  try {
    localStorage.setItem(STORAGE_KEY, payload)
    return JSON.parse(payload)
  } catch (err) {
    try {
      const minimal = items.slice(0, 3).map((item) => compactEntry(item, true))
      localStorage.setItem(STORAGE_KEY, JSON.stringify(minimal))
      return minimal
    } catch (fallbackErr) {
      console.warn('AuraScan history storage skipped:', fallbackErr)
      return []
    }
  }
}

export function saveHistoryEntry(entry) {
  const items = loadHistory()
  const idx = items.findIndex((i) => i.id === entry.id)
  const next = idx >= 0 ? items.map((i) => (i.id === entry.id ? entry : i)) : [entry, ...items]
  return persist(next)
}

export function deleteAllHistory() {
  localStorage.removeItem(STORAGE_KEY)
  return []
}

export function createHistoryId() {
  return `h_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

export function formatHistoryDate(iso) {
  const d = new Date(iso)
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  })
}
