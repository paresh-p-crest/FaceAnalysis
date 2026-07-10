"""Application logging helpers — ensure backend logs show under uvicorn."""

from __future__ import annotations

import logging
import os
import sys


def configure_backend_logging() -> None:
    """Make `backend.*` loggers visible in the uvicorn terminal."""
    level_name = (os.environ.get("LOG_LEVEL") or "INFO").strip().upper()
    level = getattr(logging, level_name, logging.INFO)

    root = logging.getLogger()
    if not root.handlers:
        logging.basicConfig(
            level=level,
            format="%(levelname)s:\t%(name)s — %(message)s",
            stream=sys.stderr,
        )
    else:
        root.setLevel(min(root.level or level, level))

    backend = logging.getLogger("backend")
    backend.setLevel(level)
    backend.propagate = True

    # Mirror uvicorn's handlers so INFO lines appear next to access logs
    for name in ("uvicorn", "uvicorn.error", "uvicorn.access"):
        parent = logging.getLogger(name)
        for handler in parent.handlers:
            if handler not in backend.handlers:
                backend.addHandler(handler)
        if parent.handlers:
            backend.propagate = False
            break
