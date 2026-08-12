"""Central model store — path helpers + timeout-bounded downloads.

All downloadable CV weights resolve under a single root (CV_MODELS_ROOT).
Ear: models/ear_landmarker.pth
HF models: models/huggingface/ (cache_dir for transformers/hub)

Downloads are atomic (tmp + replace), size-checked, and socket-timeout bounded.
"""

from __future__ import annotations

import concurrent.futures
import logging
import os
import socket
import threading
import urllib.request
from pathlib import Path
from typing import Optional
from urllib.error import URLError

from .config import (
    REPO_ROOT,
    CV_MODELS_ROOT_DEFAULT,
    CV_MODEL_DOWNLOAD_TIMEOUT_SEC_DEFAULT,
    CV_MODEL_PRELOAD_TIMEOUT_SEC_DEFAULT,
    CV_MODEL_PRELOAD_DEFAULT,
)

logger = logging.getLogger(__name__)

_DEFAULT_MODELS_ROOT = CV_MODELS_ROOT_DEFAULT
_DEFAULT_DOWNLOAD_TIMEOUT_SEC = CV_MODEL_DOWNLOAD_TIMEOUT_SEC_DEFAULT
_DEFAULT_PRELOAD_TIMEOUT_SEC = CV_MODEL_PRELOAD_TIMEOUT_SEC_DEFAULT
_DEFAULT_PRELOAD_ENABLED = CV_MODEL_PRELOAD_DEFAULT

_ear_download_lock = threading.Lock()
_hf_download_lock = threading.Lock()

MIVOLO_MODEL_ID = "iitolstykh/mivolo_v2"
FACE_PARSING_MODEL_ID = "jonathandinu/face-parsing"


def models_root() -> Path:
    """Return the central CV models root directory, creating it if needed."""
    root_env = os.environ.get("CV_MODELS_ROOT")
    if root_env and root_env.strip():
        root = Path(root_env.strip()).resolve()
    else:
        root = _DEFAULT_MODELS_ROOT
    root.mkdir(parents=True, exist_ok=True)
    return root


def ear_weights_path() -> Path:
    """Return the canonical ear landmarker weights path under models root."""
    return models_root() / "ear_landmarker.pth"


def hf_cache_dir() -> Path:
    """Return the HuggingFace cache directory under models root, creating it if needed."""
    hf_dir = models_root() / "huggingface"
    hf_dir.mkdir(parents=True, exist_ok=True)
    return hf_dir


def download_timeout_sec() -> int:
    """Per-download socket timeout in seconds (env override)."""
    raw = os.environ.get("CV_MODEL_DOWNLOAD_TIMEOUT_SEC")
    if raw and raw.strip():
        try:
            return max(1, int(raw.strip()))
        except ValueError:
            pass
    return _DEFAULT_DOWNLOAD_TIMEOUT_SEC


def preload_timeout_sec() -> int:
    """Overall preload wall-clock timeout in seconds (env override)."""
    raw = os.environ.get("CV_MODEL_PRELOAD_TIMEOUT_SEC")
    if raw and raw.strip():
        try:
            return max(1, int(raw.strip()))
        except ValueError:
            pass
    return _DEFAULT_PRELOAD_TIMEOUT_SEC


def preload_enabled() -> bool:
    """Whether background preload runs after boot (env override)."""
    raw = os.environ.get("CV_MODEL_PRELOAD", "true" if _DEFAULT_PRELOAD_ENABLED else "false")
    return raw.strip().lower() not in ("0", "false", "no", "off")


def _auto_download_enabled() -> bool:
    """Legacy ear-specific download gate (EAR_LANDMARKER_AUTO_DOWNLOAD)."""
    raw = os.environ.get("EAR_LANDMARKER_AUTO_DOWNLOAD", "true").strip().lower()
    return raw not in ("0", "false", "no", "off")


def _landmarker_url() -> str:
    """Ear landmarker download URL (env override)."""
    default = (
        "https://github.com/PeizhiYan/flame-head-tracker/releases/download/resource/ear_landmarker.pth"
    )
    env = os.environ.get("EAR_LANDMARKER_URL", "").strip()
    return env or default


