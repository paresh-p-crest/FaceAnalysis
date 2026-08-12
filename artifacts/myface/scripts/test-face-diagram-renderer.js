#!/usr/bin/env node
/**
 * Self-check for faceDiagramRenderer.js (assert-based, no test framework).
 * Run: node artifacts/myface/scripts/test-face-diagram-renderer.js
 */
import assert from 'node:assert/strict'
import {
  applyImageAspect,
  buildFaceDiagram,
  canonicalize,
  extractGroups,
  buildFeatureGeometry,
  templateLandmarks,
  validateLandmarks,
} from '../utils/faceDiagramRenderer.js'

function dist(a, b) {
  return Math.hypot(a[0] - b[0], a[1] - b[1])
}

function pt(lms, idx) {
  return [Number(lms[idx].x), Number(lms[idx].y)]
}

// applyImageAspect restores height on synthetic portrait coords
const portrait = [{ x: 0.5, y: 0.8, z: 0 }]
const corrected = applyImageAspect(portrait, 400, 500)
assert.ok(Math.abs(corrected[0].y - 1.0) < 1e-6, 'y should scale by H/W (0.8 * 500/400 = 1.0)')

// canonicalize makes inter-eye distance ≈ 0.28
const sample = templateLandmarks()
sample[152].y = 0.96
sample[263].x = 0.70
const canon = canonicalize(sample)
const rc = [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246].map((i) => pt(canon, i))
const lc = [362, 382, 381, 380, 374, 373, 390, 249, 263, 466, 388, 387, 386, 385, 384, 398].map((i) => pt(canon, i))
const rcx = rc.reduce((s, p) => s + p[0], 0) / rc.length
const rcy = rc.reduce((s, p) => s + p[1], 0) / rc.length
const lcx = lc.reduce((s, p) => s + p[0], 0) / lc.length
const lcy = lc.reduce((s, p) => s + p[1], 0) / lc.length
const ied = dist([rcx, rcy], [lcx, lcy])
assert.ok(Math.abs(ied - 0.28) < 0.02, `inter-eye distance should be ~0.28, got ${ied}`)

// Face outline stays open (first point ≠ last point)
const geom = buildFeatureGeometry(extractGroups(canon))
const face = geom.face
assert.ok(face.length >= 2, 'face outline needs points')
assert.ok(
  face[0][0] !== face[face.length - 1][0] || face[0][1] !== face[face.length - 1][1],
  'face outline must stay open (no forehead closure)',
)

// Nose triangle has 3 vertices (+ closure point)
const tri = geom.nose.triangle
assert.equal(tri.length, 4, 'nose triangle includes closure point')
assert.ok(dist(tri[0], tri[1]) > 1e-6 && dist(tri[1], tri[2]) > 1e-6, 'triangle vertices distinct')

// buildFaceDiagram returns ≥ 8 paths for template landmarks
const diagram = buildFaceDiagram({ landmarks: templateLandmarks(), imageWidth: 4, imageHeight: 5 })
assert.ok(diagram, 'template landmarks should produce a diagram')
assert.ok(diagram.paths.length >= 8, `expected ≥8 paths, got ${diagram.paths.length}`)
assert.ok(diagram.viewBox && !diagram.viewBox.startsWith('0 0 760 900'), 'viewBox should be tight to content')
assert.ok(diagram.aspectRatio > 0.5 && diagram.aspectRatio < 1.2, 'aspect ratio should be face-like')

// Invalid landmarks return null (no template fallback in report path)
const broken = [{ x: 0.5, y: 0.5 }]
assert.equal(buildFaceDiagram({ landmarks: broken }), null)
assert.equal(validateLandmarks(broken).valid, false)

console.log('test-face-diagram-renderer: all checks passed')
