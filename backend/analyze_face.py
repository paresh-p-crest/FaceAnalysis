"""Port of analyzeFace.js — Main orchestrator routing to local/aws/openai paths.

This is the central analysis function that coordinates MediaPipe, OpenCV,
AWS Rekognition, eye analysis, and CV report generation.
"""

from __future__ import annotations
from typing import Optional

from .mediapipe_analysis import analyze_with_mediapipe
from .opencv_metrics import analyze_image_stats, compute_metrics_from_landmarks, landmarks_to_overlay
from .eye_analysis import analyze_eyes
from .cv_report import build_cv_report
from .aws_rekognition import analyze_face_with_aws, compute_metrics_from_aws
from .protocol_check import detect_protocol_violations


def _fail_result(error: str, provider: str, cv_engine: str) -> dict:
    return {
        "mode": "real",
        "success": False,
        "cvEngine": cv_engine,
        "activeLLM": provider,
        "activeProvider": provider,
        "faceDetails": None,
        "landmarks": None,
        "metrics": None,
        "eyeAnalysis": None,
        "cvReport": None,
        "protocolWarnings": None,
        "error": error,
    }


def run_local_cv_path(
    photo_bytes: bytes,
    answers: dict,
    photos: Optional[dict] = None,
) -> dict:
    """Run the full local CV analysis path (MediaPipe + OpenCV + eyes + CV report)."""
    if photos is None:
        photos = {}

    mp_result = analyze_with_mediapipe(photo_bytes)
    image_stats = analyze_image_stats(photo_bytes)
    metrics = compute_metrics_from_landmarks(mp_result.get("landmarks", []), answers, image_stats)
    eye_analysis = analyze_eyes(mp_result.get("landmarks", []), photo_bytes)
    cv_report = build_cv_report(mp_result.get("landmarks", []), photo_bytes, metrics, photos)

    return {
        "mode": "real",
        "success": True,
        "cvEngine": "local-cv",
        "activeLLM": "local",
        "activeProvider": "local",
        "faceDetails": None,
        "landmarks": landmarks_to_overlay(mp_result.get("landmarks", [])),
        "metrics": metrics,
        "eyeAnalysis": eye_analysis,
        "cvReport": cv_report,
        "protocolWarnings": None,
        "error": None,
    }


def run_mediapipe_path(
    photo_bytes: bytes,
    answers: dict,
) -> dict:
    """Run MediaPipe + OpenCV path without eye/cv report (for OpenAI provider mode)."""
    mp_result = analyze_with_mediapipe(photo_bytes)
    image_stats = analyze_image_stats(photo_bytes)
    metrics = compute_metrics_from_landmarks(mp_result.get("landmarks", []), answers, image_stats)

    return {
        "mode": "real",
        "success": True,
        "cvEngine": "mediapipe+opencv",
        "activeLLM": "openai",
        "activeProvider": "openai",
        "faceDetails": None,
        "landmarks": landmarks_to_overlay(mp_result.get("landmarks", [])),
        "metrics": metrics,
        "eyeAnalysis": None,
        "cvReport": None,
        "protocolWarnings": None,
        "error": None,
    }


def run_face_analysis(
    photo_bytes: bytes,
    answers: dict,
    photos: Optional[dict] = None,
    provider: str = "local",
    aws_credentials: Optional[dict] = None,
) -> dict:
    """Main entry point — run the complete face analysis pipeline.

    Args:
        photo_bytes: Raw image bytes.
        answers: Questionnaire answers dict.
        photos: Optional dict of additional photo bytes (smile, topHead, etc.).
        provider: "local", "aws", or "openai".
        aws_credentials: Optional dict with access_key_id, secret_access_key, session_token, region.

    Returns:
        Complete analysis result dict matching the frontend's expected shape.
    """
    if photos is None:
        photos = {}

    # Validate credentials
    if provider == "aws":
        if not aws_credentials:
            return _fail_result("AWS credentials not provided.", provider, "aws")
        creds = aws_credentials
        if not creds.get("access_key_id") or not creds.get("secret_access_key"):
            return _fail_result(
                "AWS credentials not set. Open Settings → AWS tab and save your keys.",
                provider, "aws",
            )
        if creds["access_key_id"].startswith("ASIA") and not creds.get("session_token"):
            return _fail_result(
                "AWS session token required for sandbox credentials (ASIA keys).",
                provider, "aws",
            )

    # AWS path
    if provider == "aws":
        try:
            face_details = analyze_face_with_aws(
                photo_bytes,
                access_key_id=creds["access_key_id"],
                secret_access_key=creds["secret_access_key"],
                session_token=creds.get("session_token"),
                region=creds.get("region", "us-east-1"),
            )
            mp_result = analyze_with_mediapipe(photo_bytes)
            image_stats = analyze_image_stats(photo_bytes)
            metrics = compute_metrics_from_landmarks(mp_result.get("landmarks", []), answers, image_stats)
            eye_analysis = analyze_eyes(mp_result.get("landmarks", []), photo_bytes)
            cv_report = build_cv_report(mp_result.get("landmarks", []), photo_bytes, metrics, photos)
            protocol_warnings = detect_protocol_violations(face_details)

            return {
                "mode": "real",
                "success": True,
                "cvEngine": "aws",
                "activeLLM": provider,
                "activeProvider": provider,
                "faceDetails": face_details,
                "landmarks": landmarks_to_overlay(mp_result.get("landmarks", [])),
                "metrics": metrics,
                "eyeAnalysis": eye_analysis,
                "cvReport": cv_report,
                "protocolWarnings": protocol_warnings,
                "error": None,
            }
        except Exception as e:
            return _fail_result(str(e) or "AWS Rekognition failed.", provider, "aws")

    # Local path (MediaPipe + OpenCV + eyes + CV report)
    if provider == "local":
        try:
            return run_local_cv_path(photo_bytes, answers, photos)
        except Exception as e:
            return _fail_result(str(e) or "MediaPipe analysis failed.", provider, "local-cv")

    # OpenAI path (MediaPipe + OpenCV metrics, no eye/cv report)
    if provider == "openai":
        try:
            return run_mediapipe_path(photo_bytes, answers)
        except Exception as e:
            return _fail_result(str(e) or "MediaPipe analysis failed.", provider, "mediapipe+opencv")

    return _fail_result(
        "No active provider configured. Open Settings and select a provider tab.",
        provider, "none",
    )
