"""Port of protocolCheck.js — Post-analysis protocol violation detection."""

from __future__ import annotations
from typing import Optional


def detect_protocol_violations(face_details: Optional[dict]) -> list:
    """Check AWS face details for protocol violations.

    Returns a list of warning dicts:
        {"id": str, "severity": str, "message": str}
    """
    if not face_details:
        return []

    warnings = []

    def _conf(attr):
        if attr and attr.get("Value") and attr.get("Confidence", 0) > 75:
            return True
        return False

    if _conf(face_details.get("Eyeglasses")):
        warnings.append({
            "id": "glasses-detected",
            "severity": "high",
            "message": "Eyeglasses detected — remove glasses and retake for accurate periorbital analysis.",
        })

    if _conf(face_details.get("Sunglasses")):
        warnings.append({
            "id": "sunglasses-detected",
            "severity": "high",
            "message": "Sunglasses detected — eyes must be fully visible.",
        })

    pose = face_details.get("Pose", {})
    yaw = abs(pose.get("Yaw", 0))
    pitch = abs(pose.get("Pitch", 0))

    if yaw > 12:
        warnings.append({
            "id": "pose-yaw",
            "severity": "medium",
            "message": f"Head turned sideways ({pose.get('Yaw', 0):.0f}° yaw) — use a direct front-facing photo.",
        })
    if pitch > 15:
        warnings.append({
            "id": "pose-pitch",
            "severity": "medium",
            "message": f"Head tilted up/down ({pose.get('Pitch', 0):.0f}° pitch) — keep camera at eye level.",
        })

    quality = face_details.get("Quality", {})
    sharpness = quality.get("Sharpness", 100)
    brightness = quality.get("Brightness", 100)

    if sharpness < 35:
        warnings.append({
            "id": "blur",
            "severity": "medium",
            "message": "Image appears blurry — use a sharper, well-focused photo.",
        })
    if brightness < 25:
        warnings.append({
            "id": "dark",
            "severity": "medium",
            "message": "Image is underexposed — use brighter, more even lighting.",
        })
    if brightness > 85:
        warnings.append({
            "id": "overexposed",
            "severity": "low",
            "message": "Image may be overexposed — reduce direct flash or harsh lighting.",
        })

    if not face_details.get("EyesOpen", {}).get("Value", True):
        warnings.append({
            "id": "eyes-closed",
            "severity": "high",
            "message": "Eyes appear closed — eyes must be open for analysis.",
        })

    if face_details.get("MouthOpen", {}).get("Value", False):
        warnings.append({
            "id": "mouth-open",
            "severity": "low",
            "message": "Mouth is open — keep a neutral, closed-mouth expression.",
        })

    return warnings


def protocol_warnings_to_markdown(warnings: list) -> str:
    """Convert protocol warnings to a Markdown section."""
    if not warnings:
        return ""
    lines = ["## ⚠️ Protocol Warnings", ""]
    for w in warnings:
        icon = "🔴" if w["severity"] == "high" else ("🟡" if w["severity"] == "medium" else "🟢")
        lines.append(f"- {icon} {w['message']}")
    lines.append("")
    lines.append("---")
    lines.append("")
    return "\n".join(lines)
