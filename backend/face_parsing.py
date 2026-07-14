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

# Rectangular photo slices (no mask isolation) on the front pose.
RECT_CROP_FEATURES = frozenset({"chin", "cheeks", "jaw"})

# Built from other poses (smile mesh / profile SegFormer) — skip on front extract.
POSE_SPECIFIC_FEATURES = frozenset({"lips", "smile", "ears"})

# Face composite for `skin`: all parsed face parts except hair and accessories.
SKIN_FACE_LABEL_IDS = [1, 2, 4, 5, 6, 7, 8, 9, 10, 11, 12, 17]

EAR_LABEL_IDS = [8, 9]

MASK_BACKGROUND_RGB = (255, 255, 255)

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


def _masked_crop_jpeg(
    image_rgb: np.ndarray,
    mask: np.ndarray,
    pad: int = 4,
) -> Optional[tuple[bytes, tuple[int, int, int, int]]]:
    """Isolate mask pixels on white, then tight-bbox JPEG. Returns (bytes, bbox) or None."""
    bbox = _bbox_from_mask(mask, pad=pad)
    if not bbox:
        return None
    isolated = np.full_like(image_rgb, MASK_BACKGROUND_RGB, dtype=np.uint8)
    isolated[mask] = image_rgb[mask]
    return _crop_jpeg(isolated, bbox), bbox


def _build_feature_mask(
    feature_id: str,
    label_ids: list[int],
    labels: np.ndarray,
) -> np.ndarray:
    """Build segmentation mask for a feature group."""
    h, w = labels.shape[:2]
    if feature_id == "skin":
        combined = np.zeros((h, w), dtype=bool)
        for lid in SKIN_FACE_LABEL_IDS:
            combined |= labels == lid
        return combined
    combined = np.zeros((h, w), dtype=bool)
    for lid in label_ids:
        combined |= labels == lid
    return combined


def extract_feature_crops(
    labels: np.ndarray,
    image_rgb: np.ndarray,
) -> dict[str, dict[str, Any]]:
    """Build per-feature crops from segmentation labels (front pose).

    Mask-isolated features use white background. chin / cheeks / jaw stay
    rectangular photo slices. lips / smile / ears are filled by pose-specific helpers.
    """
    crops: dict[str, dict[str, Any]] = {}

    for feature_id, label_ids in FEATURE_LABEL_GROUPS.items():
        if feature_id in POSE_SPECIFIC_FEATURES:
            continue
        combined = _build_feature_mask(feature_id, label_ids, labels)
        used_labels: list[str] = []
        if feature_id == "skin":
            used_labels = [LABEL_MAP.get(lid, str(lid)) for lid in SKIN_FACE_LABEL_IDS]
        else:
            for lid in label_ids:
                used_labels.append(LABEL_MAP.get(lid, str(lid)))
        bbox = _bbox_from_mask(combined)
        if not bbox:
            continue
        x1, y1, x2, y2 = bbox
        if feature_id in RECT_CROP_FEATURES:
            jpeg_bytes = _crop_jpeg(image_rgb, bbox)
        else:
            masked = _masked_crop_jpeg(image_rgb, combined)
            if not masked:
                continue
            jpeg_bytes, bbox = masked
            x1, y1, x2, y2 = bbox
        crops[feature_id] = {
            "bbox": [x1, y1, x2, y2],
            "labels": used_labels,
            "jpegBytes": jpeg_bytes,
            "sourcePose": "front",
        }
    return crops


def _decode_rgb(image_bytes: bytes, label: str = "image") -> np.ndarray:
    arr = np.frombuffer(image_bytes, dtype=np.uint8)
    bgr = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if bgr is None:
        raise ValueError(f"Could not decode {label} for mouth crop")
    return cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)


def _mouth_crop_from_landmarks(
    rgb: np.ndarray,
    landmarks: list,
    *,
    source_pose: str,
    pad: int = 8,
) -> Optional[dict[str, Any]]:
    """Outer-lip (MOUTH) fill on white using existing mesh landmarks."""
    from .face_crop import MOUTH, lm

    if not landmarks or len(landmarks) < 292:
        return None
    h, w = rgb.shape[:2]
    pts = np.array(
        [[int(lm(landmarks, i)["x"] * w), int(lm(landmarks, i)["y"] * h)] for i in MOUTH],
        dtype=np.int32,
    )
    mask_u8 = np.zeros((h, w), dtype=np.uint8)
    cv2.fillPoly(mask_u8, [pts], 255)
    masked = _masked_crop_jpeg(rgb, mask_u8 > 0, pad=pad)
    if not masked:
        return None
    jpeg_bytes, bbox = masked
    x1, y1, x2, y2 = bbox
    return {
        "bbox": [x1, y1, x2, y2],
        "labels": ["mouth_mesh"],
        "jpegBytes": jpeg_bytes,
        "sourcePose": source_pose,
        "sourceMethod": "mediapipe_mouth",
    }


def extract_lips_crop_from_front_landmarks(
    front_bytes: bytes,
    landmarks: list,
) -> dict[str, dict[str, Any]]:
    """Lips crop: front photo + CV pipeline landmarks from DB (not smile pose)."""
    rgb = _decode_rgb(front_bytes, "front")
    entry = _mouth_crop_from_landmarks(rgb, landmarks, source_pose="front")
    if not entry:
        return {}
    return {"lips": entry}


def extract_smile_crop_from_smile_pose(smile_bytes: bytes) -> dict[str, dict[str, Any]]:
    """Smile crop: MediaPipe on smile pose (separate from front lips)."""
    from .mediapipe_analysis import analyze_with_mediapipe

    rgb = _decode_rgb(smile_bytes, "smile")
    landmarks = analyze_with_mediapipe(smile_bytes)["landmarks"]
    entry = _mouth_crop_from_landmarks(rgb, landmarks, source_pose="smile")
    if not entry:
        return {}
    return {"smile": entry}


def extract_profile_ear_crop(pose_bytes: bytes, pose_id: str) -> Optional[dict[str, Any]]:
    """SegFormer ear mask on a profile pose (white bg)."""
    rgb, labels = run_face_parsing_on_image(pose_bytes)
    combined = np.zeros(labels.shape, dtype=bool)
    for lid in EAR_LABEL_IDS:
        combined |= labels == lid
    masked = _masked_crop_jpeg(rgb, combined, pad=24)
    if not masked:
        return None
    jpeg_bytes, bbox = masked
    x1, y1, x2, y2 = bbox
    return {
        "bbox": [x1, y1, x2, y2],
        "labels": [LABEL_MAP[lid] for lid in EAR_LABEL_IDS],
        "jpegBytes": jpeg_bytes,
        "sourcePose": pose_id,
        "sourceMethod": "segformer_ears",
    }


def run_face_parsing_on_image(image_bytes: bytes) -> tuple[np.ndarray, np.ndarray]:
    """Decode JPEG bytes, segment, return (image_rgb, labels)."""
    arr = np.frombuffer(image_bytes, dtype=np.uint8)
    bgr = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if bgr is None:
        raise ValueError("Could not decode image for face parsing")
    rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
    labels = segment_image(rgb)
    return rgb, labels
