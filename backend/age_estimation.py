"""MiVOLO v2 age estimation module with soft-failing lazy singleton pattern."""

from __future__ import annotations

import logging
import threading
from typing import Optional, Tuple

import cv2
import numpy as np

logger = logging.getLogger(__name__)

_app_lock = threading.Lock()
_mivolo_model: Optional[object] = None
_mivolo_processor: Optional[object] = None
_mivolo_initialized: bool = False


def _get_mivolo_app() -> Tuple[Optional[object], Optional[object]]:
    """Lazy loader singleton for MiVOLO v2 model and processor."""
    global _mivolo_model, _mivolo_processor, _mivolo_initialized
    if _mivolo_initialized:
        return _mivolo_model, _mivolo_processor

    with _app_lock:
        if _mivolo_initialized:
            return _mivolo_model, _mivolo_processor

        _mivolo_initialized = True
        try:
            import torch
            from transformers import AutoImageProcessor, AutoModelForImageClassification

            model = AutoModelForImageClassification.from_pretrained(
                "iitolstykh/mivolo_v2", trust_remote_code=True, torch_dtype=torch.float32
            )
            model.eval()
            processor = AutoImageProcessor.from_pretrained(
                "iitolstykh/mivolo_v2", trust_remote_code=True
            )
            _mivolo_model = model
            _mivolo_processor = processor
            logger.info("MiVOLO v2 age model loaded successfully.")
        except Exception as exc:
            logger.warning("MiVOLO v2 initialization skipped or failed: %s", exc)
            _mivolo_model = None
            _mivolo_processor = None

    return _mivolo_model, _mivolo_processor


def _prepare_mivolo_input(img: np.ndarray, target_size: int = 384) -> torch.Tensor:
    """Preprocess image matching MiVOLOImageProcessor logic without requiring third-party package imports."""
    import torch

    # Scale and letterbox pad image to target size
    h, w = img.shape[:2]
    scale = min(target_size / h, target_size / w)
    new_w, new_h = int(round(w * scale)), int(round(h * scale))

    if (h, w) != (new_h, new_w):
        resized = cv2.resize(img, (new_w, new_h), interpolation=cv2.INTER_LINEAR)
    else:
        resized = img.copy()

    dw, dh = (target_size - new_w) / 2, (target_size - new_h) / 2
    top, bottom = int(round(dh - 0.1)), int(round(dh + 0.1))
    left, right = int(round(dw - 0.1)), int(round(dw + 0.1))
    padded = cv2.copyMakeBorder(resized, top, bottom, left, right, cv2.BORDER_CONSTANT, value=(0, 0, 0))

    # Convert BGR to RGB and normalize (ImageNet mean & std)
    rgb = cv2.cvtColor(padded, cv2.COLOR_BGR2RGB).astype(np.float32) / 255.0
    mean = np.array([0.485, 0.456, 0.406], dtype=np.float32)
    std = np.array([0.229, 0.224, 0.225], dtype=np.float32)
    norm = (rgb - mean) / std

    tensor = torch.from_numpy(norm.transpose(2, 0, 1)).unsqueeze(0).to(torch.float32)
    return tensor


def estimate_visual_age_and_gender(image_bytes: bytes) -> Optional[dict]:
    """Estimate visual age and gender using MiVOLO v2 model.

    Returns dict with:
      - 'age': int clamped to [14, 70]
      - 'gender': 'masculine' | 'feminine'
      - 'gender_confidence': float (0.0 to 1.0)
    Returns None if mivolo model is missing, model fails, or face evaluation fails.
    """
    if not image_bytes:
        return None

    model, _ = _get_mivolo_app()
    if model is None:
        return None

    try:
        import torch

        arr = np.frombuffer(image_bytes, np.uint8)
        img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
        if img is None:
            return None

        face_tensor = _prepare_mivolo_input(img)

        with torch.no_grad():
            body_tensor = torch.zeros_like(face_tensor)
            outputs = model(faces_input=face_tensor, body_input=body_tensor)

        raw_age = float(outputs.age_output.item())
        age_int = max(14, min(70, int(round(raw_age))))

        # MiVOLO v2 gender classification: 0 -> male ("masculine"), 1 -> female ("feminine")
        gender_idx = int(outputs.gender_class_idx.item()) if hasattr(outputs, "gender_class_idx") else 0
        gender_str = "feminine" if gender_idx == 1 else "masculine"
        gender_conf = float(outputs.gender_probs.item()) if hasattr(outputs, "gender_probs") else 1.0

        return {
            "age": age_int,
            "gender": gender_str,
            "gender_confidence": round(gender_conf, 3),
        }
    except Exception as exc:
        logger.warning("MiVOLO v2 age & gender estimation error: %s", exc)
        return None


def estimate_visual_age(image_bytes: bytes) -> Optional[int]:
    """Estimate visual age using MiVOLO v2 model.

    Returns None if mivolo model is missing, model fails, or face evaluation fails.
    Clamps predicted age to sane range [14, 70].
    """
    res = estimate_visual_age_and_gender(image_bytes)
    return res["age"] if res else None

