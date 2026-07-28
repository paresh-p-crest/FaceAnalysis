---
name: Next dev cache race
description: Next.js development and production builds can corrupt the shared generated cache when run concurrently.
---

Never run `next build` while the MyFace Next dev workflow is actively rebuilding the same `.next` directory. The result can be transient missing chunks, manifests, or React client-manifest errors even when the source is valid.

**Why:** The app uses one shared `.next` output directory for both commands, and concurrent writes caused false 500 responses and missing generated files during verification.

**How to apply:** Stop or restart the dev workflow before running a production build, and if the preview shows missing chunks afterward, remove the generated `.next` directory and restart the workflow before diagnosing application code.