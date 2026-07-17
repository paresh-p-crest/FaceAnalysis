/**
 * Runnable self-check for inline-edit narrative helpers.
 * No framework — run with: node artifacts/myface/utils/protocolSections.selfcheck.mjs
 * Fails loudly (throws) if the upsert clobbers siblings or drops fields.
 */
import assert from 'node:assert/strict'
import { setFeatureSummary, upsertFeatureSubsection } from './protocolSections.js'

// 1) Editing one subsection must NOT create empty siblings (would blank CV defaults via mergeSubsections).
const afterNose = upsertFeatureSubsection({}, 'nose', 'Nose', 'Edited nose body')
assert.equal(afterNose.nose.subsections.length, 1, 'only the edited subsection is written')
assert.deepEqual(afterNose.nose.subsections[0], { title: 'Nose', body: 'Edited nose body' })
assert.equal(afterNose.nose.featureId, 'nose')

// 2) Editing a second subsection preserves the first (sibling not lost).
const afterTwo = upsertFeatureSubsection(afterNose, 'nose', 'Bridge', 'Bridge body')
assert.equal(afterTwo.nose.subsections.length, 2, 'previous subsection preserved')
assert.ok(afterTwo.nose.subsections.some((s) => s.title === 'Nose' && s.body === 'Edited nose body'))
assert.ok(afterTwo.nose.subsections.some((s) => s.title === 'Bridge' && s.body === 'Bridge body'))

// 3) Re-editing an existing subsection updates in place (no duplicate title).
const afterUpdate = upsertFeatureSubsection(afterTwo, 'nose', 'Nose', 'Nose v2')
assert.equal(afterUpdate.nose.subsections.filter((s) => s.title === 'Nose').length, 1, 'no duplicate title')
assert.equal(afterUpdate.nose.subsections.find((s) => s.title === 'Nose').body, 'Nose v2')

// 4) Summary edit keeps existing subsections intact.
const afterSummary = setFeatureSummary(afterUpdate, 'nose', 'New summary')
assert.equal(afterSummary.nose.summary, 'New summary')
assert.equal(afterSummary.nose.subsections.length, 2, 'summary edit preserves subsections')

// 5) Editing one feature does not touch another feature's narrative.
const twoFeatures = upsertFeatureSubsection(afterSummary, 'lips', 'Lips', 'Lip body')
assert.ok(twoFeatures.nose && twoFeatures.lips, 'both features present')
assert.equal(twoFeatures.nose.subsections.length, 2, 'other feature untouched')

// 6) Null/undefined input is safe.
assert.doesNotThrow(() => upsertFeatureSubsection(null, 'eyes', 'Eyes', 'x'))
assert.doesNotThrow(() => setFeatureSummary(undefined, 'eyes', 'x'))

console.log('protocolSections self-check passed')
