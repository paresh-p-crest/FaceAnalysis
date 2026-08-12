#!/usr/bin/env node
/**
 * Self-check: naso-aural dashed guides use sidecar points only (not hairline fallbacks).
 * Run: node artifacts/myface/scripts/test-naso-aural-guides.js
 */
import assert from 'node:assert/strict'
import {
  guidesCrownPlausible,
  resolveNoseLevelGuidesForDraw,
  storedGuidesUsable,
} from '../components/report/nasoAuralOverlay.js'

// Script-equivalent short midface span (must accept)
assert.ok(guidesCrownPlausible({ x: 0.8, y: 0.237 }, { x: 0.74, y: 0.2615 }))

// Tight head-crop span (~0.30) must accept — matches assessment 94ee774c stored guides
assert.ok(guidesCrownPlausible({ x: 0.80, y: 0.29 }, { x: 0.86, y: 0.586 }))

// Crown lock — reject
assert.ok(!guidesCrownPlausible({ x: 0.5, y: 0.08 }, { x: 0.5, y: 0.18 }))

// Collapsed span — reject
assert.ok(!guidesCrownPlausible({ x: 0.5, y: 0.30 }, { x: 0.5, y: 0.302 }))

// Plausible brow → subnasale — accept
assert.ok(guidesCrownPlausible({ x: 0.55, y: 0.35 }, { x: 0.52, y: 0.48 }))

const crownStored = [
  { y: 10, x1: 40, x2: 70, dashed: true },
  { y: 52, x1: 40, x2: 70, dashed: true },
]
assert.ok(!storedGuidesUsable(crownStored))

const goodStored = [
  { y: 28.97, x1: 38.93, x2: 79.8, dashed: true },
  { y: 58.58, x1: 38.93, x2: 85.91, dashed: true },
]
assert.ok(storedGuidesUsable(goodStored))

// No sidecar + crown-locked stored → no guides
assert.deepEqual(
  resolveNoseLevelGuidesForDraw({
    guideGlabella: undefined,
    guideNoseBottom: undefined,
    storedGuides: crownStored,
    verticalXPct: 75,
  }),
  [],
)

// Sidecar points win
const fromSidecar = resolveNoseLevelGuidesForDraw({
  guideGlabella: { x: 0.797962, y: 0.289708 },
  guideNoseBottom: { x: 0.859084, y: 0.585769 },
  storedGuides: crownStored,
  verticalXPct: 38.93,
})
assert.equal(fromSidecar.length, 2)
assert.ok(Math.abs(fromSidecar[0].y - 28.9708) < 0.01)
assert.ok(Math.abs(fromSidecar[1].y - 58.5769) < 0.01)

// Trusted stored guides when sidecar absent
const fromStored = resolveNoseLevelGuidesForDraw({
  guideGlabella: null,
  guideNoseBottom: null,
  storedGuides: goodStored,
  verticalXPct: 75,
})
assert.equal(fromStored.length, 2)
assert.equal(fromStored[0].y, 28.97)

console.log('test-naso-aural-guides: ok')
