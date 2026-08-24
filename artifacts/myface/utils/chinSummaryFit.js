/**
 * Chin summary bar display + wrap/ellipsis fit (PDF + admin HTML preview).
 * Display text: full summary when len <= 160, else first sentence only.
 */

export const CHIN_SUMMARY_CHAR_THRESHOLD = 160

export const CHIN_SUMMARY_BAR_LAYOUT = {
  bodyTop: 16,
  bottomPad: 12,
  lineH: 12,
}

/** Compact bar height for n wrapped body lines (matches jsPDF drawSummaryBar fitRemaining). */
export function chinBarHeight(lineCount) {
  const { bodyTop, bottomPad, lineH } = CHIN_SUMMARY_BAR_LAYOUT
  return bodyTop + Math.max(lineCount, 1) * lineH + bottomPad
}

/** Body line count that fits in a vertical budget. */
export function chinLinesThatFit(heightBudget) {
  const { bodyTop, bottomPad, lineH } = CHIN_SUMMARY_BAR_LAYOUT
  return Math.max(1, Math.floor((heightBudget - bodyTop - bottomPad) / lineH))
}

const SENTENCE_RE = /.+?[.!?](?:\s+|$)|.+$/g

export function splitSentences(text) {
  const safe = String(text || '').trim()
  if (!safe) return []
  return (safe.match(SENTENCE_RE) || [safe]).map((s) => s.trim()).filter(Boolean)
}

/** Pick the string the chin summary bar should try to show before height clipping. */
export function pickChinSummaryDisplayText(summary) {
  const safe = String(summary || '').trim()
  if (!safe) return ''
  if (safe.length <= CHIN_SUMMARY_CHAR_THRESHOLD) return safe
  return splitSentences(safe)[0] || safe
}

function ellipsisLastLine(lines, maxLines, maxWidth, measureWidth) {
  const shown = lines.slice(0, Math.max(1, maxLines))
  if (lines.length <= maxLines || !shown.length) return shown

  let last = shown[shown.length - 1]
  while (last.length > 1 && measureWidth(`${last}…`) > maxWidth) {
    last = last.slice(0, -1)
  }
  shown[shown.length - 1] = last.length > 3 ? `${last.slice(0, Math.max(0, last.length - 1))}…` : `${last}…`
  return shown
}

/**
 * Wrap + clip summary copy for a fixed width and max line count.
 * @param {object} opts
 * @param {string} opts.summary - stored summary (may exceed 160 chars)
 * @param {number} opts.maxWidth - body column width in px/pt
 * @param {number} opts.maxLines - lines that fit in leftover bar height
 * @param {(text: string, maxWidth: number) => string[]} opts.lineBreaks
 * @param {(text: string) => number} [opts.measureWidth] - defaults to last line width
 */
