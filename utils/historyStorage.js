const STORAGE_KEY = 'myface_history'
const MAX_ITEMS = 8
const THUMB_MAX_PX = 160
const THUMB_QUALITY = 0.72

const HEAVY_KEYS = new Set(['imageSrc', 'photos', 'aiVisuals'])

export function loadHistory() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function stripHeavyFields(value) {
  if (Array.isArray(value)) return value.map(stripHeavyFields)
  if (!value || typeof value !== 'object') return value

  const next = {}
  for (const [key, child] of Object.entries(value)) {
    if (HEAVY_KEYS.has(key)) continue
    next[key] = stripHeavyFields(child)
  }
  return next
}

function compactAnalysis(analysis) {
  if (!analysis) return null
  return stripHeavyFields({
    success: analysis.success,
    error: analysis.error,
    metrics: analysis.metrics,
    landmarks: analysis.landmarks,
    cvReport: analysis.cvReport,
    eyeAnalysis: analysis.eyeAnalysis,
    assessmentId: analysis.assessmentId,
    savedToDb: analysis.savedToDb,
    reportStatus: analysis.reportStatus,
    cvEngine: analysis.cvEngine,
    activeProvider: analysis.activeProvider,
    createdAt: analysis.createdAt,
    protocolWarnings: analysis.protocolWarnings,
  })
}

function createThumbnail(dataUrl, maxPx = THUMB_MAX_PX, quality = THUMB_QUALITY) {
  return new Promise((resolve) => {
    if (!dataUrl?.startsWith?.('data:image') || typeof document === 'undefined') {
      resolve(dataUrl || null)
      return
    }
    const img = new Image()
    img.onload = () => {
      const scale = Math.min(1, maxPx / Math.max(img.width, img.height, 1))
      const w = Math.max(1, Math.round(img.width * scale))
      const h = Math.max(1, Math.round(img.height * scale))
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        resolve(null)
        return
      }
      ctx.drawImage(img, 0, 0, w, h)
      try {
        resolve(canvas.toDataURL('image/jpeg', quality))
      } catch {
        resolve(null)
      }
    }
    img.onerror = () => resolve(null)
    img.src = dataUrl
  })
}

async function compactEntry(entry) {
  const cvReport = stripHeavyFields(entry.cvReport ?? entry.analysis?.cvReport)
  const hasCvReport = !!cvReport
  const aiNarrative = entry.aiNarrative
    && typeof entry.aiNarrative === 'object'
    && JSON.stringify(entry.aiNarrative).length < 12_000
    ? entry.aiNarrative
    : undefined

  return {
    id: entry.id,
    createdAt: entry.createdAt,
    photo: await createThumbnail(entry.photo),
    answers: entry.answers,
    analysis: compactAnalysis(entry.analysis),
    eyeAnalysis: entry.eyeAnalysis,
    cvReport,
    report: hasCvReport ? undefined : (entry.report || '').slice(0, 4000) || undefined,
    reportSource: entry.reportSource,
    reportError: entry.reportError,
    cvLabel: entry.cvLabel,
    assessmentId: entry.assessmentId ?? entry.analysis?.assessmentId,
    savedToDb: entry.savedToDb ?? entry.analysis?.savedToDb,
    reportStatus: entry.reportStatus,
    label: entry.label,
    aiNarrative,
  }
}

function persist(items) {
  for (let limit = Math.min(items.length, MAX_ITEMS); limit > 0; limit -= 1) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, limit)))
      if (limit < items.length) {
        console.warn(`[MyFace] History trimmed to ${limit} entries due to browser storage limits.`)
      }
      return items.slice(0, limit)
    } catch (err) {
      if (err?.name !== 'QuotaExceededError') throw err
    }
  }
  console.warn('[MyFace] Could not save analysis history — browser storage is full.')
  return items
}

export async function saveHistoryEntry(entry) {
  const items = loadHistory()
  const idx = items.findIndex((i) => i.id === entry.id)
  const merged = idx >= 0 ? { ...items[idx], ...entry } : entry
  const compact = await compactEntry(merged)
  const next = idx >= 0
    ? items.map((i) => (i.id === entry.id ? compact : i))
    : [compact, ...items]
  persist(next)
  return next
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
