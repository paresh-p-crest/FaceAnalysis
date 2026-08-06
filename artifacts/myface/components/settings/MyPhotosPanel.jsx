'use client'

import { useEffect, useMemo, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Download, Loader2 } from 'lucide-react'
import { fetchMyPhotoCatalog, getApiBaseUrl, mediaUrl } from '../../utils/apiClient'
import { getAuthToken } from '../../utils/authClient'

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '—'
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB']
  let value = bytes
  let unit = 'B'
  for (let i = 0; i < units.length && value >= 1024; i += 1) {
    value /= 1024
    unit = units[i]
  }
  const digits = value >= 100 ? 0 : value >= 10 ? 1 : 2
  return `${value.toFixed(digits)} ${unit}`
}

async function downloadPhoto(entry) {
  const res = await fetch(entry.url, { headers: { Authorization: `Bearer ${getAuthToken()}` } })
  if (!res.ok) throw new Error(String(res.status))
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `MyFace-${entry.poseId}-${entry.assessmentId}.${entry.format}`
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

export function MyPhotosPanel() {
  const t = useTranslations('Settings')
  const tCommon = useTranslations('Common')
  const tPhoto = useTranslations('Photo')
  const locale = useLocale()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [downloading, setDownloading] = useState(null)

  useEffect(() => {
    let cancelled = false
    fetchMyPhotoCatalog({ limit: 20 })
      .then((photos) => {
        if (!cancelled) setItems(photos)
      })
      .catch(() => {
        if (!cancelled) setError(t('photosError'))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [t])

  const groups = useMemo(() => {
    const map = new Map()
    items.forEach((entry) => {
      const date = new Date(entry.date || Date.now())
      const key = Number.isFinite(date.getTime()) ? date.toISOString().slice(0, 10) : 'unknown'
      if (!map.has(key)) map.set(key, { date, entries: [] })
      map.get(key).entries.push(entry)
    })
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]))
  }, [items])

  const handleDownload = async (entry) => {
    if (downloading) return
    setDownloading(entry.assessmentId + entry.poseId)
    try {
      await downloadPhoto(entry)
    } catch {
      setError(t('photosError'))
    } finally {
      setDownloading(null)
    }
  }

  const dateLabel = (date) =>
    date.toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' })

  let content
  if (loading) {
    content = (
      <div className="flex items-center justify-center py-16 text-ink-muted">
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        <span>{tCommon('loading')}</span>
      </div>
    )
  } else if (error) {
    content = <p className="text-sm text-red-600 py-10">{error}</p>
  } else if (!items.length) {
    content = <p className="text-sm text-ink-muted py-10">{t('photosEmpty')}</p>
  } else {
    content = (
      <div className="space-y-10">
        {groups.map(([key, group]) => (
          <section key={key}>
            <div className="flex items-center gap-3 mb-3">
              <h2 className="text-sm font-semibold text-ink">{dateLabel(group.date)}</h2>
              <span className="h-px flex-1 bg-surface-border" />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {group.entries.map((entry) => (
                <div key={entry.assessmentId + entry.poseId} className="group relative">
                  <div className="relative aspect-[3/4] rounded-xl border border-surface-border overflow-hidden bg-surface-raised">
                    <img
                      src={mediaUrl(entry.url)}
                      alt={tPhoto(`validation.expectedPose.${entry.poseId}`)}
                      loading="lazy"
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => handleDownload(entry)}
                      disabled={!!downloading}
                      aria-label={t('download')}
                      className="absolute bottom-2 right-2 w-8 h-8 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 transition-colors disabled:opacity-50"
                    >
                      {downloading === entry.assessmentId + entry.poseId ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Download className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                  <p className="mt-2 text-sm font-semibold text-ink">
                    {tPhoto(`validation.expectedPose.${entry.poseId}`)}
                  </p>
                  <p className="text-xs text-ink-muted">{entry.format.toUpperCase()} • {formatBytes(entry.sizeBytes)}</p>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    )
  }

  return content
}