def download_url_to_file(
    url: str,
    dest: Path,
    timeout_sec: Optional[int] = None,
    min_size_bytes: int = 1_000_000,
) -> bool:
    """Download a URL to dest with socket timeout + atomic write + size check.

    Returns True on success, False on failure (logs warning, cleans up tmp).
    """
    if timeout_sec is None:
        timeout_sec = download_timeout_sec()

    dest.parent.mkdir(parents=True, exist_ok=True)
    tmp = dest.with_suffix(dest.suffix + ".download")

    old_timeout = socket.getdefaulttimeout()
    socket.setdefaulttimeout(timeout_sec)
    try:
        logger.info("Downloading %s → %s (timeout=%ss)", url, dest, timeout_sec)
        urllib.request.urlretrieve(url, str(tmp))
    except (URLError, socket.timeout, OSError, TimeoutError) as exc:
        logger.warning("Download failed for %s: %s", url, exc)
        _cleanup_tmp(tmp)
        return False
    finally:
        socket.setdefaulttimeout(old_timeout)

    try:
        size = tmp.stat().st_size
        if size < min_size_bytes:
            logger.warning("Downloaded file too small (%d bytes, min %d)", size, min_size_bytes)
            _cleanup_tmp(tmp)
            return False
    except OSError:
        _cleanup_tmp(tmp)
        return False

    try:
        tmp.replace(dest)
        logger.info("Downloaded %s (%s MB)", dest.name, round(dest.stat().st_size / 1e6, 1))
        return True
    except OSError as exc:
        logger.warning("Atomic replace failed for %s: %s", dest, exc)
        _cleanup_tmp(tmp)
        return False


def _cleanup_tmp(tmp: Path) -> None:
    try:
        if tmp.is_file():
            tmp.unlink()
    except OSError:
        pass


def _resolve_ear_dest(path: Optional[Path] = None) -> Path:
    if path is not None:
        return Path(path)
    env = (os.environ.get("EAR_LANDMARKER_PATH") or "").strip()
    if env:
        return Path(env)
    return ear_weights_path()


def ensure_ear_landmarker_weights(path: Optional[Path] = None) -> Optional[Path]:
    """Ensure ear landmarker weights exist locally, downloading if needed.

    Args:
        path: Explicit destination (tests / ops). When None, uses EAR_LANDMARKER_PATH
              if set, otherwise the canonical ``ear_weights_path()``.
    """
    dest = _resolve_ear_dest(path)
    if dest.is_file():
        return dest

    if not _auto_download_enabled():
        logger.warning("Ear landmarker weights missing at %s and auto-download is off.", dest)
        return None

    # One-shot legacy copy into the *central* path only.
    if dest == ear_weights_path():
        legacy = REPO_ROOT / "ear_landmarker.pth"
        if legacy.is_file():
            try:
                import shutil

                logger.info("Copying legacy ear_landmarker.pth from repo root to %s", dest)
                dest.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(legacy, dest)
                return dest
            except OSError as exc:
                logger.warning("Failed to copy legacy ear weights: %s", exc)

    with _ear_download_lock:
        if dest.is_file():
            return dest
        if download_url_to_file(_landmarker_url(), dest):
            return dest
    return None


def _snapshot_download_with_timeout(
    repo_id: str,
    cache_dir: str,
    *,
    allow_patterns: Optional[list[str]] = None,
) -> None:
    """Run huggingface_hub.snapshot_download bounded by CV_MODEL_DOWNLOAD_TIMEOUT_SEC.

    Files within a snapshot are fetched one-at-a-time (max_workers=1) so preload
    logs stay readable and models never race each other on the wire.
    """
    from huggingface_hub import snapshot_download

    timeout = download_timeout_sec()

    def _run() -> None:
        kwargs: dict = {
            "repo_id": repo_id,
            "cache_dir": cache_dir,
            "local_files_only": False,
            "max_workers": 1,
        }
        if allow_patterns is not None:
            kwargs["allow_patterns"] = allow_patterns
        snapshot_download(**kwargs)

    with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
        fut = pool.submit(_run)
        try:
            fut.result(timeout=timeout)
        except concurrent.futures.TimeoutError as exc:
            raise TimeoutError(f"snapshot_download timed out after {timeout}s for {repo_id}") from exc


