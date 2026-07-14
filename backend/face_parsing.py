"""SegFormer face parsing — segmentation and per-feature crops."""

from __future__ import annotations

import io
import logging
import os
from functools import lru_cache
from typing import Any, Optional

import cv2
import numpy as np
from PIL import Image

logger = logging.getLogger(__name__)

LABEL_MAP = {
    0: "background",
    1: "skin",
    2: "nose",
    3: "eye_g",
    4: "left_eye",
    5: "right_eye",
    6: "left_eyebrow",
    7: "right_eyebrow",
    8: "left_ear",
    9: "right_ear",
    10: "mouth",
    11: "upper_lip",
    12: "lower_lip",
    13: "hair",
    14: "hat",
    15: "earring",
    16: "necklace",
    17: "neck",
    18: "cloth",
}

FEATURE_LABEL_GROUPS: dict[str, list[int]] = {
    "eyebrows": [6, 7],
    "eyes": [4, 5],
    "nose": [2],
    "lips": [11, 12],
    "cheeks": [1],
    "jaw": [1, 17],
    "chin": [1, 12],
    "hair": [13],
    "ears": [8, 9],
    "neck": [17],
    "skin": [1],
    "smile": [10, 11, 12],
}

MODEL_ID = "jonathandinu/face-parsing"


def face_parsing_enabled() -> bool:
    raw = os.environ.get("FACE_PARSING_ENABLED", "true").lower()
    if raw in ("0", "false", "no", "off"):
        return False
    try:
        import torch  # noqa: F401
        import transformers  # noqa: F401
    except ImportError:
        return False
    return True


@lru_cache(maxsize=1)
def _load_model():
    import torch
    from transformers import SegformerForSemanticSegmentation, SegformerImageProcessor

    device = "cuda" if torch.cuda.is_available() else "cpu"
    processor = SegformerImageProcessor.from_pretrained(MODEL_ID)
    model = SegformerForSemanticSegmentation.from_pretrained(MODEL_ID)
    model.to(device)
    model.eval()
    return processor, model, device


def segment_image(image_rgb: np.ndarray) -> np.ndarray:
    """Return label map (H, W) int array."""
    import torch

    processor, model, device = _load_model()
    pil = Image.fromarray(image_rgb)
    inputs = processor(images=pil, return_tensors="pt").to(device)
    with torch.no_grad():
        outputs = model(**inputs)
    logits = outputs.logits
    upsampled = torch.nn.functional.interpolate(
        logits,
        size=(image_rgb.shape[0], image_rgb.shape[1]),
        mode="bilinear",
        align_corners=False,
    )
    labels = upsampled.argmax(dim=1)[0].cpu().numpy().astype(np.int32)
    return labels


def _bbox_from_mask(mask: np.ndarray, pad: int = 4) -> Optional[tuple[int, int, int, int]]:
    ys, xs = np.where(mask)
    if len(xs) == 0:
        return None
    h, w = mask.shape[:2]
    x1, x2 = int(xs.min()), int(xs.max())
    y1, y2 = int(ys.min()), int(ys.max())
    x1 = max(0, x1 - pad)
    y1 = max(0, y1 - pad)
    x2 = min(w - 1, x2 + pad)
    y2 = min(h - 1, y2 + pad)
    return x1, y1, x2, y2


def _crop_jpeg(image_rgb: np.ndarray, bbox: tuple[int, int, int, int]) -> bytes:
    x1, y1, x2, y2 = bbox
    crop = image_rgb[y1 : y2 + 1, x1 : x2 + 1]
    bgr = cv2.cvtColor(crop, cv2.COLOR_RGB2BGR)
    ok, buf = cv2.imencode(".jpg", bgr, [int(cv2.IMWRITE_JPEG_QUALITY), 90])
    if not ok:
        raise RuntimeError("Failed to encode parsing crop")
    return buf.tobytes()


def extract_feature_crops(
    labels: np.ndarray,
    image_rgb: np.ndarray,
) -> dict[str, dict[str, Any]]:
    """Build per-feature bbox crops from segmentation labels."""
    crops: dict[str, dict[str, Any]] = {}
    h, w = image_rgb.shape[:2]

    for feature_id, label_ids in FEATURE_LABEL_GROUPS.items():
        combined = np.zeros((h, w), dtype=bool)
        used_labels: list[str] = []
        for lid in label_ids:
            combined |= labels == lid
            used_labels.append(LABEL_MAP.get(lid, str(lid)))
        bbox = _bbox_from_mask(combined)
        if not bbox:
            continue
        x1, y1, x2, y2 = bbox
        crops[feature_id] = {
            "bbox": [x1, y1, x2, y2],
            "labels": used_labels,
            "jpegBytes": _crop_jpeg(image_rgb, bbox),
        }
    return crops


def run_face_parsing_on_image(image_bytes: bytes) -> tuple[np.ndarray, np.ndarray]:
    """Decode JPEG bytes, segment, return (image_rgb, labels)."""
    arr = np.frombuffer(image_bytes, dtype=np.uint8)
    bgr = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if bgr is None:
        raise ValueError("Could not decode front image for face parsing")
    rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
    labels = segment_image(rgb)
    return rgb, labels
