/**
 * Treatment-protocol display only: keep complete sentences, drop a 150-char clamp tail.
 * Does not change stored JSON. Feature page bodies are not filtered here.
 */
export function phaseDetailForDisplay(detail) {
  let t = String(detail || '').replace(/\s+/g, ' ').trim()
  if (!t) return ''
  t = t.replace(/(\.\.\.|…)+$/g, '').trim()
  if (/[.!?]$/.test(t)) return t
  const m = t.match(/^[\s\S]*[.!?]/)
  if (m && m[0].trim().length >= 12) return m[0].trim()
  return ''
}

/** ponytail: node artifacts/myface/utils/phaseDetailDisplay.js */
function selfCheck() {
  const kept = phaseDetailForDisplay(
    'Die Ohren sind ein Schwerpunkt, doch Details fehlen. Sanfte Reinigung ohne eine',
  )
  if (kept !== 'Die Ohren sind ein Schwerpunkt, doch Details fehlen.') {
    throw new Error(`phaseDetailForDisplay: expected complete sentence, got ${JSON.stringify(kept)}`)
  }
  if (phaseDetailForDisplay('Sanfte Reinigung ohne eine') !== '') {
    throw new Error('phaseDetailForDisplay: fragment must be empty')
  }
  if (phaseDetailForDisplay('Täglich · UV-Lichtschutz.') !== 'Täglich · UV-Lichtschutz.') {
    throw new Error('phaseDetailForDisplay: complete detail kept')
  }
}

if (typeof process !== 'undefined' && process.argv[1]?.includes('phaseDetailDisplay')) {
  selfCheck()
  // eslint-disable-next-line no-console
  console.log('phaseDetailDisplay: ok')
}
