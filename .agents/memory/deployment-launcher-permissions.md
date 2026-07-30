---
name: Deployment launcher permissions
description: Artifact production shell launchers must be executable and must not preserve pnpm symlink paths for VM publishing.
---

The artifact's production `run` command may fail before startup if it points to a shell script with mode `0644`, assumes the wrong working directory, or exports `NODE_PRESERVE_SYMLINKS=1` with pnpm-managed dependencies; publishing can build the image successfully but the VM then never becomes ready.

**Why:** The publish build completed compilation and image creation, but the VM startup failed because the launcher either could not execute or Node could not resolve transitive dependencies from symlinked pnpm package paths.

**How to apply:** When an artifact uses a shell script as its production run command, verify it has executable mode (`0755`), LF line endings, and smoke-test the exact root deployment command from the workspace root. Explicitly `unset NODE_PRESERVE_SYMLINKS` before starting Node when using pnpm workspaces.