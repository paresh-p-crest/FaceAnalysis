"""Main orchestrator for facial analysis — MediaPipe, OpenCV, eyes, and CV report."""

from __future__ import annotations
from typing import Optional

from .opencv_metrics import analyze_image_stats, compute_metrics_from_landmarks, landmarks_to_overlay
from .eye_analysis import analyze_eyes, assemble_eyes_region
from .cv_report import build_cv_report
from .multi_view import analyze_all_views
from .calibration import build_calibration
from .profile_cephalometrics import build_profile_report, _naso_aural_explanation, _naso_aural_label
from .quarter_analysis import build_quarter_report
from .smile_analysis import analyze_smile_photo
from .hair_analysis import analyze_hair_photo
from .hair_segmentation import analyze_hair_segmentation


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


def _enrich_cv_report(cv_report: dict, answers: dict, photos: dict, multi_view: dict) -> dict:
    """Merge multi-view analysis into cvReport."""
    views = multi_view.get("views", {})
    front_lm = multi_view.get("frontLandmarks", [])

    profile_lm = None
    for pid in ("rightProfile", "leftProfile"):
        v = views.get(pid, {})
        if v.get("success") and v.get("landmarks"):
            profile_lm = v["landmarks"]
            break

    calibration = build_calibration(answers or {}, front_lm, profile_lm)
    cv_report["calibration"] = calibration
    mm_per_unit = calibration.get("mmPerUnit")

    cv_report["profile"] = build_profile_report(views, mm_per_unit)
    cv_report["quarter"] = build_quarter_report(views)

    smile_bytes = photos.get("smile")
    smile_data = analyze_smile_photo(smile_bytes, front_lm) if smile_bytes else {}
    if smile_data and cv_report.get("smile"):
        cv_report["smile"] = {**cv_report["smile"], **smile_data}

    top_bytes = photos.get("topHead")
    hair_data = analyze_hair_photo(top_bytes, front_lm) if top_bytes else {}
    if hair_data:
        seg = analyze_hair_segmentation(top_bytes, photos.get("front"))
        if seg:
            hair_data = {**hair_data, **seg}
        cv_report["hair"] = {**cv_report.get("hair", {}), **hair_data}

    # Profile-enriched feature sections
    primary = cv_report.get("profile", {}).get("primary")
    if primary:
        meas = primary.get("measurements", {})
        cls = primary.get("classification", {})
        if cv_report.get("chin"):
            cv_report["chin"] = {
                **cv_report["chin"],
                "projection": cls.get("chinProjection", cv_report["chin"].get("projection")),
                "chinProjectionMm": meas.get("chinProjectionMm"),
                "dataSource": "measured",
            }
        if cv_report.get("ears"):
            cv_report["ears"] = {
                **cv_report["ears"],
                "protrusion": cls.get("nasoAural", cv_report["ears"].get("protrusion")),
                "earProtrusion": meas.get("earProtrusionNorm"),
                "dataSource": "measured",
            }
        if cv_report.get("nose"):
            gender = (answers or {}).get("gender", "").lower()
            nasolabial = meas.get("nasolabialAngleDeg")
            nasolabial_norm = "90–120°"
            if gender in ("female", "woman", "f"):
                nasolabial_norm = "95–120°"
            elif gender in ("male", "man", "m"):
                nasolabial_norm = "90–110°"
            cv_report["nose"] = {
                **cv_report["nose"],
                "nasolabialAngleDeg": nasolabial,
                "nasolabialNormalRange": nasolabial_norm,
                "nasoAuralRatio": meas.get("nasoAuralRatio"),
                "facialConvexityDeg": meas.get("facialConvexityDeg"),
                "nasofrontalAngleDeg": meas.get("nasofrontalAngleDeg"),
                "dorsalHumpDeviation": meas.get("dorsalHumpDeviation"),
                "profileGonialAngleDeg": meas.get("profileGonialAngleDeg"),
                "chinProjectionMm": meas.get("chinProjectionMm"),
                "profilePoseId": primary.get("poseId"),
                "dataSource": "measured",
            }
        if cv_report.get("jaw") and meas.get("profileGonialAngleDeg"):
            cv_report["jaw"] = {
                **cv_report["jaw"],
                "profileGonialAngleDeg": meas.get("profileGonialAngleDeg"),
                "dataSource": "measured",
            }
        ratios = cv_report.get("proportions", {}).get("ratios", {})
        if isinstance(ratios, dict) and "nasoAural" in ratios:
            naso = dict(ratios["nasoAural"])
            naso_val = meas.get("nasoAuralRatio", naso.get("yourValue"))
            naso["yourValue"] = naso_val
            naso["yourLabel"] = cls.get("nasoAural", _naso_aural_label(naso_val))
            naso["explanation"] = _naso_aural_explanation(naso_val)
            naso["photoSource"] = primary.get("poseId", "rightProfile")
            naso["dataSource"] = "measured"
            naso["requiresProfile"] = False
            if primary.get("overlay", {}).get("nasoAural"):
                naso["overlay"] = primary["overlay"]["nasoAural"]
                naso["overlaySpace"] = "image"
            ratios = {**ratios, "nasoAural": naso}
            cv_report["proportions"] = {**cv_report["proportions"], "ratios": ratios}

    poses_analyzed = multi_view.get("posesAnalyzed", [])
    cv_report["meta"] = {
        **(cv_report.get("meta") or {}),
        "pipelineVersion": "2.0.0",
        "posesAnalyzed": poses_analyzed,
    }
    return cv_report


