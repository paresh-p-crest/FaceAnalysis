"""
DEV ONLY — delete this module before production.

Unset DEV_AUTO_APPROVE_REPORTS in .env and remove imports from:
  - backend/report_status.py
  - backend/routers/assessments.py
"""

from __future__ import annotations

import os


def dev_auto_approve_reports() -> bool:
    """When true, new assessments are created as approved and PDF gates are bypassed."""
    return os.environ.get("DEV_AUTO_APPROVE_REPORTS", "").strip().lower() in ("1", "true", "yes")