export function fitChinSummaryLines({
  summary,
  maxWidth,
  maxLines,
  lineBreaks,
  measureWidth,
}) {
  const raw = String(summary || '').trim()
  if (!raw) return { displayText: '', lines: [], clipped: false, fittedText: '', keptText: '' }

  const displayText = pickChinSummaryDisplayText(raw)
  const maxLineCount = Math.max(1, maxLines)
  const measure = measureWidth || ((text) => {
    const lines = lineBreaks(text, maxWidth)
    return lines.length ? lines[lines.length - 1].length * 4.5 : 0
  })

  const wrap = (text) => lineBreaks(text, maxWidth)

  if (raw.length <= CHIN_SUMMARY_CHAR_THRESHOLD) {
    const allLines = wrap(displayText)
    if (allLines.length <= maxLineCount) {
      return {
        displayText,
        lines: allLines,
        clipped: false,
        fittedText: allLines.join('\n'),
        keptText: keptTextFromLines(allLines),
      }
    }

    let kept = ''
    for (const sentence of splitSentences(displayText)) {
      const candidate = kept ? `${kept} ${sentence}`.trim() : sentence
      if (wrap(candidate).length > maxLineCount) break
      kept = candidate
    }
    if (kept) {
      const lines = wrap(kept)
      const clipped = kept.length < displayText.length
      return {
        displayText: kept,
        lines,
        clipped,
        fittedText: lines.join('\n'),
        keptText: kept,
      }
    }

    const lines = ellipsisLastLine(wrap(displayText), maxLineCount, maxWidth, measure)
    return {
      displayText,
      lines,
      clipped: true,
      fittedText: lines.join('\n'),
      keptText: keptTextFromLines(lines),
    }
  }

  const allLines = wrap(displayText)
  if (allLines.length <= maxLineCount) {
    return {
      displayText,
      lines: allLines,
      clipped: false,
      fittedText: allLines.join('\n'),
      keptText: keptTextFromLines(allLines),
    }
  }

  const lines = ellipsisLastLine(allLines, maxLineCount, maxWidth, measure)
  return { displayText, lines, clipped: true, fittedText: lines.join('\n'), keptText: keptTextFromLines(lines) }
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

/** Plain summary to persist after HTML preview prune (no ellipsis, single-line spaces). */
export function keptTextFromLines(lines) {
  if (!lines?.length) return ''
  return lines
    .map((line) => String(line).replace(/…\s*$/, ''))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Split a token that is wider than maxWidth so CSS wrap cannot hide the start. */
function splitWideToken(token, maxWidth, ctx) {
  if (!token) return []
  if (ctx.measureText(token).width <= maxWidth) return [token]
  const chunks = []
  let chunk = ''
  for (const ch of token) {
    const next = chunk + ch
    if (chunk && ctx.measureText(next).width > maxWidth) {
      chunks.push(chunk)
      chunk = ch
    } else {
      chunk = next
    }
  }
  if (chunk) chunks.push(chunk)
  return chunks
}

/** Canvas/word-wrap fallback for HTML preview when jsPDF is unavailable. */
export function canvasLineBreaks(text, maxWidth, ctx) {
  const safe = String(text || '').trim()
  if (!safe) return []
  const lines = []
  let line = ''
  const flush = () => {
    if (line) lines.push(line)
    line = ''
  }
  for (const word of safe.split(/\s+/)) {
    const candidate = line ? `${line} ${word}` : word
    if (ctx.measureText(candidate).width <= maxWidth) {
      line = candidate
      continue
    }
    flush()
    for (const piece of splitWideToken(word, maxWidth, ctx)) {
      if (line && ctx.measureText(line + piece).width > maxWidth) flush()
      line = line ? line + piece : piece
    }
  }
  flush()
  return lines
}

/** ponytail: smallest runnable check — node artifacts/myface/utils/chinSummaryFit.js */
export function selfCheckChinSummaryFit() {
  const lineBreaks = (text, maxW) => {
    const out = []
    let rest = text
    while (rest.length > maxW) {
      out.push(rest.slice(0, maxW))
      rest = rest.slice(maxW)
    }
    if (rest) out.push(rest)
    return out
  }
  const measure = (t) => t.length

  const long =
    'This first sentence is intentionally longer than one hundred sixty characters so generation keeps it whole and the bar should show only this sentence with an ellipsis when height is tight.'
  const short = 'Short chin copy. Second sentence drops when space is tight.'

  assert(pickChinSummaryDisplayText(long).endsWith('tight.'), 'long → first sentence')
  assert(pickChinSummaryDisplayText(short) === short, 'short → full')

  const clipped = fitChinSummaryLines({
    summary: long,
    maxWidth: 40,
    maxLines: 2,
    lineBreaks,
    measureWidth: measure,
  })
  assert(clipped.clipped, 'long sentence ellipsizes when over maxLines')
  assert(clipped.lines.length <= 2, 'respects maxLines')

  const sentences = fitChinSummaryLines({
    summary: short,
    maxWidth: 30,
    maxLines: 1,
    lineBreaks,
    measureWidth: measure,
  })
  assert(!sentences.fittedText.includes('Second sentence'), 'keeps first sentence within cap')

  const head = 'Keep this opening. Drop the tail of this paragraph when the box is full.'
  const fromEnd = fitChinSummaryLines({
    summary: head,
    maxWidth: 12,
    maxLines: 2,
    lineBreaks,
    measureWidth: measure,
  })
  assert(fromEnd.fittedText.startsWith('Keep this'), 'clip extra from the end, keep the start')
  assert(!fromEnd.fittedText.includes('when the box is full'), 'does not keep only the tail')

  const ctx = { measureText: (t) => ({ width: String(t).length }) }
  const zzz = `KeepStart${'z'.repeat(80)}`
  const zFit = fitChinSummaryLines({
    summary: zzz,
    maxWidth: 12,
    maxLines: 2,
    lineBreaks: (text, w) => canvasLineBreaks(text, w, ctx),
    measureWidth: (t) => String(t).length,
  })
  assert(zFit.fittedText.startsWith('KeepStart'), 'unbroken zzz overflow keeps the start')
  assert(zFit.lines.length <= 2, 'unbroken zzz respects maxLines')

  const prefix = longestPrefixThatFits('Keep this opening then drop the tail', (s) => s.length <= 10)
  assert(prefix === 'Keep this', 'binary prefix keeps the start')
  assert(!prefix.includes('tail'), 'binary prefix drops the end')
}

function assert(cond, msg) {
  if (!cond) throw new Error(`chinSummaryFit self-check: ${msg}`)
}

if (typeof process !== 'undefined' && process.argv[1]?.includes('chinSummaryFit')) {
  selfCheckChinSummaryFit()
}
