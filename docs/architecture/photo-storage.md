# Photo / Media Storage Architecture

## Overview

All assessment media (pose photos, SegFormer parsing crops, projected AFTER images, protocol JSON) is stored and read through a single interface, `MediaStorage` (`backend/media_storage.py`), so the same code runs on local disk in dev and on Replit Object Storage in production without changing API contracts. See [ADR-030](decisions.md).

## Interface

`get_media_storage()` returns the active backend. Methods: `put_bytes(key, data)`, `get_bytes(key) -> bytes | None`, `delete(key)`, `delete_prefix(prefix)`, `exists(key)`.

Keys are forward-slash paths under the `assessments/` namespace:

- `assessments/{id}/{poseId}.jpg`
- `assessments/{id}/parsing/{featureId}.jpg`
- `assessments/{id}/projected/full.{jpg|png}`
- `assessments/{id}/protocol.json`

`StoredPhoto.relativePath` is the key; `publicUrl` is `/api/media/{key}`.

## Backends

Selected by `MEDIA_STORAGE_BACKEND`. Unset = auto-detect: `replit` inside a Replit env, else `local`. **No runtime fallback** — a misconfigured `replit` backend raises rather than silently writing to disk.

| Backend | When | Config |
|---------|------|--------|
| `local` (`LocalMediaStorage`) | Local dev / Windows / tests | `MEDIA_LOCAL_ROOT` (default `<repo>/var/media`, gitignored) |
| `replit` (`ReplitObjectMediaStorage`) | Replit runtime | `.replit` `[objectStorage] defaultBucketID` (auto), or `REPLIT_DEFAULT_BUCKET_ID` to override; needs `replit-object-storage` (Python <3.13) |

## Serving

`GET /api/media/{object_key}` (`backend/routers/media.py`) streams bytes from the active backend. It only serves keys under `assessments/`, sets a content-type by extension, and is open (matching the prior public `/uploads` behavior). Next proxies `/api/*` to the backend in dev; the Replit app router does the same in prod — so `/api/media/...` URLs are identical and same-origin everywhere (keeps client-side canvas pixel reads CORS-clean).

## Assessment schema (Postgres JSONB)

```json
{
  "photosKeys": ["front", "rightProfile"],
  "photos": {
    "front": {
      "poseId": "front",
      "relativePath": "assessments/abc/front.jpg",
      "publicUrl": "/api/media/assessments/abc/front.jpg",
      "contentType": "image/jpeg",
      "byteSize": 245000,
      "storedAt": "2026-07-15T12:00:00Z"
    }
  }
}
```

## API flow

1. `POST /api/assessments` — decode photos, run CV pipeline
2. Create assessment record → `assessmentId`
3. `save_all_poses()` writes each pose via the media backend (keys `assessments/{id}/...`)
4. `apply_photo_urls_to_cv_report()` binds `/api/media/...` URLs into `cvReport`
5. `update_assessment_analysis()` persists photos map + updated analysis
6. One-shot NL enrichment — `aiNarrative` + protocol/feature narratives (idempotent; not re-run on report open)

## Notes / follow-ups

- Owner-only access via short-lived signed media tokens on `/api/media` is deferred; the route is the hook for it. See [pre-prod-checklist.md](../pre-prod-checklist.md).
- Legacy on-disk assessments need a one-time byte upload into the bucket to display after cutover to `replit`. `media_key_from_ref` still accepts legacy `/uploads/...` refs.

## Modules

- [`backend/media_storage.py`](../../backend/media_storage.py) — interface + backends
- [`backend/photo_storage.py`](../../backend/photo_storage.py) — pose / parsing / projected persistence
- [`backend/protocol_storage.py`](../../backend/protocol_storage.py) — protocol JSON
- [`backend/routers/media.py`](../../backend/routers/media.py) — `GET /api/media/{key}`
