# Pre-Production Deployment Checklist

Gate items before deploying MyFace to production. Photo storage and biometric data require extra care.

## Media storage (ADR-030)

- [ ] Set `MEDIA_STORAGE_BACKEND=replit` on Replit (or leave unset — auto-detects Replit)
- [ ] Confirm `replit-object-storage` is installed and `.replit` `[objectStorage] defaultBucketID` resolves (or set `REPLIT_DEFAULT_BUCKET_ID`)
- [ ] Verify `GET /api/media/assessments/{id}/front.jpg` returns HTTP 200 in the deployed env
- [ ] Decide on owner-only access: add short-lived signed media tokens on `/api/media` before exposing biometric photos publicly (currently open)
- [ ] Confirm local media dir `var/media/` is gitignored and never committed
- [ ] (Optional) Migrate legacy on-disk assessment bytes into the bucket so old reports still display

## Security & compliance

- [ ] Add user data deletion endpoint (assessment + photos + conversations)
- [ ] Define photo retention policy (e.g. 90 days after account deletion)
- [ ] Enforce max upload size per pose (recommend 10 MB)
- [ ] Validate image magic bytes server-side (not only MIME from client)
- [ ] Optional: virus scan on upload

## Pipeline verification

- [ ] All 7 pose keys persist when uploaded: `front`, `leftProfile`, `rightProfile`, `left45`, `right45`, `smile`, `topHead`
- [ ] `assessment.photos` map populated with `publicUrl` per pose
- [ ] `cvReport.photos` URLs return HTTP 200 when loaded in report
- [ ] Profile cephalometrics populate when `rightProfile` or `leftProfile` uploaded (angles/ratios; no ruler/mm scale)
- [ ] Run `python scripts/smoke_test.py` against staging

## Backup & ops

- [ ] Backup strategy for assessment photos (S3 versioning or daily sync)
- [ ] Monitor disk usage if still on local storage during staging
- [ ] Document incident response for accidental public exposure

## Known limitations (accept or mitigate)

- MediaPipe 478 pts vs Qoves 521–529 — profile metrics are best-effort
- No 3D multi-view fusion
- Ethnicity norms are hardcoded tables, not live cohort DB
