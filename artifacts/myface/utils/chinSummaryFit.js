/**
 * Shared leftover-fit helpers for protocol HTML (mirrors reportPdf truncateAtSentences).
 */

const SENTENCE_RE = /.+?[.!?](?:\s+|$)|.+$/g

export function splitSentences(text) {
  const safe = String(text || '').trim()
  if (!safe) return []
  return (safe.match(SENTENCE_RE) || [safe]).map((s) => s.trim()).filter(Boolean)
}

/** Longest prefix of text for which `fits(prefix)` is true. Keeps the start, drops the tail. */
export function longestPrefixThatFits(text, fits) {
  const raw = String(text || '')
  if (!raw) return ''
  if (fits(raw)) return raw
  let lo = 0
  let hi = raw.length
  let best = 0
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (fits(raw.slice(0, mid))) {
      best = mid
      lo = mid + 1
    } else {
      hi = mid - 1
    }
  }
  return raw.slice(0, best).trimEnd()
}

/** Keep whole sentences that fit; if sentence 1 is too long, fall back to prefix. */
export function keepSentencesThatFit(text, fits) {
  const raw = String(text || '').trim()
  if (!raw) return ''
  if (fits(raw)) return raw
  let kept = ''
  for (const sentence of splitSentences(raw)) {
    const candidate = kept ? `${kept} ${sentence}` : sentence
    if (!fits(candidate)) break
    kept = candidate
  }
  return kept || longestPrefixThatFits(raw, fits)
}

/** ponytail: smallest runnable check — node artifacts/myface/utils/chinSummaryFit.js */
export function selfCheckChinSummaryFit() {
  const prefix = longestPrefixThatFits('Keep this opening then drop the tail', (s) => s.length <= 10)
  if (prefix !== 'Keep this') throw new Error('chinSummaryFit self-check: binary prefix keeps the start')
  if (prefix.includes('tail')) throw new Error('chinSummaryFit self-check: binary prefix drops the end')

  const sentences = keepSentencesThatFit('One done. Two done. Three extra.', (s) => s.length <= 22)
  if (sentences !== 'One done. Two done.') throw new Error('chinSummaryFit self-check: keep whole sentences')
}

if (typeof process !== 'undefined' && process.argv[1]?.includes('chinSummaryFit')) {
  selfCheckChinSummaryFit()
}
