#!/usr/bin/env node
/**
 * Self-check: ears hero URL prefers primary then SegFormer suffix.
 * Mirrors resolveEarsParsingUrl in featureParsing.js (no Next import graph).
 * Run: node artifacts/myface/scripts/test-ear-hero-fallback.js
 */
import assert from 'node:assert/strict'

function resolveEarsParsingUrl(featureParsing) {
  if (featureParsing?.status !== 'ready') return null
  return (
    featureParsing?.crops?.earsLeft?.publicUrl ||
    featureParsing?.crops?.ears?.leftPublicUrl ||
    featureParsing?.crops?.ears?.publicUrl ||
    featureParsing?.crops?.earsLeftSegformer?.publicUrl ||
    featureParsing?.crops?.ears?.leftSegformerPublicUrl ||
    null
  )
}

const stamp = '2026-08-11T00:00:00.000Z'

assert.equal(
  resolveEarsParsingUrl({
    status: 'ready',
    updatedAt: stamp,
    crops: {
      earsLeft: { publicUrl: '/api/media/a/parsing/earsLeft.jpg' },
      earsLeftSegformer: { publicUrl: '/api/media/a/parsing/earsLeftSegformer.jpg' },
    },
  }),
  '/api/media/a/parsing/earsLeft.jpg',
)

assert.equal(
  resolveEarsParsingUrl({
    status: 'ready',
    updatedAt: stamp,
    crops: {
      earsLeftSegformer: { publicUrl: '/api/media/a/parsing/earsLeftSegformer.jpg' },
      ears: { leftSegformerPublicUrl: '/api/media/a/parsing/earsLeftSegformer.jpg' },
    },
  }),
  '/api/media/a/parsing/earsLeftSegformer.jpg',
)

assert.equal(
  resolveEarsParsingUrl({
    status: 'ready',
    updatedAt: stamp,
    crops: {
      ears: { leftPublicUrl: '/api/media/a/parsing/earsLeft.jpg' },
    },
  }),
  '/api/media/a/parsing/earsLeft.jpg',
)

assert.equal(resolveEarsParsingUrl({ status: 'pending', crops: {} }), null)

console.log('test-ear-hero-fallback: ok')
