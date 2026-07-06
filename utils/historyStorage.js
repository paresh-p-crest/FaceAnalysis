const STORAGE_KEY = 'aurascan_history'
const MAX_ITEMS = 12

export function loadHistory() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function persist(items) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, MAX_ITEMS)))
}

export function saveHistoryEntry(entry) {
  const items = loadHistory()
  const idx = items.findIndex((i) => i.id === entry.id)
  const next = idx >= 0 ? items.map((i) => (i.id === entry.id ? entry : i)) : [entry, ...items]
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
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
