"""Port of awsRekognition.js — AWS Rekognition face detection + metrics.

Uses boto3 instead of @aws-sdk/client-rekognition.
"""

from __future__ import annotations
import base64
from typing import Optional

import boto3
from botocore.exceptions import ClientError


def test_aws_connection(
    access_key_id: str,
    secret_access_key: str,
    session_token: Optional[str] = None,
    region: str = "us-east-1",
) -> dict:
    """Test AWS credentials by listing connected accounts."""
    try:
        kwargs = {
            "region_name": region,
            "aws_access_key_id": access_key_id,
            "aws_secret_access_key": secret_access_key,
        }
        if session_token:
            kwargs["aws_session_token"] = session_token

        client = boto3.client("rekognition", **kwargs)
        # Use a tiny 1x1 red JPEG as test image
        tiny_jpeg = (
            b'\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00'
            b'\xff\xdb\x00C\x00\x08\x06\x06\x07\x06\x05\x08\x07\x07\x07\t\t'
            b'\x08\n\x0c\x14\r\x0c\x0b\x0b\x0c\x19\x12\x13\x0f\x14\x1d\x1a'
            b'\x1f\x1e\x1d\x1a\x1c\x1c $.\x27 ",#\x1c\x1c(7),01444\x1f\'9=82<.342'
            b'\xff\xc0\x00\x0b\x08\x00\x01\x00\x01\x01\x01\x11\x00'
            b'\xff\xc4\x00\x1f\x00\x00\x01\x05\x01\x01\x01\x01\x01\x01\x00'
            b'\x00\x00\x00\x00\x00\x00\x00\x01\x02\x03\x04\x05\x06\x07\x08\t\n\x0b'
            b'\xff\xda\x00\x08\x01\x01\x00\x00?\x00\x7f\xa0'
            b'\xff\xd9'
        )
        client.detect_faces(
            Image={"Bytes": tiny_jpeg},
            Attributes=["DEFAULT"],
        )
        return {"ok": True, "message": "Connection successful"}
    except ClientError as e:
        return {"ok": False, "error": str(e)}
    except Exception as e:
        return {"ok": False, "error": str(e)}


def analyze_face_with_aws(
    image_bytes: bytes,
    access_key_id: str,
    secret_access_key: str,
    session_token: Optional[str] = None,
    region: str = "us-east-1",
) -> Optional[dict]:
    """Detect faces using AWS Rekognition.

    Args:
        image_bytes: Raw image bytes.
        access_key_id: AWS access key.
        secret_access_key: AWS secret key.
        session_token: Optional session token (for ASIA keys).
        region: AWS region.

    Returns:
        faceDetails dict or None if no face detected.
    """
    kwargs = {
        "region_name": region,
        "aws_access_key_id": access_key_id,
        "aws_secret_access_key": secret_access_key,
    }
    if session_token:
        kwargs["aws_session_token"] = session_token

    client = boto3.client("rekognition", **kwargs)
    response = client.detect_faces(
        Image={"Bytes": image_bytes},
        Attributes=["ALL"],
    )

    face_details = response.get("FaceDetails", [])
    if not face_details:
        return None
    return face_details[0]


def compute_metrics_from_aws(face_details: dict, answers: Optional[dict] = None) -> dict:
    """Compute metrics from AWS Rekognition face details — port of JS version."""
    defaults = {
        "symmetry": "85.0",
        "canthalTilt": "4.5",
        "upperThird": "0.33",
        "middleThird": "0.34",
        "lowerThird": "0.33",
        "averageness": "75.0",
    }

    landmarks = face_details.get("Landmarks", [])
    left_eye = next((l for l in landmarks if l["Type"] == "eyeLeft"), None)
    right_eye = next((l for l in landmarks if l["Type"] == "eyeRight"), None)
    nose_lm = next((l for l in landmarks if l["Type"] == "nose"), None)
    chin_lm = next((l for l in landmarks if l["Type"] == "chinBottom"), None)
    mouth_top = next((l for l in landmarks if l["Type"] == "mouthUp"), None)

    symmetry = defaults["symmetry"]
    if left_eye and right_eye:
        eye_y_diff = abs(left_eye["Y"] - right_eye["Y"])
        symmetry = str(min(99, max(60, round(97 - eye_y_diff * 400))))

    pose = face_details.get("Pose", {})
    quality = face_details.get("Quality", {})
    age_range = face_details.get("AgeRange", {})
    age_low = age_range.get("Low", 25)
    age_high = age_range.get("High", 35)

    upper_third = defaults["upperThird"]
    middle_third = defaults["middleThird"]
    lower_third = defaults["lowerThird"]

    if left_eye and right_eye and chin_lm and mouth_top:
        eye_y = (left_eye["Y"] + right_eye["Y"]) / 2
        total = chin_lm["Y"] - eye_y + 0.15
        if total > 0:
            upper = (mouth_top["Y"] - eye_y) / total
            lower = (chin_lm["Y"] - mouth_top["Y"]) / total
            middle = 1 - upper - lower
            upper_third = f"{max(0.2, upper):.2f}"
            middle_third = f"{max(0.2, middle):.2f}"
            lower_third = f"{max(0.2, lower):.2f}"

    sharpness = quality.get("Sharpness", 50)
    brightness = quality.get("Brightness", 50)
    harmony = min(99, round(sharpness * 0.35 + brightness * 0.15 + float(symmetry) * 0.5))

    emotions = face_details.get("Emotions", [])
    emotion_str = ", ".join(
        f"{e['Type']} ({e['Confidence']:.0f}%)"
        for e in sorted(emotions, key=lambda e: e.get("Confidence", 0), reverse=True)[:3]
    )

    smile_val = face_details.get("Smile", {})
    smile_str = f"Yes ({smile_val.get('Confidence', 0):.0f}%)" if smile_val.get("Value") else "No"
    eyes_open_val = face_details.get("EyesOpen", {})
    eyes_open_str = "Open" if eyes_open_val.get("Value") else "Closed"

    return {
        "symmetry": symmetry,
        "proportionality": f"{min(99, sharpness * 0.7 + 25):.1f}",
        "averageness": defaults["averageness"],
        "jawlineAngle": str(round(112 + abs(pose.get("Yaw", 0)) * 1.5)),
        "eyebrowTilt": f"{abs(pose.get('Roll', 0)):.1f}",
        "nasalAngle": str(round(92 + abs(pose.get("Pitch", 0)) * 2)),
        "canthalTilt": defaults["canthalTilt"],
        "upperThird": upper_third,
        "middleThird": middle_third,
        "lowerThird": lower_third,
        "visualAge": round((age_low + age_high) / 2),
        "harmonyScore": str(harmony),
        "source": "aws",
        "confidence": f"{face_details.get('Confidence', 0):.1f}",
        "emotions": emotion_str,
        "pose": f"Yaw {pose.get('Yaw', 0):.1f}° · Pitch {pose.get('Pitch', 0):.1f}° · Roll {pose.get('Roll', 0):.1f}°",
        "quality": f"Sharpness {sharpness:.0f} · Brightness {brightness:.0f}",
        "smile": smile_str,
        "eyesOpen": eyes_open_str,
    }
