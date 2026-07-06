# AuraScan Research Notes (Qoves-Inspired, Not Copied)

> Internal reference from `qoves-references/` — informs AuraScan identity only.

## Reference Inventory

| Asset | Type | Insight |
|-------|------|---------|
| `protocol_report (3) 1.pdf` | 16-page protocol PDF | Cover, disclaimer, cephalometric intro, before/after per feature, short recommendations |
| `ref1–ref7.jpg`, dated screenshots | UI captures | Dimorphism grid, proportions bars, eyebrows, skin pores, face shape hexagon, sidebar hierarchy |
| `face_shape.jpg` | Face shape | Hexagon overlay + 4 metric cards + explanation |
| `Hairstyle Suggestions.docx.pdf` | Supplement | Locked premium section pattern |

## Qoves Report Architecture (Observed)

### Static vs Generated

| Static | Generated from measurements |
|--------|----------------------------|
| Disclaimer, methodology intro, nav labels | Scores, ratios, feature labels, crop images |
| Layout templates, typography system | Protocol text (written per client) |
| Before/after frame structure | Landmark overlays, bar heights, mm values |

### Section Hierarchy

1. **Introduction** — Executive / overview
2. **Facial Assessments** — Dimorphism, Averageness, Face Shape, Symmetry, Proportions
3. **Features Analysis** — Per-feature deep dives (brows → skin)
4. **Protocol** — Recommendations grouped by feature with before/after

### Scoring & Charts

- **Dimorphism**: Hyper Feminine ↔ Hyper Masculine horizontal slider per feature
- **Averageness**: Score /100 + YOU vs AVERAGE contour overlay
- **Proportions**: Two-tone vertical ratio bars (feature A : feature B at 1.00)
- **Face shape**: Classification + width/length cards
- **Skin**: Region tabs, pore scatter, vertical demographic bar
- **Protocol PDF**: BEFORE/AFTER pairs per feature, 2–4 sentence recommendations

### AI Usage (Qoves vs AuraScan Target)

| Qoves (inferred) | AuraScan rule |
|------------------|---------------|
| Protocol prose likely human/AI-assisted | LLM **only** for protocol + optional narrative |
| Layout fixed in product | **Fixed** React report structure |
| Measurements from CV pipeline | MediaPipe + canvas math (+ AWS attributes) |

## AuraScan Current State (Baseline)

- **19 nav sections** in `ReportNavSidebar.jsx`
- **Scoring**: `opencvMetrics.js` + `cvReport.js` (heuristic, template explanations)
- **LLM**: OpenAI path skips `cvReport` (known gap); protocol LLM unused on openai provider
- **Export**: None (added: PDF via jspdf)
- **Identity**: Teal brand, card-based UI, scientific labels

## AuraScan Differentiation

- Brand: **AuraScan** (not Qoves typography/layout clone)
- Teal accent system vs Qoves neutral gray
- Template-first explanations; LLM optional for protocol only
- Free CV path as default ($0 landmark pipeline)

## Implementation Phases

### Phase 1 (This release)
- [x] Research document
- [x] Download Report PDF (AuraScan branded)
- [x] Before/after canvas enhancement
- [x] Default nav → Executive Summary

### Phase 2 (Future)
- Face shape hexagon SVG overlay
- Dimorphism 2-column feature grid with crops
- Averageness dual-contour visualization
- Radar chart for overall scores (chart.js)
- Fix OpenAI provider to still build `cvReport`
- Population norms by demographics in scoring
- mm calibration from IPD

## Assumptions

- Front photo is primary; profile used for ear proportion only
- PDF images embedded as JPEG data URLs
- Before/after "after" is enhanced visualization, not generative AI makeover
- Protocol template used when LLM unavailable
