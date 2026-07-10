# Prototypicality (proportion-conformity) methodology

**Client-facing label:** Prototypicality  
**Internal name:** Five-ratio proportion-conformity score  
**Code constant:** `five_ratio_proportion_conformity` (`methodology` on `cvReport.averageness`)

## Honest one-liner (for client / pitch)

> We compare five key facial ratios (jaw width-to-height, nose width, facial thirds, brow line, symmetry) against established aesthetic-proportion **targets** adjusted by questionnaire ethnicity and gender preference. We do **not** use a live population database or measured cohort morphospace.

## What it is NOT

- Not deviation from a real population mean face dataset
- Not Procrustes / thin-plate spline distance to cohort landmarks
- Not correlated to rated attractiveness (Qoves pg3 “1/10 scale” research is **not** replicated here)

## Data sources

| Input | Source |
|-------|--------|
| Landmarks | MediaPipe Face Mesh (478 points), single photo |
| Ideal ratio targets | **Hardcoded** tables in `prototypicality.py` / `prototypicalityNorms.js` |
| Ethnicity adjustment | Questionnaire `answers.ethnicity` → `ETHNICITY_NORMS` |
| Gender adjustment | `answers.genderPreference` → small deltas on width/nose only |
| Gray “average” wireframe | **Synthetic template** from norms + user face **bounding box** only — **no user landmark positions** |

## Five ratios scored

1. **Jaw width** — gonial width (landmarks 172↔397) / forehead–chin height vs `norms.faceWidthHeight`
2. **Nose** — alar width / bizygomatic cheek width (127↔356) vs `norms.noseRatio`
3. **Brows** — eye-center brow line height / face height vs `norms.upperThird` (same reference line as facial thirds)
4. **Facial thirds** — upper / middle (brow→subnasale) / lower vs norm thirds
5. **Symmetry** — left–right mirror error (light weight; separate symmetry section is authoritative)

Each deviation is a **relative error**: `|measured - ideal| / ideal` (thirds use mean absolute difference).

## Score formula

```
weighted = Σ (magnitude_i × weight_i)   # each magnitude capped at 0.38
penalty  = weighted × 195
score    = clamp(round(84 - penalty), 25, 96)
```

**Weights:** jaw 0.24, nose 0.22, thirds 0.22, brows 0.22, symmetry 0.10.

**Norms** are MediaPipe-calibrated (e.g. white cohort: jaw w/h ≈ 0.90, nose/cheek ≈ 0.30). Tune with `scripts/prototypicality_sanity.py`.

## Wireframe (shape analysis chart)

- **Green (You):** MediaPipe landmarks → feature polylines (jaw oval, eyes, brows, nose, lips)
- **Gray (Average):** `_synthetic_ideal_landmarks(bounds, norms)` — ideal template scaled to the user’s face bounds, **zero blend with user points**

Bounds come from the user’s face oval (for chart framing only).

## Files

- `backend/prototypicality.py` — runtime (authoritative)
- `utils/prototypicalityEngine.js` — JS mirror
- `utils/prototypicalityNorms.js` — norm tables
- `components/report/PrototypicalityShapeAnalysis.jsx` — two-layer SVG render

## Regenerate reports

Scores and wireframes are stored on `cvReport.averageness` at analysis time. **Re-run assessment** after engine changes.
