# Changelog

All notable changes to this project will be documented in this file. The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]
### Changed
- **Generative projected AFTER face** — the projected AFTER image is now produced by a **generative image edit** (`backend/projected_after_ai.py` → `image_client`) instead of the deterministic OpenCV retouch. The prompt is identity- and measurement-preserving (same person / bone structure / proportions / pose / lighting; no reshaping, no clinical imagery) and emphasizes the weakest features via `projection_strengths`. If the provider is unavailable or the edit fails, `projected_after.status` is set to **`pending`** (retryable) instead of `failed`, and AFTER CV (`projected_analysis`) is skipped. The legacy OpenCV `backend/projected_after.py` (`project_full_face_after`) is **removed**; its still-used helpers (`projected_after_enabled`, `projection_strengths`) moved into `projected_after_ai.py`. (ADR-029)
- **Provider-agnostic image client** — new `backend/image_client.py` replaces `openai_images.py`/inlined OpenAI calls. One `generate_image_edit(prompt, image_bytes)` entry point abstracts **OpenAI** (`/v1/images/edits`, multipart) and **OpenRouter** (`/v1/chat/completions` with `modalities:["image","text"]`, source image in the user message, edited image in `choices[0].message.images[0]`). Provider resolves `IMAGE_PROVIDER → LLM_PROVIDER → key presence` (mirrors `resolve_llm_provider`); models via `OPENAI_IMAGE_MODEL` (default `gpt-image-1`) / `OPENROUTER_IMAGE_MODEL` (default `google/gemini-2.5-flash-image`). `visual_generation.py` (AI visuals) now routes through the same client, so a single provider setting drives both features. Never raises for expected failures (missing key, timeout, non-2xx). (ADR-029)
### Fixed
- **Uploads served from the Next.js public dir** — after the Replit artifact migration the frontend lives in `artifacts/myface`, so backend-written files (poses, SegFormer parsing crops, projected AFTER, protocol JSON) now write under `artifacts/myface/public/uploads/...` via shared `backend/config.py` `PUBLIC_DIR`/`UPLOADS_ROOT` (was repo-root `public/`, which `next dev` never serves → `/uploads/... 404`). Public URLs are unchanged (`/uploads/assessments/...`).
- **Cross-platform workspace tooling (Replit + Windows)** — the pnpm-only `preinstall` guard is now a Node script (`scripts/enforce-pnpm.cjs`) instead of `sh -c '...'` (which failed in Windows PowerShell/cmd); the `@workspace/myface` `dev`/`start` scripts drop the bash `${PORT:-3000}`/`$PORT` and rely on Next.js honoring the `PORT` env (Replit sets it; local defaults to 3000). Added a root `pnpm dev` convenience script.
- **Skin Recommendations side-by-side pair framing** — the skin *side-by-side* pair now uses a tight cheek-only skin patch (`getFeatureBox('skin')`): image-left cheek framed strictly **below the lower eyelid and above the upper lip**, inset from the ear/jaw silhouette and stopped before the nasal ala — no eye, no lips, no nose. `FEATURE_MIN_PX.skin` lowered to 180 so the tight box is not re-inflated by `expandBoxToMinSize`. Side-by-side BEFORE = `imageSlots.pairBefore` (live tight crop) and AFTER = feature-cropped tight AFTER (`AFTER_LIVE_FIRST_FEATURES`). The PDF **half-split panel is unchanged** — it keeps the wide `imageSlots.before` cheek crop (stored `cvReport.cheeks`) with the full AFTER warped on via `alignAfterToBefore`.
- **`scripts/test_hair_norwood_assessment.py`** — hair/Norwood geometry test; by default inserts a **new** assessment clone with only `analysis.cvReport.hair` updated (source row untouched; `--dry-run` to skip write).
- **`scripts/calibrate_norwood_temples.py`** — labeled-folder harness for temple-recession threshold calibration.
- **Norwood stage 1 vs 2 misclassification** — staging for Hamilton–Norwood 1–3 is now **temple-geometry** driven (`templeRecession` / mid-frontal hairline), not scalp `densityPct`. Density only escalates stage 4+. Also: hair-mask highlight arm (glossy lit hair), density ROI starts below the detected hairline (not fixed forehead %), `templeMetrics` on hair result, calibration harness `scripts/calibrate_norwood_temples.py`. Thresholds 0.03/0.07/0.13 are pre-calibration placeholders (not a clinical diagnosis).
### Added
- **Projected AFTER CV (`projected_analysis`)** — after a successful `projected/full` write, runs MediaPipe/OpenCV on that image into assessments JSONB `projected_analysis` (`cvReport`, landmarks, metrics, eyeAnalysis). BEFORE `analysis` is never mutated (ADR-027). Admin `POST …/projected-after` regenerates both image + AFTER analysis.
- **`scripts/rerun_projected_analysis.py`** — run AFTER CV (`projected_analysis`) from the assessment’s `projectedAfter.full` URL/path (disk scan only as fallback); asserts BEFORE `analysis` unchanged. Manual invoke only.
### Fixed
- **Protocol/PDF feature AFTER framing** — eyes/jaw/chin/ears (and neck/hair) live-crop with `projectedAnalysis.landmarks` + same `getFeatureBox` as BEFORE. When AFTER aspect/size ≠ BEFORE front, face-centered cover-fit onto BEFORE canvas (AFTER-only; clinical B&A same-format practice) then remap landmarks. `FEATURE_MIN_PX` scaled by short-side ratio. Stored `cvReport` crops fallback for live-first features; other features prefer stored crops. Skin half-split unchanged.
- **PDF skin half-split alignment** — for Skin Recommendations, the half-before / half-after panel warps projected AFTER onto the BEFORE canvas via MediaPipe similarity (`alignAfterToBefore`) before `composeSplit`. BEFORE is never modified.
- **Skin BEFORE/AFTER pair AFTER framing** — side-by-side AFTER uses a midface crop centered between nose tip and upper lip, slightly zoomed out (`zoomOut` 1.22); landmarks detected on the AFTER image. Half-split path unchanged.
- **Protocol overview AFTER squeeze** — PDF cover no longer stretch-falls-back when warm/crop misses (aspect-preserving contain). Overview BEFORE/AFTER face-aligns AFTER onto BEFORE; UI overview frames use `aspect-[3/4]` matching portrait captures.
### Changed
- **Report open: single assessment GET** — admin/dashboard no longer stack redundant `GET /api/assessments/{id}` calls; `viewCloudAssessment` skips a second fetch when already given a full payload, and `Report` reuses that doc for admin tools + NL hydrate (no extra GETs on open).
### Added
- **Admin projected AFTER** — `POST /api/assessments/{id}/projected-after` (admin) always generates/overwrites `projected/full.jpg|png`, ignoring `PROJECTED_AFTER_ENABLED`.
- **`scripts/rerun_projected_after.py`** — re-run full-face projected AFTER for one assessment (mirrors admin path; default ignores env flag). Manual invoke only.
- **Admin protocol section regen** — `POST /api/assessments/{id}/ai-protocol/section` regenerates overview, closing, or one feature; `ai-protocol?force=true` regenerates the whole PDF narrative (admin).
- **Projected AFTER pipeline stage** — last worker step after parsing generates one full-face measurement-guided image (`projected/full.jpg` or `full.png` from magic bytes); same `publicUrl` on all protocol/PDF AFTER slots; `PROJECTED_AFTER_ENABLED=false` by default (ADR-026). Distinct from AI Visuals.
- **Async full assessment pipeline** — `POST /api/assessments` validates photos, persists uploads, and enqueues CV → narratives → SegFormer parsing via Postgres-tracked `pipeline` JSONB + in-process worker (`PIPELINE_WORKER_ENABLED`, `FOR UPDATE SKIP LOCKED`).
- **AnalysisPreparing UI** — Qoves-style “your analysis is being prepared” screen with live stage list; users can close the tab and track progress from Dashboard/History.
- **Feature parsing enrichment** — `featureParsing` JSONB + `parsing/{featureId}.jpg` crops; assumed-scale mm metrics (`scale: assumed_ipd_63.5`) for interactive Features Analysis panels only (ADR-024).
- **Pipeline retry endpoint** — `POST /api/assessments/{id}/retry-pipeline` for failed jobs.
- **`scripts/rerun_parsing.py`** — re-run SegFormer parsing only for an existing assessment (no full pipeline replay).
### Changed
- **Admin review panel** — removed executive summary / strengths / focus / recommendations / disclaimer editors; admins generate whole or per-section PDF protocol text, edit subsection bodies via section dropdown, and generate projected AFTER; save persists `protocolNarrative` + `featureNarratives`.
- **Hybrid SegFormer parsing crops** — front-pose mask-isolated heroes use **white** background (eyes, nose, eyebrows, hair, **neck**; ears skipped on front); **skin** = face composite minus hair; **chin / cheeks / jaw** stay rectangular. **lips** from DB front MediaPipe landmarks on `front.jpg`; **smile** from MediaPipe on `smile.jpg`; **earsLeft / earsRight** from SegFormer on profile poses.
- **Ears panel** — single left-profile hero (`max-h-48`) matching other feature boxes; dual L/R grid removed.
- **Dimorphism per-feature cards** — show the same `featureParsing` crops (eyebrows/eyes/nose/…) as Features Analysis; scores/explanations unchanged.
- **Upload flow** — Scanning step is a fast submit only; report opens after pipeline `ready` (not inline in POST).
- **Per-subsection narrative body caps (all features)** — explicit short/standard/long bands (1000 / 1500 / 2000 chars) for every feature title; Ear Structure / Neck Skin / Eyebrows / Under eye = long; Further Enhancement = standard.
### Fixed
- **PDF projected AFTER** — protocol overview and feature pages were hardcoding AFTER as `null` (“Projected image pending”); they now use `projectedAfter.full.publicUrl`. Report also re-fetches `projectedAfter` when narratives are already cached.
- **Admin review scroll** — embedded review panel uses a max-height + internal scroll with sticky Save/Approve so actions stay reachable inside the report modal.
- **Admin review tools** — PDF narrative and After image are separate admin-only header toggles that open independent overlays; not shown to clients; report body stays uncluttered.
- **Protocol BEFORE/AFTER framing** — preview `ImageFrame` uses absolute `object-cover` so portrait AFTER fills the frame (no side letterboxing); hair PDF frames also use `cover: true`.
- **Landmark-matched AFTER crops** — protocol UI + PDF crop `projectedAfter.full` with the same `getFeatureBox` keys as BEFORE (`resolveFeatureAfterImage`); overview stays full-face; skin uses cheek/skin box (not full portrait).
- **Face parsing optional deps** — `requirements-face-parsing.txt` now includes `torchvision` (required by `SegformerImageProcessor`); documented `uv pip install --python backend/.venv/Scripts/python.exe` for local venv setup.
- **AnalysisFlow build** — removed duplicate `openDashboard` destructure from `useApp()` that broke Next.js compile.
- **Proportions overview guides** — lines were crop-% drawn on the full front photo (spread above the head / into the neck). Guides are now full-image % (hairline/brow/subnasale/chin); UI recomputes from landmarks at display time and prefers the front photo so existing assessments fix without a re-scan.
### Changed
- **Report prose: no hard clip + numeric ban** — removed mid-sentence `_clip` ellipsis; raised feature narrative caps (`body` 1500, `summary` 500); LLM `measuredFacts` use qualitative score bands (no `N/100`); expanded NUMERIC BAN prompts + `SCORE_PROSE_PATTERN`; score language hard-rejects then retries (strip only after accept).
- **PDF summary / labeled heading spacing** — more gap under titles in `drawSummaryCard` and `drawLabeledBody` (e.g. Ear Summary).
- **Feature narrative retries** — hard reject / empty: up to **3** total LLM attempts (`FEATURE_NARRATIVE_MAX_ATTEMPTS`); **429**: **3** extra calls with exponential backoff from **30s** (`FEATURE_NARRATIVE_RATE_LIMIT_RETRIES` / `FEATURE_NARRATIVE_RATE_LIMIT_BACKOFF_SEC`).
- **Eyes interactive panel** — omits the Eyebrows narrative subsection; brows stay on the dedicated Eyebrows Features Analysis tab.
- **LLM max output tokens** — default `LLM_MAX_OUTPUT_TOKENS` raised from **4000** to **8000** (narratives, protocol, assistant; still overridable via env).
### Fixed
- **Facial thirds mismatch** — metrics used brow→mouth→chin while the overlay (reference) uses brow→subnasale→chin, producing inflated middle thirds (e.g. 0.60) and high proportionality scores unrelated to thirds; both now share hairline/10 → brow → subnasale/2 → chin, and score from thirds balance.
### Changed
- **Facial Assessments copy from measurements** — Face Shape `midfaceWidth` classified vs brow/jaw; dimorphism/symmetry/proportions/prototypicality explanations cite live scores, ratios, and regional drivers (no false skin claim); thirds fall back to landmarks when metrics missing.
### Removed
- **Scanning cycling headline** — dropped rotating `SCAN_MESSAGES` copy; scan UI shows the current progress stage only.
### Changed
- **PostgreSQL greenfield (ADR-023)** — replaced MongoDB/Motor with SQLAlchemy async + asyncpg; UUID PKs; JSONB for nested assessment payloads; `conversation_messages` normalized; env `DATABASE_URL`; gate `is_db_configured`; health field `database`. Removed `motor`/`pymongo`.
### Fixed
- **Domain models doc ↔ Mongo alignment** — documented `users.firstName`/`lastName`, `app_settings.createdAt`, `reviewLog` element shape, partial `user_scan_unique` index, cascade deletes, and `ai_access` owning `assistant_rate_limits`; startup now creates the unique `(userId, hourBucket)` index on that collection.
### Added
- **Symmetry regional balance UI** — interactive Symmetry panel shows Eyes/Brows/Mouth/Jaw L–R balance bars from scoring pairs (`cvReport.symmetry.regions`).
- **Smile LLM narrative** — `FEATURE_NARRATIVE_IDS` includes `smile` (subsections Smile Shape / Teeth & Gingiva); generated into `featureNarratives.smile` and shown on the interactive Smile panel. Protocol PDF page map stays 10 features (ADR-022).
### Changed
- **Face Shape layout** — Shape + Midface/Forehead/Lower-third/Facial-length + Explanation sit in the right column beside the photo; Length/Midface and W/H Ratio wrap below.
- **Prototypicality mesh topology** — thick closed polygonal brows; nose is bridge-to-tip then tip↔alae triangle; face outline is temple→chin→temple U (near outer-eye height via 162/389), no forehead oval.
- **Prototypicality shape mesh stroke** — sage `#6B9080`, thinner (~0.75) round-cap lines on a white panel with a faint grid.
- **Proportions overview UI (Qoves layout)** — left face photo with hair/brow/nose/chin dotted guides; right stack of Proportionality score card (High/Good/Fair badge), Facial Thirds C→B→A bar, and Explanation. Backend `proportionLines` now crop-relative to match `imageSrc`.
- **Prototypicality shape mesh** — Shape Analysis panel draws a single front x/y MediaPipe feature mesh (lips/eyes/brows/oval/nose) in brand stroke; no photo, no side profile, no You vs Average overlay.
- **Symmetry overlay (notebook set)** — 18 bilateral hollow rings (brow/eye/alae/mouth/cheek/jaw/chin pairs) plus double-arrow midline from landmarks 10→152; removed midline nose-chain and lid/peak dots from the overlay. Rings match notebook style: thin pure-white hollow circles (stroke ~1.1px), no fill/outline halo; aspect-compensated ellipses so markers stay round under stretched SVG mapping.
- **Symmetry score curve (liberal)** — mapping softened to `92 − avgDev×7.5` (clamp 55–97); label bands unchanged (85/74/64).
- **Face Shape assessment (notebook port)** — `face_shape_from_landmarks` uses the 8-point polygon (10/103/234/132/152/361/454/332) with forehead expansion and Oval/Square/Heart/Round/Oblong classification; UI shows notebook metrics plus W/H ratio (jaw%/cheek% removed as static); white octagon+ellipse+dashed crosshairs via `FaceShapeOverlay` on the front photo (also baked into `faceShape.imageSrc`).
- **Face Shape metrics** — dropped static `jawWidth` / `cheekWidth` % cards from interactive Face Shape (and from `faceShape` payload).
- **Interactive feature panels — one prose block** — brows/skin/cheeks/eyes/`FeatureReportPanel`/nose/lips no longer repeat the same CV `explanation` in details + section fallbacks + Full Analysis Summary; single `FeatureProseBlock` per panel.
- **Interactive Features Analysis ← `featureNarratives`** — protocol LLM `summary`/`subsections` wired into that slot (eyebrows from eyes “Eyebrows” subsection); CV explanation or “Narrative pending” when missing.
- **Facial Assessments copy (no LLM)** — dimorphism / prototypicality / proportions / symmetry / face shape use second-person Qoves-style metric templates; proportions UI shows facial-thirds overview + per-ratio explanations (ADR-022).
- **Scanning progress UI** — stages mirror one-shot NL enrichment (`Writing feature recommendations` / `Building protocol narrative`); CV stages advance ~1.4s, NL stages ~10s; final stage completes only when `POST /api/assessments` returns; helper copy notes the wait can take a few minutes.
- **Unified LLM max output tokens** — all backend completions use `LLM_MAX_OUTPUT_TOKENS` (default **4000**, overridable via env) instead of mixed per-call caps; reduces truncated-JSON fallbacks that burned free-tier retries.
- **Slim feature LLM schema + hard no-scores in report prose (ADR-021)** — feature narratives ask the model only for `summary` + subsection `{title,body}`; `measuredFacts`/`limitations`/etc. are hydrated server-side. Executive, protocol overview/closing, and feature prompts forbid numeric scores (`X/100`); scores are stripped before persist.
### Added
- **Feature narrative shape normalize + enrichment scoreboard** — coerce common free-model JSON mistakes (`feature`→`featureId`, string→list fields, title-keyed subsections, body length clip) before schema validate; log `LLM accepted` / `TEMPLATE` per feature and a end-of-run `llm/total` scoreboard.
- **OpenRouter LLM provider** — set `LLM_PROVIDER=openrouter` with `OPENROUTER_API_KEY` (+ optional `OPENROUTER_MODEL`, default `meta-llama/llama-3.3-70b-instruct:free`). OpenAI-compatible client via `https://openrouter.ai/api/v1` (ADR-020). Free `:free` models remain rate-limited.
### Fixed
- **Feature LLM discarded for soft guardrail fails** — schema-valid feature narratives are kept (with a warning) when only soft checks fail (ungrounded scores / evidence tiers); templates only on banned procedural terms or unparseable JSON. Stops PDF from showing guardrail templates after successful Groq generations.
### Removed
- **`protocolData` action cards** — dropped from LLM generation, Mongo/`protocol.json` storage, APIs, FE props, and Beauty Assistant `get_protocol_cards`. Protocol completeness uses `protocolNarrative` + `featureNarratives` only (ADR-018).
- **Ruler calibration** — deleted `calibration.py` / `test_calibration.py`; no `cvReport.calibration`, `mmPerUnit`, or questionnaire `mouthWidthMm`/`philtrumLengthMm` path (ADR-019). Profile cephalometrics keep angles/ratios in normalized units only.
### Added
- **Cheek PDF ANALYSIS guides from MediaPipe** — Cheek Recommendations ANALYSIS overlay uses DB `analysis.landmarks` with the midface construction from `test.ipynb` (ear-to-ear @ 1.08×, eyes 130/263, nostrils 102/331, mouth 61/291); see `utils/cheekGuides.js`.
- **PDF chin profile guides from CV** — Top: facial thirds. Bottom: pitched profile (~7° CW for rightProfile) with Pn + lip-plane verticals and chin ticks only (no dashed E-line). Landmarks resolved on the pitched bitmap via `resolveChinProjectionOverlay`.
- **`report_content.py`** — latest-only completeness helper (`aiNarrative`, `featureNarratives`, `protocolNarrative`, `aiVisuals`) and envelope shapes for generated report text.
- **Full facial analysis pipeline** — staged end-to-end doc in `docs/architecture/backend-overview.md` (FE entry → CV → persistence → LLM/guardrails → report/PDF → assistant → admin review).
### Changed
- **PDF/web protocol cover** — client name from questionnaire or logged-in user (`firstName`/`lastName`); cover shows PREPARED FOR + EDITION only (no date).
- **Cheek ANALYSIS crop** — midface box (eyes/ears/nostrils/mouth) so notebook-style guides fit the plate.
- **PDF Understanding page** — wider gap after numbers (48→78); section headings 10→11pt; body 8→9pt; page title 26→28.
- **PDF Neck Summary overflow** — `drawSummaryCard` no longer forces `minH` when space is tight (was drawing past the page); neck BEFORE/AFTER **280→240** to leave room for the summary.
- **PDF column summaries** — `drawSummaryCard` sticks to `PAGE_BOTTOM`; standard `SUMMARY_CARD_MIN_H = 110`; eyes EYES crop bottom-aligns with Eye Region Summary.
- **PDF image→text gaps** — `SECTION_GAP` and `IMAGE_TEXT_GAP` set to **22** (was 14 / 10); applied to frame returns, before/after pairs, cheek ANALYSIS trailing space, and client protocol portraits.
- **PDF lips BEFORE/AFTER** — pair height **175→200**.
- **PDF hair BEFORE/AFTER** — stacked frames **100→120**.
- **PDF lips LIPS preview** — square frame at full `COL_W`×`COL_W` (was `COL_W`×120).
- **PDF client protocol page** — BEFORE/AFTER portraits **240→360** tall; text/radar positions shift down to fit.
- **PDF chin profiles** — two guide frames use full `COL_W` × `CHIN_PROFILE_FRAME_H` (200), same style as nose/jaw but shorter than `PROFILE_FRAME_H` (300) so B/A + summary stay on one page.
- **PDF feature frame sizes** — hair BEFORE/AFTER 80→100; eyes BEFORE/AFTER pair 100→130; nose/jaw PROFILE shared `COL_W`×300 (`PROFILE_FRAME_H`); cheeks ANALYSIS/BEFORE/AFTER unified at COL_W×180; jaw BEFORE/AFTER 140→150; lips BEFORE/AFTER 150→175; chin guide profiles 100→120; skin half-col BEFORE/AFTER 90→150; neck stacked BEFORE/AFTER 230→280; ear stacked BEFORE/AFTER 200→220.
- **PDF eyes EYES frame** — landmark eyelid-ring contour clip (same approach as lips); no center-zoom that flattened the tops.
- **PDF lips LIPS frame** — uses outer-lip (`MOUTH`) contour mask on the protocol panel (`lipPreviewMask: 'contour'`); web protocol UI keeps the oval preview.
- **Protocol persistence SOT** — Mongo wins when narrative fields are complete; `protocol.json` mirrors narrative/features only; closing always persisted server-side; admin `aiNarrative` edit refreshes closing; FE closing reads stored text only.
- **Protocol web viewer A4 sheets** — in-app protocol pages use `.qoves-report-a4-page` (210×297 aspect) on a desk canvas so the UI reads like stacked A4 pages, matching the PDF export proportions.
- **Backend overview doc** — `docs/architecture/backend-overview.md` maps every backend module (routers, CV pipeline, AI, PDF, repos) in plain language with the upload → analyze → store → narrative flow; clarifies FE jsPDF owns the branded protocol PDF vs backend ReportLab fallback.
### Changed
- **Report voice (ADR-017)** — PDF/protocol hard-coded copy and narrative/protocol LLM prompts use Qoves-style third person with **the subject** as grammatical subject (name when provided). Beauty Assistant and image prompts remain second person / unchanged. Supersedes ADR-013 for report narratives. Stored second-person feature/closing narratives are rewritten to subject voice at PDF/protocol render time.
### Fixed
- **Cheek PDF left-eye slant in sclera** — left eye vertex nudged toward ear; ANALYSIS overlay now cover-maps like chin and uses the same crop box as the photo so nudges actually land outside the eye.
- **Chin PDF top-plate horizontals on nose tip** — rays now start at/ below subnasale (clamped under Pronasale) on the facial plane; vertical still reaches the tip.
- **Chin PDF top-plate eye/cheek ray** — horizontal Y locked to Pn→Pog fractions only (ignore overlay Sn/G); drop anything at/above the tip; vertical no longer extends to brow.
- **Chin PDF top-plate unequal ticks** — horizontals use a fixed length from the vertical (no silhouette→vertical span), so all four match; tick length ~8% norm to match Image-2.
- **Chin PDF bottom verticals** — shifted further left (~2.8% norm); lip-plane (left) just shy of eyes, Pn (right) just shy of forehead.
- **Chin PDF over-pitch / floating guides** — replaced unstable Frankfort auto-level (~18° tilts) with a fixed ~7° chin-down pitch; tightened Pn/Pog/lip so the outer vertical and E-line stay on the soft-tissue profile instead of gray padding.
- **Chin PDF top plate invisible** — chin-show builder no longer drops out on soft validation; silhouette snap keeps a visible gap profile→vertical; draw path no longer skips segments via clip.
- **Chin PDF top PROFILE plate** — replaced cheek facial-thirds grid with Image-2 chin-show: one nose-tip vertical plus four horizontals from soft-tissue profile (Sn / stomion / labiomental / Pog) to that vertical.
- **Chin PDF projection overlays** — horizontals removed; both verticals nudged slightly left (~1.2% norm) toward the face.
- **Chin PDF guides shifted left of nose tip** — after clockwise pitch, silhouette X sat slightly posterior; Pn / lip / Pog get a small anterior nudge so verticals sit on the nose tip and lip plane (not through the eye/mouth corner).
- **Chin PDF guide fine-tune** — Pn/Pog inset onto soft tissue (not the bright halo); chin tip band raised off the throat; verticals end at chin-tick height.
- **Chin PDF pitch direction + simplify overlays** — right-profile pitch is clockwise (+7°) to match the reference forward tilt; bottom plate draws only verticals + chin horizontals (dashed E-line removed).
- **Chin PDF pitch + Ricketts lock** — re-enabled chin-down pitch; projection guides resolve Pn/Pog/Sn on the pitched photo (not collapsed Mongo overlay); chin ticks span Pog→lip plane and Pog→Pn vertical in full.
- **Chin PDF guides misaligned into padding** — template band used the frame’s right edge (empty gray); band is now face-content ∩ cover, then landmark X values snap onto the soft-tissue silhouette so Pn / Pog / verticals sit on the profile.
- **Closing PDF text corruption** — sanitize LLM Unicode (soft hyphens, en/em dashes, curly quotes, control chars) to Helvetica-safe ASCII before `splitTextToSize`/`text`; stops `` glyphs, blown word spacing, and left/right column overlap on Closing Recommendations.
- **Feature PDF templates instead of LLM copy** — `validated != raw` was always true after subject-voice rewrite, so every feature forced a retry; 429/failed retries then replaced good narratives with guardrail templates. Retries now run only when the first pass fails validation, and concurrency is capped at 2.
- **Chin PDF stacked analysis images** — right-column guide frames use the real right-profile photo (not frontal); frontal mouth/chin crop remains on the BEFORE pair only. Chin layout now resolves `profileImage` like nose/jaw.
- **PDF feature-page overlaps** — Hair/Eyes/Nose/Jaw/Chin/Cheeks/Lips/Skin/Neck/Ears drawers now use cursor-based (`leftY`/`rightY`) layout; summary cards grow with content and clamp above the footer.
- **PDF image frame overflow** — cover frames are canvas center-cropped to the exact box size before `addImage` (no jsPDF clip); keeps aspect ratio, prevents overflow, and does not blank later images.
- **Neck feature crop** — framing is now lower-face + neck (nostrils through jaw to collar), not a thin under-chin strip; protocol PDF prefers live crop over legacy stored crops.
- **Skin PDF split panel** — dashed center line is a true before|after split; right side shows projected after when available, otherwise "Pending" (does not mirror the before photo).
- **Chin BEFORE image** — frontal mouth/chin crop again (not right profile); profile kept on `imageSrcProfile` for overlays.
- **Ear BEFORE image** — front-facing ear/face crop (not right profile); PDF measurement guide lines removed for now.
- **Jaw BEFORE image** — front-facing mouth/jaw crop (not right profile); profile kept on `imageSrcProfile` for side overlays.
- **Hair BEFORE image** — frontal hairline/forehead/brows crop (not top-of-head scalp photo); top-head kept on `imageSrcTopHead` for density analysis.
### Changed
- **Nose PDF before/after** — image frame height increased from 80pt to 120pt on the Nose Recommendations page only.
- **Jaw PDF before/after** — image frame height increased from 90pt to 140pt on the Jaw Recommendations page only.
- **Norwood hair-loss PDF strip** — replaced line-drawn icons with head-focused Norwood stage illustrations (`public/norwood-stages/stage-1.png`…`stage-7.png`; Stage 3 vertex omitted; labels cropped out).
- **Understanding Your Results PDF** — bold lead sentences on page 4 bumped from 9pt to 10pt (slightly more prominent vs body copy).
### Removed
- **Scanning CV engine badge** — removed the "MediaPipe + OpenCV" pill from the analysis scanning screen (client-facing; ADR-013).
### Fixed
- **Naso-aural ear < nose false reading** — FaceMesh "ear" indices only mark the face–ear junction and under-read pinna height on 90° profiles. Ear span now uses rear-side helix→lobe detection from the profile photo; nasion/subnasale refined via silhouette indents. Overlay guides track the corrected points.
- **Chin / jaw recommendation images** — bind and display the right-profile photo (not front chin crop) in `photo_storage`, `CvReportView`, and protocol feature image resolution.
### Added
- **MediaPipe Pose neck metrics (ADR-016)** — `pose_analysis.py` runs alongside FaceMesh; jaw→shoulder neck length + head-forward posture angle when shoulders are visible; approximate fallback otherwise.
### Fixed
- **Hair segmentation kill-switch** — removed `HAIR_SEGMENTATION_ENABLED`; OpenCV HSV hair-mask always runs in the analysis pipeline (ADR-015).
- **Profile Tier C garbage-in** — `profile_silhouette` now wired as preferred 90° landmark source; FaceMesh alone no longer feeds nasofrontal/nasolabial/dorsal-hump when a silhouette is extractable.
- **Tier C render gap** — `nasofrontalAngleDeg`, `nasolabialAngleDeg`, `dorsalHump*` now shown in `CvReportView`, PDF protocol model, and nose explanation text (were computed but never displayed).
### Changed
- **`hair_analysis.analyze_hair_photo`** — prefers hair-mask density/hairline; falls back to dark-pixel heuristics only if mask fails.
- **`profile_cephalometrics`** — accepts profile photo bytes; `landmarkSource` is `silhouette` | `facemesh` | `silhouette+facemesh`.
### Added
- ADR-015 (always-on hair mask + silhouette profile landmarks).
- Tests: `test_hair_segmentation.py`, `test_profile_silhouette.py`.
### Fixed
- **LLM usage logs not visible** — usage boxes now `print` to stderr (uvicorn was hiding app `INFO`); `configure_backend_logging()` wires `backend.*` loggers.
- **Beauty Assistant markdown** — assistant bubbles render Markdown (bold, headings, lists, links) via `react-markdown` + `.assistant-markdown` styles.
- **AI visuals 500 (`Incorrect padding`)** — source portrait now loads from stored front photo / local `/uploads/...` path instead of base64-decoding public URLs; edits fail soft per variant.
### Added
- **LLM usage logging** — each chat completion logs provider, model, input/output/total tokens, and duration via `backend.llm_client` (pretty boxed INFO/WARNING lines).
- **Production AI visual prompts** — identity-preserving hair / outfit / aging edit prompts; image request logging; `sourceKind` on `aiVisuals`.
### Fixed
- **Beauty Assistant chat UX** — user message appears immediately; assistant typing loader in the thread; input stays editable while send is blocked until the reply returns.
- **Beauty Assistant panel** — responsive height (shorter on mobile, taller on desktop) with pinned composer; removed subtitle under the title.
- **`qovesProtocolModel.js` syntax** — restored missing `(` in `if (strengths.length)` that broke the Next.js build.
- **Beauty Assistant LLM failure** — no longer returns a fake score-dump template as a chat reply; `POST .../assistant` returns **503** with `ASSISTANT_UNAVAILABLE` when the model/API fails.
- **Symmetry / landmark overlays** — map MediaPipe 0–100% points onto the real `object-fit` image content box (fixes square SVG `meet` vs 4:5 letterboxing drift); smaller dots; curated landmark set; midline from facial landmarks.
- **Proportion overlays (ear/nose/mouth/eye)** — same content-box mapping; dots at true landmark coords (not averaged guide lines); orbito-nasal uses inner canthi (en–en) vs alae; orbital canthi L→R; live recompute from landmarks when available; 4px markers.
- **Naso-oral mouth width** — cheilions from outer-lip extremes (not inset 61/291); label is mouth vs nose (not vs 1.6 ideal).
- **Naso-aural ear guides** — use correct profile-side MediaPipe points; lateral ear span; short tick horizontals + endpoint dots.
- **Questionnaire welcome** — replaced Q-mark SVG with MyFace serif wordmark on the right panel.
- **Favicon** — page icon now uses `public/favicon.png` (replaced legacy `favicon.svg`).
### Changed
- **Navbar account control** — username / Sign in use `rounded-lg` (aligned with nav links), not pill shape.
- **Dashboard Payments KPI** — descriptor reads “Completed payments” (not “records”).
- **Dashboard** — removed Account KPI card; identity lives in the navbar only.
- **Navbar** — shows username (tap for Sign out); shows Sign in when logged out.
- **AI coaching voice** — narrative, protocol, closing, Beauty Assistant, and report UI use second-person (you/your) and omit MediaPipe/OpenCV/computer-vision jargon (ADR-013).
- **OpenAI Vision narrative enrichment** — when `LLM_PROVIDER=openai`, feature narratives attach only the mapped pose photos (hair: front+topHead; others per `FEATURE_VISION_POSES`); CV scoring stays local. Disable with `OPENAI_VISION_NARRATIVE=0`.
### Added
- **All 7 photo poses required** before analysis (`utils/constants.js`, `backend/photo_validation.py`, `POST /api/assessments` returns 400 when poses missing).
- **Structured `cvReport.eyes`** — four metric slices (eyebrows, eyelashes, ocular, underEye) via `assemble_eyes_region()` in `backend/eye_analysis.py`.
- **LLM closing synthesis** — `generate_closing_synthesis_async()` in `narrative_orchestrator.py` with `ClosingSynthesis` schema; deterministic stitch fallback.
- **Severity-gated 3-tier recommendations** — `evidenceTier` prompts, `deviationFacts`, tier ceiling validation in `clinical_guardrails.py`; tier labels in PDF and web viewer.
- **Profile cephalometrics extensions** — nasofrontal angle, dorsal hump deviation, profile gonial angle in `profile_cephalometrics.py`.
- **Skin texture module** — `backend/skin_texture.py` (Laplacian roughness, R−G redness, oiliness proxy) wired into `skin_quality_metrics()`.
- **Tier A landmark metrics** — jaw U/V/square classifier, cupid's bow definition, formalized frontal gonial angle proxy.
- **Optional hair segmentation hook** — `backend/hair_segmentation.py` gated by `HAIR_SEGMENTATION_ENABLED`.
- **Profile silhouette fallback** — `backend/profile_silhouette.py` for edge-based profile points (Phase 2 model integration).
- `backend/tests/test_photo_validation.py`.
### Fixed
- **`POST /api/assessments` 400** — front photo sent via `imageBase64` is now counted toward required-pose validation (was rejecting valid uploads).
- **Report modal** — shows an error instead of infinite "Building structured report…" when analysis returns without `cvReport`.
- **Demo photo analysis** — demo images (~40MB each) are compressed before upload; fixes oversized payloads on `POST /api/assessments`.
- **Open Report from dashboard/history** — fetches full assessment via `GET /api/assessments/{id}`; summary rows no longer misclassified as failed analysis.
- **Interactive report sidebar** — accordion nav (Introduction / Facial Assessments / Features Analysis / Protocol + Tools) restored; section-based navigation replaces immersive stacked scroll.
- **Report nav CSS build** — replaced invalid `@apply dark:hover:bg-surface-card/50` (and `/60`) with `hover:bg-surface-warm` so Next.js compiles `globals.css`.
- **Report header** — PDF (and Approve) sit in the same top bar as the title and close control.
- **AI narrative / protocol on open** — report open only loads stored NL content; generation runs once in `POST /api/assessments` pipeline.
- **`POST /api/assessments` 500** — `to_json_safe` now converts NumPy scalars (`np.bool_`, ints, floats, arrays) so MongoDB insert no longer fails with `cannot encode object: np.True_`.
- **Top-of-head hair analysis** — fixed grayscale-as-BGR crash in `analyze_hair_photo`; failed enrich no longer overwrites measured hair metrics.
- **Protocol narratives / summaries** — guardrails no longer reject the phrase `non-surgical`; templates and closing stitch produce measured, feature-specific copy instead of `Non-surgical guidance for X based on stored measurements`.
- **Report PDF feature crops** — per-feature landmark crops for eyes (brows / periorbital / dual-eye preview), lips (oval masked preview), and cheeks (landmark-based measurement overlays); generic guardrail narrative no longer replaces distinct subsection copy.
- **Hair PDF page** — `drawHairFeaturePage()` reads live `section.subsections` / `summary` and Norwood stage from `cvReport.hair`.
- **Nose PDF page** — no longer tags front crop as `PROFILE`; profile panel only when real side profile exists.
- **Nose CV enrichment** — profile measurements merged into `cvReport.nose` in `analyze_face._enrich_cv_report()`.
- **Neck metrics** — `dataSource: approximate` with user-facing limitation (no MediaPipe jargon).
- **Eyes web viewer** — 2×2 quadrant layout via `eyesQuadrant` layout hint.
- **Hair Norwood copy** — labeled as estimated, not clinical diagnosis.
- `AnalysisFlow` — single `/analysis` page with gated step state (welcome → questionnaire → confirm → upload → scanning).
### Changed
- Admin panel tabs use real routes (`/dashboard/admin-overview`, `/dashboard/admin-users`, `/dashboard/admin-review`, `/dashboard/admin-payments`, `/dashboard/admin-settings`) instead of `dashboard#admin-*` hash URLs.
- Assessment list APIs (`GET /api/assessments`, `GET /api/my/assessments`) return summary rows only (scores + metadata); full report loads on `GET /api/assessments/{id}` when opening a report.
- Admin workspace data is cached in `AppProvider` with tab-specific loading (no refetch when switching admin tabs; Refresh forces reload).
- Session is validated with `/api/auth/me` before `authReady`; route content does not render until complete.
- Inline theme bootstrap script in root layout prevents dark/light flash on refresh.
- Admin panel renders on `/dashboard` for admin users; Stripe success shows on `/billing`.
- Legacy URLs (`/report/*`, `/analysis/*`, `/admin`, `/payment-success`) redirect to the correct top-level route.
- `components/providers/AppProvider.jsx` — shared app state and navigation context.
- `components/AppShell.jsx` and `components/analysis/AnalysisShell.jsx` — layout shells with/without site navbar.
- Flattened App Router pages (`app/dashboard`, `app/history`, `app/billing`) — removed `(main)` route group to fix RSC bundler errors on `/history`.
- History and Billing pages: removed Back buttons; responsive stacked headers and full-width action buttons on mobile.
- Mobile `SiteNavbar`: full-width expandable panel below the header bar (replaces right-side drawer).
### Fixed
- Boot screen no longer shows navbar links (e.g. Analysis History) before session validation completes.
- Dashboard flash on refresh: auth gate blocks route content until session validation completes (no sign-in card swap).
- `/history` 500 from React Client Manifest / `SegmentViewNode` bundler errors after route-group flattening and client-only history load.
- `HistoryPage` loads local history in `useEffect` (avoids `localStorage` during SSR).
- `utils/settings.js` guards `localStorage` access during SSR (fixes 500 on report routes when `Settings` mounts).
- Report deep links show a loading state while assessment hydrates; no longer treats missing `analysis` as a CV failure.
### Changed
- Compact site navbar: reduced bar height (`2.5rem`/`2.75rem`), smaller nav links and auth/theme controls; hidden on analysis flow pages.
- Navbar-to-content spacing: `--site-navbar-gap` added to page offset on all navbar pages; fixed `py-8` overriding offset on dashboard, report, history, billing, admin, and payment success.
- Report view: immersive full-width layout without global navbar or report sidebar; floating PDF download only (admin Approve when pending).
- Questionnaire welcome: **Back to Dashboard** control (top-left) for signed-in users.
- Full-width responsive `SiteNavbar` replaces floating icon `TopNav`; preserves all app nav actions (Dashboard, History, Billing, Sign in/out, theme, etc.) with mobile drawer; hidden on questionnaire and scanning stages.
- Dashboard aligned to design tokens (`bg-brand`, `text-ink`, `bg-surface-card`) and landing-style gradient background; duplicate MyFace header removed.
### Added
- PDF-first clinical protocol pipeline: per-feature `featureNarratives` with OpenAI strict JSON Schema (`backend/narrative_schemas.py`, `chat_structured_completion` in `llm_client.py`).
- `backend/narrative_orchestrator.py` — 10 parallel structured LLM calls + clinical guardrails + protocol bundle stitching.
- `backend/feature_context.py`, `backend/clinical_guardrails.py`, `backend/recommendation_rules.py`, `backend/protocol_page_schema.py`, `backend/report_sections.py`.
- Beauty Assistant ReAct agent (`backend/assistant_agent.py`) with report fetch tools (`backend/assistant_tools.py`); max 3 tool rounds, `max_tokens=1000`.
- Unit tests: `test_narrative_schemas.py`, `test_clinical_guardrails.py`, `test_feature_context.py`.
### Changed
- Reorganized `.env.example` (single root file, removed unused `BACKEND_PORT` / duplicate `PORT`, outdated Settings UI key note).
- `docs/sop.md` — env setup uses one root `.env` instead of `backend/.env` + `.env.local`.
- Removed legacy OpenAI CV provider stub (`run_mediapipe_path` / partial analysis without `cvReport`); all assessments use full local CV. Settings OpenAI tab removed; `provider=openai` normalized to `local`.
- `POST /api/assessments/{id}/ai-protocol` now uses orchestrator (replaces monolithic `generate_protocol_narrative` for new bundles).
- Protocol JSON bundle stores `featureNarratives`; `GET /protocol` returns full PDF-ready bundle.
- `utils/qovesProtocolModel.js` fallback copy sanitized (no injectables/lasers/procedures in defaults).
- `ProtocolSideRail` label: Non-Surgical Protocol.
- Executive narrative and protocol action cards use structured JSON Schema output.
- Backend fallback PDF markdown notes Qoves client PDF as canonical when photo available.
### Added
- Unified backend text AI layer (`backend/text_ai_service.py`) for narrative, protocol, protocol narrative, and Beauty Assistant; shared non-surgical safety rules.
- Payment gating (`backend/ai_access.py`) on all AI endpoints (`402` when unpaid); Beauty Assistant hourly rate limit (20 messages/user/hour).
- `POST /api/assessments/{id}/ai-protocol` — server-side protocol generation persisted as `protocolData` + `protocolNarrative`.
- Beauty Assistant session summary compression (refresh after first exchange, then every 6 user messages) stored on `conversations.sessionSummary`.
- MongoDB `assistant_rate_limits` collection for hourly assistant quotas.
### Changed
- Redesigned downloaded PDF report pages 2, 3, and 4 to align with Qoves layout line-by-line, including vertical/horizontal dividers, even text distribution, and MyFace top-left text branding.
- Redesigned PDF cover page (Page 1) with a centered title, metadata fields grid, top and bottom border accent lines, and brand footers.
- Redesigned Page 5 (Client Protocol overview) with portrait BEFORE/AFTER images, description texts, and a mathematically-generated vector radar chart.
- Redesigned Page 6 (Hair Recommendations) with stacked BEFORE/AFTER hair crops, a programmatic 7-stage Norwood hairline diagram panel, a double-column text layout for hair loss details, and a dark-slate summary card.
- Redesigned Page 7 (Eyes), Page 8 (Nose), and Page 9 (Cheeks) to match visual screenshots, incorporating custom 4-section grids, vertical profile stacks, geometric analysis overlays, and full-width summary panels.
- Redesigned Page 10 (Jaw), Page 11 (Lips), and Page 12 (Chin) to match visual screenshots, incorporating profile stacks, lip crops, double geometric overlays, and summary panels/bars.
- Redesigned Page 13 (Skin), Page 14 (Neck), and Page 15 (Ears) to match visual screenshots, incorporating split images, vertical image stacks, antihelix/height overlays, and summary panels.
- Beauty Assistant context now includes `aiNarrative`, `protocolData`, and `protocolNarrative`; uses Groq/OpenAI via shared `llm_client`.
- Protocol AI generation routed through `backend/protocol_service.py` with local JSON storage (`protocol_storage.py`); frontend uses `GET /protocol` + `ensureAssessmentProtocol()`.
- `utils/protocolGenerator.js` removed (no client-side protocol generation).
- `Report.jsx` legacy markdown report tabs and `utils/openai.js` removed; Qoves `cvReport` view is the sole report surface.
### Removed
- `POST /api/generate-report`, `backend/openai_client.py`, `backend/beauty_assistant.py`, `utils/openai.js`, and `utils/protocolGenerator.js`.
### Added
- Qoves-faithful multi-view CV pipeline (v2): per-pose MediaPipe landmarking (`backend/multi_view.py`), ruler calibration step (`RulerCalibration.jsx`, `mouthWidthMm`/`philtrumLengthMm`), profile cephalometrics (`profile_cephalometrics.py`), quarter oblique analysis (`quarter_analysis.py`), smile dentofacial (`smile_analysis.py`), top-head hair analysis (`hair_analysis.py`).
- Photo persistence: `backend/photo_storage.py` saves all poses to `public/uploads/assessments/{id}/`; assessment `photos` map with URLs; `cvReport.photos` binding.
- Pre-prod checklist (`docs/pre-prod-checklist.md`) and photo storage architecture doc (`docs/architecture/photo-storage.md`).
- Unit tests: `backend/tests/test_calibration.py`, `test_photo_storage.py`, `test_profile_cephalometrics.py`.
### Changed
- Ears report section now shows **left and right profile** photos (not front face); `cvReport.ears` stores `imageSrcLeft` / `imageSrcRight` from persisted pose URLs.
### Added
- Dev-only auto-approve (`NEXT_PUBLIC_DEV_AUTO_APPROVE` + `DEV_AUTO_APPROVE_REPORTS`): skips admin review in dev. Delete `devConfig.js`, `backend/dev_config.py`, and unset env vars before prod.
### Fixed
- Facial assessment overlays: symmetry dots and proportion guides now use full-image coordinates with `object-contain` + SVG `meet` alignment (fixes misplaced landmarks on front photos).
- Orbital proportion tab aligned to Qoves (inter-eye spacing vs eye width); backend now generates ratio overlays and explanations.
- Prototypicality score: fixed inverted middle-third calculation that collapsed scores to ~9; explanations match Qoves tone.
- Dimorphism overview: richer Qoves-style narrative and per-feature explanations.
- Pipeline calibration vs Qoves: symmetry score recalibrated (8 mirror pairs incl. ears; typical faces ~72–82, not inflated 90+); naso-aural ratio measured from profile photo (nasion→subnasale vs visible ear span); front-view naso-aural marked `front_estimate` until profile enrichment.
- Prototypicality score recalibrated for MediaPipe landmarks: jaw width (172↔397), nose/cheek ratio (127↔356), updated cohort norms, softer penalty curve — typical faces now land ~70–80 (Qoves band) instead of collapsing to ~23.
### Changed
- `PhotoUpload.jsx` uses canonical `PHOTO_POSES` keys (7 poses: front, profiles, 45°, smile, topHead).
- `analyze_face.py` orchestrates multi-view analysis and enriches `cvReport` with profile, quarter, calibration, and meta fields.
- `POST /api/assessments` persists photos to disk and updates analysis with public URLs.
- MediaPipe `refine_landmarks=True` for improved lip/eye landmarks.
### Removed
- AWS Rekognition from backend: deleted `aws_rekognition.py`, `api_routes.py` (`/api/analyze-face`, `/api/test-aws`), `protocol_check.py`, and AWS report builder; removed `boto3` dependency. Analysis uses MediaPipe/OpenCV only (`local` / `openai` providers).
### Added
- Qoves-style frontend PDF overhaul: full-bleed cover, two-column disclaimer/privacy and closing pages, dumbbell feature comparison chart (replacing radar), per-feature two-column layouts with summary bars, empty AFTER image placeholders, and `generateProtocolNarrative()` for dense LLM copy with named actives/procedures.
- Shared `PRIVACY_PARAGRAPHS` and `LIMITATIONS_PARAGRAPH` in `utils/qovesProtocolModel.js`; PDF-quality crops via `cropFeatureBeforeForPdf()` and `cropProfileBefore()` in `utils/aestheticProjection.js`.
### Changed
- Protocol cover page (PDF + viewer): reverted to simple dark background without client photo; retains client name, date, and Aesthetic Protocol title.
- `buildFeaturePages()` accepts optional `protocolNarrative`; Eyes page has four subsections (Eyebrows, Eyelashes, Eyes, Under eye); Hair includes Hair Loss/Norwood staging.
- `Report.jsx` generates and passes `protocolNarrative` to PDF export and protocol viewer.
### Fixed
- Protocol feature images: prefer tight `cvReport` / `eyeAnalysis` crops over expanded live crops; cap bbox expansion (2.2×) so nose/lips don't become full-face; PROFILE slot only shown when a real profile photo exists.
- QOVES-style report web UI: gray collapsible sidebar TOC (`ReportNavSidebar`), document canvas shell (`ReportDocumentLayout`), Introduction/Disclaimer pages, flat per-section routing in `CvReportView`, shared `FeatureAnalysisPage` layout for feature panels, and HTML paginated Protocol viewer (`ProtocolDocumentViewer`) with `ProtocolSideRail` on the protocol section.
### Changed
- Report view: removed top Harmony/Symmetry metric strip and hardcoded `TreatmentProtocolCard`; defaults to Introduction; pending-review clients see intro/disclaimer only until **Approved**.
- Prototypicality CV engine (`prototypicalityEngine.js` / `backend/prototypicality.py`): demographic norms from questionnaire, per-feature deviations, feature-specific explanations, and precomputed wireframe paths on `cvReport.averageness` (no workflow changes — optional `answers` passthrough only).
- Protocol viewer scrolls vertically through the full document instead of horizontal page-by-page navigation.
### Changed
- Prototypicality engine: synthetic ideal wireframe (no user-landmark morph), full 0–100 score range, unified brow/eye-center thirds line, honest proportion-target copy; see `docs/architecture/prototypicality.md`.
### Changed
- Dashboard and report views now hide harmony/summary scores until an assessment is **Approved**; pending reports show an awaiting-review message instead.
- Assessment API responses now return display-cased workflow statuses (`Pending Review`, `Approved`) while still accepting lowercase/snake_case on input.
- Completed AuraScan → MyFace rebrand across the codebase: user-facing copy, `AGENTS.md`, architecture docs, `.env.example`, MongoDB/database examples, premium product id (`myface_report`), and browser `localStorage` keys (`myface_*`).
- Replaced the separate `QualityBadge` popup box (photo validation failed / passed) with **inline per-item status icons** in the REQUIRED list. Each guideline now shows: `○` idle (no photo), spinning (analyzing), `✓` green (pass), `‼` amber (warn), `✕` red (fail) — keyed to the active pose's validation checks via `GUIDELINE_CHECK_MAP`. Text color also updates (red/amber/neutral) to reinforce the status. Removed `QualityBadge` from both the desktop right panel and mobile upload zone.
- Made `PhotoUpload.jsx` both steps (confirmation & upload) fully responsive for small screens: layout switches from `h-screen` two-column to `min-h-screen` single-column on mobile, allowing natural scroll.
- On mobile, the confirmation checklist is now rendered **inline** in the left column (below the subtitle) using `lg:hidden`, so users can interact with it without the hidden right panel.
- On mobile, a compact upload zone with tap-to-upload, image preview, remove/change controls, and quality badge is injected inline between the poses grid and guidelines list using `lg:hidden`.
- Unified left panel width to `lg:w-[380px]` on both the confirmation checklist step and the upload images step in `PhotoUpload.jsx`.
- Shrunk the "Use all demo photos" button to a small inline text link (dev-only utility, not meant for production).
- Guidelines list on the upload step now shows all items without scrolling on `lg` screens (`lg:max-h-none lg:overflow-visible`); smaller screens retain the capped scrollable area.
- Extended `canAnalyze` gate in `PhotoUpload.jsx` to block continuation if **any uploaded optional pose** (right profile, left profile, top of head) also has a failed or warned validation result — not just the front photo.
- Changed `warn` overall results to be treated as a hard blocker: users must fix flagged issues on all uploaded photos before proceeding.
- Removed the "SECURE CONNECTION / © MYFACE EST. 2026" footer bar from the right panel of the photo upload step.
- Improved the Continue button hint message to show context-specific reasons (no front photo / front failed / other poses failed).
- Fixed `PhotoUpload.jsx` upload and instructions steps to use `h-screen overflow-hidden` so neither step requires page scrolling. Left panel now uses `flex-col` with a pinned footer (Continue button) and a scrollable middle section (`flex-1 min-h-0 overflow-y-auto`) for poses and guidelines.
- Redesigned `details`-type questions (medical conditions, medications, allergies, active infections) from a broken free-text input to a proper **Yes / No button pair**. Selecting "No" immediately enables Next. Selecting "Yes" reveals a textarea for specifics; Next is enabled only after at least 3 characters are entered. This eliminates all text-parsing validation ambiguity.
### Added
- Configured all questionnaire steps to require active page-level validation; marked `additionalNotes` as optional while strictly preventing next navigation on all other fields until an input is completed.
- Standardized details-type questions (such as medical conditions, medications, allergies, infections) to require page-level validation; removed default "No" values, added a `"yes/no"` placeholder, and disabled next navigation until a valid answer is typed.
- Configured questionnaire back navigation route states to initialize the index pointer to the last question (Question 23) when returning from photo upload views.
- Harmonized the photo upload flow colors by replacing standard `teal-400` classes in `PhotoUpload.jsx` with the exact brand green hex code (#5e9f8b).
- Redesigned the photo upload flow in `PhotoUpload.jsx` with a requirements confirmation page (left column instructions, right column guidelines checkboxes checklist container) and upload dashboard screen.
- Set the file upload area inside the dark visual panel as a responsive glassmorphic dropzone supporting JPEG, PNG, and WEBP formats.
- Standardized the user dashboard header in `DashboardPage.jsx` with the `MyFace` serif brand logo and aligned quick action controllers (Refresh, Start New Analysis).
- Replicated the premium document-viewer layout for the client report with a three-column grid containing page previews on the left, executive dashboard in the center, and a sticky treatment protocol list on the right.
- Created a high-density facial landmark SVG mapping overlay rendering all 478 points of the MediaPipe Face Mesh on the Potential profile face scan.
- Translated all client report dashboard titles, metadata keys, chronological age timelines, and treatment protocol guidelines to English.
- Replaced the invalid dark:bg-slate-850 button style class on the dashboard with a valid high-contrast outline scheme.
- Fixed the dashboard page background class to use the theme surface token, resolving dark mode grey fallbacks.
- Created `theme.md` outlining the strict styling constraints, brand green hex values (#5e9f8b / #548f7d), and border-radius rules.
- Overrode Tailwind's default configuration colors in `tailwind.config.js` to map the `brand` and `accent` categories to the new brand green shade, aligning all components (progress bars, status badges, scales) automatically.
- Updated `.btn-primary` and `.btn-ghost` components in `app/globals.css` to use pill-shaped `rounded-[50px]` and custom tracking.
- Styled photo guidelines next action button inside `PhotoUpload.jsx` and report download/retry buttons in `Report.jsx` to match this theme.
- Renamed the welcome component to `QuestionnaireWelcome.jsx` for easy understanding and updated all routing hooks in `App.jsx`.
- Forced the questionnaire right-hand split-screen panel to utilize a static dark `bg-[#0d1e1f]` background in both light and dark modes, ensuring white text remains fully readable.
- Integrated the questionnaire animations directly into the global stylesheet `app/globals.css` to guarantee Next.js bundles them correctly across client views.
- Redesigned the user dashboard (`components/DashboardPage.jsx`) to adopt the visual aesthetics and content structure of `myface.club`, including a light mint-green/teal layout, scientific progress bars for symmetry and proportion, and a step-by-step onboarding guide.
- Renamed the start questionnaire welcome page from `Landing.jsx` to `Welcome.jsx` and updated imports/references in `App.jsx` to match.
- Adjusted the "Get Started" and "Next" button design to align the separator `|` closer to the right arrow.
- Removed the "AuraScan" text brand from the right-side logo panel on both welcome and questionnaire screens.
- Revamped the onboarding questionnaire UI to support a one-question-at-a-time layout.
- Added a fluid, animated mesh gradient background to the desktop view side panel.
- Refactored the welcome page (`components/Landing.jsx`) to share the same responsive split-screen theme.
- Cleared all default initial answers to prompt the user to input fresh responses.
- Consolidated the question set to precisely follow the 23-question QOVES reference flow, conditionalizing beard queries on masculine aesthetics.
- Updated the onboarding questionnaire wizard to include all 23 questions from the QOVES reference site.
- Realigned project roadmap, requirements, and backlog to follow the newly agreed 3-milestone contract (Milestone 1: Core Onboarding & OpenAI Vision Analysis; Milestone 2: Gated Report, PDF & Stripe; Milestone 3: AI Visuals, Assistant & Admin Panel).
- Proposed visual radar charts for the client report summary dashboard.
- Proposed SVG overlays mapping calculated Face Mesh angles.

## [1.1.0] - 2026-07-08
### Added
- Standardized documentation layout pointing to `AGENTS.md` rules.
- Added Architectural Decision Records (ADRs) to track key system design choices.
- Created `docs/architecture/` subdirectory containing domain model schemas, live API endpoint contracts, and hard coding constraints.
- Integrated a Standard Operating Procedures (`docs/sop.md`) handbook for deployment on Replit and integration of Stripe/PayPal sandbox portals.

### Changed
- Reorganized `docs/` folder structure, consolidating legacy setup files (`MONGODB_SETUP.md`, `REPLIT_SETUP.md`, `SERVICE_SETUP.md`, `HANDOVER_CHECKLIST.md`, `SPRINT_LOG.md`) into systematic modular files.
- Replaced `.cursorrules` and `CLAUDE.md` with lightweight pointers to `AGENTS.md`.

---

## [1.0.0] - 2026-07-07
### Added
- Implemented user and admin roles registration (`/api/auth/register`, `/api/auth/login`).
- Added database persistence using MongoDB Atlas cluster via async Motor driver.
- Created Stripe Checkout and PayPal Orders v2 transaction flows.
- Built an admin review workspace allowing administrators to write notes, modify client narratives, and publish results.
- Added dynamic ReportLab server-side PDF compiler gated on report status rules.
- Created client-side questionnaire branching flows.
- Integrated event tracking logic for Google Tag Manager and Meta Pixel events.
- Added grounding context-aware Beauty Assistant chatbot utilizing OpenAI.
- Added prompt fallbacks for AI hairstyles, outfit styles, and aging simulation images.

### Changed
- Configured environment-gated CORS policies to secure the FastAPI server under public origins.
- Set up `replit-start.sh` and configuration scripts for standard execution.

---

## [0.2.0] - 2026-07-02
### Changed
- Migrated frontend framework from Vite + React to Next.js 15 App Router directory context.
- Configured dynamic PostCSS settings to correct module build errors.
- Shifted application mode configuration variables from `.env` keys into LocalStorage-based Settings UI options.

---

## [0.1.0] - 2026-06-22
### Added
- Initial commit of AuraScan facial analysis proof of concept.
- Added local browser-based MediaPipe landmark calculations and canvas image pixel skin testing.
