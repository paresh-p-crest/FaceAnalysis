/**
 * Single prose block for interactive feature panels.
 * Prefer protocol/LLM narrative; else one CV explanation; else pending.
 */

export function resolveFeatureNarrative(featureNarratives, protocolNarrative, featureId) {
  const fromCanon = featureNarratives?.[featureId]
  if (fromCanon?.summary || fromCanon?.subsections?.length) return fromCanon
  const fromCompat = protocolNarrative?.features?.[featureId]
  if (fromCompat?.summary || fromCompat?.subsections?.length) return fromCompat
  return null
}

/** Eyebrows tab reuses the eyes protocol subsection titled "Eyebrows". */
export function resolveEyebrowsNarrative(featureNarratives, protocolNarrative) {
  const eyes = resolveFeatureNarrative(featureNarratives, protocolNarrative, 'eyes')
  if (!eyes) return null
  const sub = (eyes.subsections || []).find(
    (s) => typeof s?.title === 'string' && s.title.toLowerCase() === 'eyebrows',
  )
  if (!sub?.body) return null
  return {
    summary: sub.body,
    subsections: [],
  }
}

/** Eyes interactive panel: omit the Eyebrows subsection (shown on its own nav tab). */
export function eyesNarrativeWithoutBrows(narrative) {
  if (!narrative) return null
  const subsections = (narrative.subsections || []).filter(
    (s) => typeof s?.title !== 'string' || s.title.toLowerCase() !== 'eyebrows',
  )
  if (!narrative.summary?.trim() && !subsections.some((s) => s?.body)) return null
  return { ...narrative, subsections }
}

export function FeatureProseBlock({
  narrative = null,
  fallbackExplanation = '',
  label = 'Analysis',
}) {
  const hasNarrative =
    (typeof narrative?.summary === 'string' && narrative.summary.trim())
    || (Array.isArray(narrative?.subsections) && narrative.subsections.some((s) => s?.body))

  return (
    <div className="rounded-2xl border border-surface-border bg-surface-warm dark:bg-surface-raised p-4">
      <p className="qoves-report-mono-label mb-2">{label}</p>
      {hasNarrative ? (
        <div className="space-y-3">
          {narrative.summary?.trim() ? (
            <p className="text-sm text-ink-secondary leading-relaxed font-sans">{narrative.summary}</p>
          ) : null}
          {(narrative.subsections || [])
            .filter((s) => s?.body)
            .map((s) => (
              <div key={s.title || s.body.slice(0, 24)}>
                {s.title ? (
                  <p className="text-xs font-medium uppercase tracking-wider text-ink-muted mb-1">
                    {s.title}
                  </p>
                ) : null}
                <p className="text-sm text-ink-secondary leading-relaxed font-sans">{s.body}</p>
              </div>
            ))}
        </div>
      ) : fallbackExplanation?.trim() ? (
        <p className="text-sm text-ink-secondary leading-relaxed font-sans">{fallbackExplanation}</p>
      ) : (
        <p className="text-sm text-ink-muted leading-relaxed font-sans">
          Narrative pending for this feature.
        </p>
      )}
    </div>
  )
}
