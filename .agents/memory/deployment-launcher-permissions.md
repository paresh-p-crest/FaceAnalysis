---
name: Deployment launcher permissions
description: Artifact production shell launchers must be executable for VM publishing.
---

The artifact's production `run` command may fail before startup if it points to a shell script with mode `0644`, or if a direct script path assumes the wrong working directory; publishing can build the image successfully but the VM then never becomes ready.

**Why:** The publish build completed compilation and image creation, but the VM startup failed because the launcher returned `Permission denied`.

**How to apply:** When an artifact uses a shell script as its production run command, verify it has executable mode (`0755`) and smoke-test the exact artifact production command from the workspace root. Prefer the package-aware command that changes into the artifact directory before invoking a relative launcher.