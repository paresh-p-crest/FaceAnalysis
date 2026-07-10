# Photo Storage Architecture

## Overview

Assessment photos are persisted per pose under a storage abstraction so dev uses local public files and production can switch to S3/R2 without changing API contracts.

## Dev (current)

| Setting | Default |
|---------|---------|
| `PHOTO_STORAGE_BACKEND` | `local` |
| `PHOTO_UPLOAD_ROOT` | `{repo}/public/uploads/assessments` |
| `PHOTO_PUBLIC_URL_PREFIX` | `/uploads/assessments` |

Files: `public/uploads/assessments/{assessmentId}/{poseId}.jpg`

Served by Next.js static hosting at `/uploads/...`.

## MongoDB schema

```json
{
  "photosKeys": ["front", "rightProfile"],
  "photos": {
    "front": {
      "poseId": "front",
      "relativePath": "uploads/assessments/abc/front.jpg",
      "publicUrl": "/uploads/assessments/abc/front.jpg",
      "contentType": "image/jpeg",
      "byteSize": 245000,
      "storedAt": "2026-07-09T12:00:00Z"
    }
  }
}
```

## API flow

1. `POST /api/assessments` — decode photos, run CV pipeline
2. Create assessment record → `assessmentId`
3. `save_all_poses()` writes each pose to disk
4. `apply_photo_urls_to_cv_report()` binds URLs into `cvReport`
5. `update_assessment_analysis()` persists photos map + updated analysis
6. One-shot NL enrichment — `aiNarrative` + protocol/feature narratives (idempotent; not re-run on report open)

## Production migration (planned)

Implement `S3PhotoStorage` with same interface as `LocalPublicPhotoStorage`:

- Private bucket
- Pre-signed GET URLs
- Lifecycle rules for deletion

See [pre-prod-checklist.md](../pre-prod-checklist.md).

## Module

[`backend/photo_storage.py`](../../backend/photo_storage.py)
