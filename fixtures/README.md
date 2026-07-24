# Fixtures

Local anonymized snapshots for debugging PDF/report logic without hitting the database.

| File | Purpose |
|------|---------|
| `assessment_sample_full.json` | Full assessment `6a50ffd35bbda00b859510d4` (photos as path metadata only; landmarks truncated; PII redacted). |
| `assessment_6a50ffd3_profile_slice.json` | Just `cvReport.profile` (+ jaw/chin) for that assessment — chin overlay debugging. |
| `profile_chin_overlay_sample.json` | Compact profile overlay + measurements sample (older assessment shape). |

Chin PDF guides read `assessment.analysis.cvReport.profile.primary.overlay` (`convexityPoints`, `eLine`) on center-cover PROFILE frames. Implausible overlays are rebuilt from MediaPipe at PDF export.
