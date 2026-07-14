/** Resolve SegFormer parsing crops + metrics for interactive Features Analysis. */

function humanizeMetricKey(key) {
  return String(key)
    .replace(/_mm$/, ' (est. mm)')
    .replace(/_deg$/, ' (°)')
    .replace(/_ratio$/, '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

function formatMetricValue(metric) {
  if (!metric || metric.value == null) return '—'
  const v = metric.value
  if (metric.unit === 'deg') return `${Number(v).toFixed(1)}°`
  if (metric.unit === 'mm') return `${Number(v).toFixed(2)} mm`
  if (metric.unit === 'ratio') return Number(v).toFixed(3)
  return String(v)
}

export function resolveFeatureHero(featureId, cvSection, featureParsing) {
  const parsingCrop = featureParsing?.crops?.[featureId]?.publicUrl
  if (parsingCrop && featureParsing?.status === 'ready') return parsingCrop
  if (cvSection?.crop) return cvSection.crop
  return cvSection?.imageSrc || null
}

export function parsingMetricsToCards(featureId, featureParsing) {
  const metrics = featureParsing?.metrics?.[featureId]
  if (!metrics || featureParsing?.status !== 'ready') return []
  return Object.entries(metrics).map(([key, metric]) => ({
    label: humanizeMetricKey(key),
    value: formatMetricValue(metric),
    tooltip: metric.scale === 'assumed_ipd_63.5'
      ? 'Estimated scale from assumed 63.5mm interpupillary distance — not clinical measurement.'
      : undefined,
  }))
}

export function mergeMetricSections(baseSections, featureId, featureParsing) {
  const extra = parsingMetricsToCards(featureId, featureParsing)
  if (!extra.length) return baseSections
  const sections = Array.isArray(baseSections) ? [...baseSections] : []
  if (sections.length === 0) {
    return [{ title: 'Parsing metrics', metrics: extra }]
  }
  const first = { ...sections[0], metrics: [...(sections[0].metrics || []), ...extra] }
  sections[0] = first
  return sections
}
