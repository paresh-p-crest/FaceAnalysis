"""Tests for hybrid SegFormer / mesh / profile crop extraction."""

from __future__ import annotations

import cv2
import numpy as np

from backend.face_parsing import (
    POSE_SPECIFIC_FEATURES,
    RECT_CROP_FEATURES,
    extract_feature_crops,
    extract_lips_crop_from_front_landmarks,
)


def _decode_jpeg(jpeg_bytes: bytes) -> np.ndarray:
    arr = np.frombuffer(jpeg_bytes, dtype=np.uint8)
    bgr = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    assert bgr is not None
    return cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)


def test_nose_crop_is_white_background_isolated():
    h, w = 80, 100
    image = np.full((h, w, 3), 200, dtype=np.uint8)
    labels = np.zeros((h, w), dtype=np.int32)
    labels[30:50, 40:60] = 2
    image[30:50, 40:60] = (255, 128, 64)

    crops = extract_feature_crops(labels, image)
    assert "nose" in crops
    assert "lips" not in crops
    assert "ears" not in crops
    crop = _decode_jpeg(crops["nose"]["jpegBytes"])

    assert int(crop[0, 0].sum()) > 750
    cy, cx = crop.shape[0] // 2, crop.shape[1] // 2
    assert int(crop[cy, cx, 0]) > 200


def test_pose_specific_skipped_on_front():
    assert "lips" in POSE_SPECIFIC_FEATURES
    assert "smile" in POSE_SPECIFIC_FEATURES
    assert "ears" in POSE_SPECIFIC_FEATURES


def test_chin_cheeks_jaw_are_rect_photo_crops():
    h, w = 60, 60
    image = np.full((h, w, 3), 180, dtype=np.uint8)
    labels = np.zeros((h, w), dtype=np.int32)
    labels[10:50, 10:50] = 1
    labels[45:55, 20:40] = 12
    labels[50:58, 15:45] = 17

    crops = extract_feature_crops(labels, image)
    for feature_id in ("chin", "cheeks", "jaw"):
        assert feature_id in RECT_CROP_FEATURES
        assert feature_id in crops
        crop = _decode_jpeg(crops[feature_id]["jpegBytes"])
        assert int(np.median(crop)) > 100
    assert "smile" not in crops
    # neck is mask-isolated (white bg), not rect
    assert "neck" not in RECT_CROP_FEATURES
    assert "neck" in crops
    neck = _decode_jpeg(crops["neck"]["jpegBytes"])
    assert int(neck[0, 0].sum()) > 700


def test_eyes_uses_white_mask_not_rect():
    h, w = 50, 80
    image = np.full((h, w, 3), 120, dtype=np.uint8)
    labels = np.zeros((h, w), dtype=np.int32)
    labels[20:30, 15:35] = 4
    labels[20:30, 45:65] = 5
    image[labels == 4] = (200, 180, 160)
    image[labels == 5] = (200, 180, 160)

    crops = extract_feature_crops(labels, image)
    assert "eyes" in crops
    assert "eyes" not in RECT_CROP_FEATURES
    crop = _decode_jpeg(crops["eyes"]["jpegBytes"])
    assert int(crop[0, 0].sum()) > 750


def test_lips_from_front_db_landmarks():
    h, w = 200, 160
    rgb = np.full((h, w, 3), 200, dtype=np.uint8)
    landmarks = [{"x": 0.5, "y": 0.5, "z": 0.0} for _ in range(478)]
    from backend.face_crop import MOUTH
    # Assign contour points around a mouth box
    box = [
        (0.40, 0.55), (0.45, 0.53), (0.50, 0.52), (0.55, 0.53), (0.60, 0.55),
        (0.58, 0.58), (0.55, 0.60), (0.50, 0.62), (0.45, 0.60), (0.42, 0.58),
    ]
    for idx, i in enumerate(MOUTH):
        x, y = box[idx % len(box)]
        landmarks[i] = {"x": x, "y": y, "z": 0.0}
    rgb[int(0.52 * h) : int(0.62 * h), int(0.40 * w) : int(0.60 * w)] = (120, 80, 80)
    ok, buf = cv2.imencode(".jpg", cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR))
    assert ok
    crops = extract_lips_crop_from_front_landmarks(buf.tobytes(), landmarks)
    assert "lips" in crops
    assert crops["lips"]["sourcePose"] == "front"
    assert "smile" not in crops
    crop = _decode_jpeg(crops["lips"]["jpegBytes"])
    assert int(crop[0, 0].sum()) > 700


def test_empty_labels_omitted():
    h, w = 40, 40
    image = np.zeros((h, w, 3), dtype=np.uint8)
    labels = np.zeros((h, w), dtype=np.int32)
    assert extract_feature_crops(labels, image) == {}