def ensure_mivolo_weights() -> bool:
    """Ensure MiVOLO weights are cached under models/huggingface."""
    try:
        from huggingface_hub import snapshot_download
    except ImportError:
        logger.warning("huggingface_hub not installed — cannot ensure MiVOLO weights")
        return False

    cache_dir = str(hf_cache_dir())
    with _hf_download_lock:
        try:
            try:
                snapshot_download(
                    repo_id=MIVOLO_MODEL_ID,
                    cache_dir=cache_dir,
                    local_files_only=True,
                    max_workers=1,
                )
                return True
            except Exception:
                pass

            logger.info("Ensuring MiVOLO weights in %s", cache_dir)
            _snapshot_download_with_timeout(MIVOLO_MODEL_ID, cache_dir)
            return True
        except Exception as exc:
            logger.warning("MiVOLO weights ensure failed: %s", exc)
            return False


# Only what SegformerForSemanticSegmentation / SegformerImageProcessor need —
# not onnx/, pytorch_model.bin (duplicate of safetensors), demo.png, etc.
_FACE_PARSING_ALLOW_PATTERNS = [
    "config.json",
    "preprocessor_config.json",
    "model.safetensors",
]


def ensure_face_parsing_weights() -> bool:
    """Ensure SegFormer face parsing weights are cached under models/huggingface.

    Downloads only the transformers load set (~340MB safetensors + configs),
    not the full HF repo (~1.1GB with ONNX + duplicate .bin).
    """
    try:
        from huggingface_hub import snapshot_download
    except ImportError:
        logger.warning("huggingface_hub not installed — cannot ensure face parsing weights")
        return False

    cache_dir = str(hf_cache_dir())
    with _hf_download_lock:
        try:
            try:
                snapshot_download(
                    repo_id=FACE_PARSING_MODEL_ID,
                    cache_dir=cache_dir,
                    local_files_only=True,
                    allow_patterns=_FACE_PARSING_ALLOW_PATTERNS,
                    max_workers=1,
                )
                return True
            except Exception:
                pass

            logger.info(
                "Ensuring face parsing weights in %s (allow_patterns=%s)",
                cache_dir,
                _FACE_PARSING_ALLOW_PATTERNS,
            )
            _snapshot_download_with_timeout(
                FACE_PARSING_MODEL_ID,
                cache_dir,
                allow_patterns=_FACE_PARSING_ALLOW_PATTERNS,
            )
            return True
        except Exception as exc:
            logger.warning("Face parsing weights ensure failed: %s", exc)
            return False


def ensure_all_cv_weights() -> dict[str, str]:
    """Ensure all CV model weights are available locally, one model at a time.

    Returns a status dict per model: 'ready' | 'skipped' | 'timeout' | 'error'.
    """
    status: dict[str, str] = {}

    logger.info("CV weight ensure [1/3] ear_landmarker…")
    try:
        if ensure_ear_landmarker_weights() is not None:
            status["ear_landmarker"] = "ready"
        else:
            status["ear_landmarker"] = "skipped"
    except Exception as exc:
        logger.warning("Ear landmarker ensure error: %s", exc)
        status["ear_landmarker"] = "error"
    logger.info("CV weight ensure [1/3] ear_landmarker → %s", status["ear_landmarker"])

    logger.info("CV weight ensure [2/3] mivolo…")
    try:
        if ensure_mivolo_weights():
            status["mivolo"] = "ready"
        else:
            status["mivolo"] = "skipped"
    except Exception as exc:
        logger.warning("MiVOLO ensure error: %s", exc)
        status["mivolo"] = "error"
    logger.info("CV weight ensure [2/3] mivolo → %s", status["mivolo"])

    logger.info("CV weight ensure [3/3] face_parsing…")
    try:
        raw = os.environ.get("FACE_PARSING_ENABLED", "true").lower()
        if raw in ("0", "false", "no", "off"):
            status["face_parsing"] = "skipped"
        elif ensure_face_parsing_weights():
            status["face_parsing"] = "ready"
        else:
            status["face_parsing"] = "skipped"
    except Exception as exc:
        logger.warning("Face parsing ensure error: %s", exc)
        status["face_parsing"] = "error"
    logger.info("CV weight ensure [3/3] face_parsing → %s", status["face_parsing"])

    return status
