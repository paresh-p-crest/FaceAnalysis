/**
 * Shrink type on one A4 HTML preview sheet when copy overflows the 842px frame.
 * Headings drop slightly faster than body. Images / page chrome stay put.
 * ponytail: binary-search CSS vars; floor 0.72 then clip. Upgrade: drop phase bullets.
 */

export const PAGE_TYPE_FLOOR = 0.72
const OVERFLOW_SLACK_PX = 8
const GROW_SLACK_PX = 8
const SEARCH_STEPS = 8

export function headingScaleFor(typeScale, floor = PAGE_TYPE_FLOOR) {
  const ts = Number(typeScale)
  if (!Number.isFinite(ts) || ts >= 1) return 1
  return Math.round(Math.max(floor, ts * 0.92) * 1000) / 1000
}

export function readPageTypeScale(page) {
  const raw = page?.style?.getPropertyValue('--page-type-scale')
  const n = Number(raw)
  return Number.isFinite(n) && n > 0 ? n : 1
}

export function applyPageTypeScale(page, typeScale, floor = PAGE_TYPE_FLOOR) {
  if (!page?.style) return 1
  const ts = Math.round(Math.max(floor, Math.min(1, Number(typeScale) || 1)) * 1000) / 1000
  if (ts >= 1) {
    page.style.removeProperty('--page-type-scale')
    page.style.removeProperty('--page-heading-scale')
    page.removeAttribute?.('data-page-type-fit')
    return 1
  }
  page.style.setProperty('--page-type-scale', String(ts))
  page.style.setProperty('--page-heading-scale', String(headingScaleFor(ts, floor)))
  page.setAttribute?.('data-page-type-fit', '')
  return ts
}

/**
 * Pixels past the sheet bottom.
 * `overflow: clip` on the A4 sheet makes scrollHeight === clientHeight, so measure
 * with overflow forced visible (inline style beats the stylesheet clip).
 */
export function overflowAmount(page) {
  if (!page) return 0
  const inner = page.querySelector?.('.report-view-a4-inner') || page
  const pageOverflow = page.style.overflow
  const innerOverflow = inner.style.overflow
  page.style.overflow = 'visible'
  inner.style.overflow = 'visible'
  void inner.offsetHeight
  const amount = Math.max(
    page.scrollHeight - page.clientHeight,
    inner.scrollHeight - inner.clientHeight,
  )
  if (pageOverflow) page.style.overflow = pageOverflow
  else page.style.removeProperty('overflow')
  if (innerOverflow) inner.style.overflow = innerOverflow
  else inner.style.removeProperty('overflow')
  return amount
}

function pageOverflows(page, slack = OVERFLOW_SLACK_PX) {
  return overflowAmount(page) > slack
}

function searchScale(page, lo, hi, floor, preferHigh) {
  let best = preferHigh ? lo : hi
  for (let i = 0; i < SEARCH_STEPS; i++) {
    const mid = (lo + hi) / 2
    applyPageTypeScale(page, mid, floor)
    if (pageOverflows(page)) {
      hi = mid
      if (!preferHigh) best = mid
    } else {
      lo = mid
      best = mid
    }
  }
  return applyPageTypeScale(page, best, floor)
}

function isEditingInside(page) {
  const active = typeof document !== 'undefined' ? document.activeElement : null
  if (!active || !page.contains(active)) return false
  return active.isContentEditable
}

/**
 * Fit one `.report-view-a4-page`. Returns the type scale applied (1 = unchanged).
 */
export function fitA4PageType(page, { floor = PAGE_TYPE_FLOOR } = {}) {
  if (!page || page.classList?.contains('report-view-a4-page--cover')) return 1
  if (page.classList?.contains('report-protocol-dashboard-page--web')) return 1
  if (isEditingInside(page)) return readPageTypeScale(page)

  const current = readPageTypeScale(page)
  if (pageOverflows(page)) {
    if (current <= floor + 0.001) {
      applyPageTypeScale(page, floor, floor)
      return floor
    }
    return searchScale(page, floor, current, floor, true)
  }
  if (current < 1 && overflowAmount(page) < -GROW_SLACK_PX) {
    return searchScale(page, current, 1, floor, true)
  }
  applyPageTypeScale(page, current, floor)
  return current
}

export function observeA4PageTypeFit(page) {
  if (!page) return () => {}
  let fitting = false
  let raf = 0
  const run = () => {
    if (fitting || isEditingInside(page)) return
    if (raf) cancelAnimationFrame(raf)
    raf = requestAnimationFrame(() => {
      raf = 0
      if (fitting || isEditingInside(page)) return
      fitting = true
      fitA4PageType(page)
      requestAnimationFrame(() => {
        fitting = false
      })
    })
  }
  fitA4PageType(page)
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(run) : null
  ro?.observe(page)
  page.addEventListener('focusout', run)
  return () => {
    if (raf) cancelAnimationFrame(raf)
    ro?.disconnect()
    page.removeEventListener('focusout', run)
  }
}

/** ponytail: node artifacts/myface/utils/pageTypeFit.js */
function selfCheck() {
  if (headingScaleFor(1) !== 1) throw new Error('pageTypeFit: heading 1 stays 1')
  if (headingScaleFor(0.85) !== 0.782) throw new Error('pageTypeFit: heading 0.85 → 0.782')
  if (headingScaleFor(0.7) !== PAGE_TYPE_FLOOR) throw new Error('pageTypeFit: heading floor')
  const fake = {
    style: {
      _m: {},
      setProperty(k, v) { this._m[k] = v },
      getPropertyValue(k) { return this._m[k] || '' },
      removeProperty(k) { delete this._m[k] },
    },
    setAttribute() {},
    removeAttribute() {},
  }
  applyPageTypeScale(fake, 0.85)
  if (fake.style.getPropertyValue('--page-type-scale') !== '0.85') throw new Error('pageTypeFit: type var')
  if (fake.style.getPropertyValue('--page-heading-scale') !== '0.782') throw new Error('pageTypeFit: heading var')
  applyPageTypeScale(fake, 1)
  if (fake.style.getPropertyValue('--page-type-scale')) throw new Error('pageTypeFit: scale 1 clears vars')
}

if (typeof process !== 'undefined' && process.argv[1]?.includes('pageTypeFit')) {
  selfCheck()
  // eslint-disable-next-line no-console
  console.log('pageTypeFit: ok')
}