def run_local_cv_path(
    photo_bytes: bytes,
    answers: dict,
    photos: Optional[dict] = None,
) -> dict:
    """Run the full local CV analysis path (MediaPipe + OpenCV + eyes + CV report)."""
    if photos is None:
        photos = {}

    multi_view = analyze_all_views(photo_bytes, photos)
    front_view = multi_view["views"].get("front", {})
    if not front_view.get("success"):
        raise ValueError(front_view.get("error") or "No face detected on front photo.")

    landmarks = front_view["landmarks"]
    image_stats = analyze_image_stats(photo_bytes)
    metrics = compute_metrics_from_landmarks(landmarks, answers, image_stats)
    eye_analysis = analyze_eyes(landmarks, photo_bytes)
    cv_report = build_cv_report(landmarks, photo_bytes, metrics, photos, answers)
    brow_metrics = (cv_report.get("eyebrows") or {}).get("metrics") or {}
    cv_report["eyes"] = assemble_eyes_region(landmarks, photo_bytes, brow_metrics, eye_analysis)
    cv_report = _enrich_cv_report(cv_report, answers, photos, multi_view)

    return {
        "mode": "real",
        "success": True,
        "cvEngine": "local-cv",
        "activeLLM": "local",
        "activeProvider": "local",
        "faceDetails": None,
        "landmarks": landmarks_to_overlay(landmarks),
        "metrics": metrics,
        "eyeAnalysis": eye_analysis,
        "cvReport": cv_report,
        "protocolWarnings": None,
        "error": None,
    }


def _normalize_cv_provider(provider: str) -> str:
    """Map legacy provider values to the supported local CV engine."""
    if provider in ("openai", "local", ""):
        return "local"
    return provider


def run_face_analysis(
    photo_bytes: bytes,
    answers: dict,
    photos: Optional[dict] = None,
    provider: str = "local",
) -> dict:
    """Main entry point — run the complete face analysis pipeline."""
    if photos is None:
        photos = {}

    provider = _normalize_cv_provider(provider)

    if provider == "aws":
        return _fail_result(
            "AWS Rekognition provider is no longer supported. Use provider 'local'.",
            provider,
            "none",
        )

    if provider == "local":
        try:
            return run_local_cv_path(photo_bytes, answers, photos)
        except Exception as e:
            return _fail_result(str(e) or "MediaPipe analysis failed.", provider, "local-cv")

    return _fail_result(
        f"Unsupported CV provider '{provider}'. Use provider 'local'.",
        provider,
        "none",
    )
