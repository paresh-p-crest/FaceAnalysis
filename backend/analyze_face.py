"""Main orchestrator for facial analysis — MediaPipe, OpenCV, eyes, and CV report."""

from __future__ import annotations
from typing import Optional
import logging

from .opencv_metrics import analyze_image_stats, compute_metrics_from_landmarks, landmarks_to_overlay
from .eye_analysis import analyze_eyes, assemble_eyes_region
from .cv_report import build_cv_report
from .multi_view import analyze_all_views
from .profile_cephalometrics import build_profile_report, _naso_aural_explanation, _naso_aural_label
from .quarter_analysis import build_quarter_report
from .smile_analysis import analyze_smile_photo
from .hair_analysis import analyze_hair_photo
from .ear_analysis import (
    analyze_profile_ears,
    build_naso_aural_caliper_overlay,
    resolve_nose_points_for_profile,
)
from .naso_aural_guide_overlay import nose_height_norm_from_guides, patch_naso_aural_guides
from . import cv_report_explanations_de as expl_de

logger = logging.getLogger(__name__)


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

    cv_report["quarter"] = build_quarter_report(views)

    smile_bytes = photos.get("smile")
    smile_data = analyze_smile_photo(smile_bytes, front_lm) if smile_bytes else {}
    if smile_data and cv_report.get("smile"):
        cv_report["smile"] = {**cv_report["smile"], **smile_data}

    top_bytes = photos.get("topHead")
    hair_data = (
        analyze_hair_photo(top_bytes, front_lm, photos.get("front")) if top_bytes else {}
    )
    # Only merge measured top-of-head results; never clobber a working first-pass
    # hair block with an estimated/failed fallback.
    if hair_data and hair_data.get("dataSource") == "measured":
        cv_report["hair"] = {**cv_report.get("hair", {}), **hair_data}
    elif hair_data and not cv_report.get("hair"):
        cv_report["hair"] = hair_data

    feature_crops = cv_report.get("featureCrops") or {}
    # Profile cephalometrics prefer silhouette landmarks at 90° when extractable
    cv_report["profile"] = build_profile_report(views, photos, feature_crops)
    primary = cv_report.get("profile", {}).get("primary")
    if primary:
        meas = primary.get("measurements", {})
        cls = primary.get("classification", {})
        if cv_report.get("chin"):
            cv_report["chin"] = {
                **cv_report["chin"],
                "projection": cls.get("chinProjection", cv_report["chin"].get("projection")),
                "chinProjectionNorm": meas.get("chinProjectionNorm"),
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
            nf = meas.get("nasofrontalAngleDeg")
            dh = meas.get("dorsalHumpDeviation")
            hump_label = (
                "present" if dh is not None and abs(float(dh)) > 0.008 else "minimal"
            )
            base_expl = cv_report["nose"].get("explanation") or ""
            base_expl_de = cv_report["nose"].get("explanationDe") or ""
            profile_expl = (
                f" Profile angles: nasofrontal {nf}°, nasolabial {nasolabial}° "
                f"(typical {nasolabial_norm}), dorsal hump {hump_label}."
            )
            profile_expl_de = expl_de.nose_profile_append_de(nf, nasolabial, nasolabial_norm, hump_label)
            cv_report["nose"] = {
                **cv_report["nose"],
                "nasolabialAngleDeg": nasolabial,
                "nasolabialNormalRange": nasolabial_norm,
                "nasoAuralRatio": meas.get("nasoAuralRatio"),
                "facialConvexityDeg": meas.get("facialConvexityDeg"),
                "nasofrontalAngleDeg": nf,
                "dorsalHumpDeviation": dh,
                "dorsalHumpLabel": hump_label,
                "profileGonialAngleDeg": meas.get("profileGonialAngleDeg"),
                "chinProjectionNorm": meas.get("chinProjectionNorm"),
                "profilePoseId": primary.get("poseId"),
                "profileLandmarkSource": primary.get("landmarkSource"),
                "dataSource": "measured",
                "explanation": (base_expl + profile_expl).strip(),
                "explanationDe": (base_expl_de + profile_expl_de).strip(),
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
            naso["explanationDe"] = expl_de.naso_aural_explanation_de(float(naso_val or 0))
            naso["photoSource"] = primary.get("poseId", "rightProfile")
            naso["dataSource"] = "measured"
            naso["requiresProfile"] = False
            if primary.get("overlay", {}).get("nasoAural"):
                naso["overlay"] = primary["overlay"]["nasoAural"]
                naso["overlaySpace"] = "image"
            ratios = {**ratios, "nasoAural": naso}
            cv_report["proportions"] = {**cv_report["proportions"], "ratios": ratios}

    # Additive ear landmarker (profile contours) — never overwrites FaceMesh earSize etc.
    try:
        ear_lm = analyze_profile_ears(photos)
        if ear_lm:
            cv_report["ears"] = {**(cv_report.get("ears") or {}), **ear_lm}
            # Prefer landmarker vertical ear height for naso-aural when overlay nose span exists.
            naso = (cv_report.get("proportions") or {}).get("ratios", {}).get("nasoAural")
            if isinstance(naso, dict):
                sides = ear_lm.get("sides") or {}
                pose = naso.get("photoSource")
                side = None
                if pose == "leftProfile" and (sides.get("left") or {}).get("status") == "ready":
                    side = sides["left"]
                elif pose == "rightProfile" and (sides.get("right") or {}).get("status") == "ready":
                    side = sides["right"]
                else:
                    for key in ("right", "left"):
                        cand = sides.get(key)
                        if cand and cand.get("status") == "ready":
                            side = cand
                            break
                meas = (side or {}).get("measurements") or {}
                ear_h = meas.get("verticalHeightNorm")
                # Nose must come from the same 90° profile as the ear landmarker /
                # displayed plate — primary may be right45 with mismatched coords.
                pose_for_ear = (side or {}).get("poseId") or (
                    "leftProfile" if pose == "leftProfile" else "rightProfile"
                )
                nose_top, nose_bot = resolve_nose_points_for_profile(
                    cv_report, pose_for_ear, naso
                )
                nose_h = None
                if nose_top and nose_bot:
                    nose_h = abs(float(nose_bot["y"]) - float(nose_top["y"]))
                if (
                    ear_h is not None
                    and nose_h is not None
                    and float(nose_h) > 1e-6
                    and float(ear_h) > 1e-6
                    and meas.get("helixTop")
                    and (meas.get("softBottom") or meas.get("lobeBottom"))
                ):
                    ratio = round(float(ear_h) / float(nose_h), 2)
                    facing_right = pose_for_ear != "leftProfile"
                    qoves_overlay = build_naso_aural_caliper_overlay(
                        ear_measurements=meas,
                        nose_top=nose_top,
                        nose_bottom=nose_bot,
                        facing_right=facing_right,
                    )
                    # Ear caliper required; nose guides additive (earPlusNoseGuides-v6).
                    bracket_ids = {
                        b.get("id") for b in (qoves_overlay.get("brackets") or [])
                    }
                    if "earVertical" in bracket_ids:
                        naso = {
                            **naso,
                            "yourValue": ratio,
                            "yourLabel": _naso_aural_label(ratio),
                            "explanation": _naso_aural_explanation(ratio),
                            "explanationDe": expl_de.naso_aural_explanation_de(float(ratio)),
                            "earHeightNorm": round(float(ear_h), 6),
                            "noseHeightNorm": round(float(nose_h), 6),
                            "noseTop": nose_top,
                            "noseBottom": nose_bot,
                            "photoSource": pose_for_ear,
                            "dataSource": "ear_landmarker",
                            "overlay": qoves_overlay,
                            "overlaySpace": "image",
                        }
                        profile_bytes = photos.get(pose_for_ear)
                        naso = patch_naso_aural_guides(
                            naso,
                            profile_bytes,
                            facing_right=facing_right,
                            ear_measurements=meas,
                            pose_id=pose_for_ear,
                        )
                        guide_nose_h = nose_height_norm_from_guides(naso)
                        if guide_nose_h is not None:
                            ratio = round(float(ear_h) / guide_nose_h, 2)
                            naso = {
                                **naso,
                                "yourValue": ratio,
                                "yourLabel": _naso_aural_label(ratio),
                                "explanation": _naso_aural_explanation(ratio),
                                "explanationDe": expl_de.naso_aural_explanation_de(float(ratio)),
                                "noseHeightNorm": round(guide_nose_h, 6),
                                "noseHeightSource": "guide_glabella_subnasale",
                            }
                        prev_ratios = (cv_report.get("proportions") or {}).get("ratios") or {}
                        ratios = {**prev_ratios, "nasoAural": naso}
                        cv_report["proportions"] = {**(cv_report.get("proportions") or {}), "ratios": ratios}
                        if cv_report.get("nose"):
                            cv_report["nose"] = {
                                **cv_report["nose"],
                                "nasoAuralRatio": ratio,
                            }
                        if cv_report.get("ears"):
                            cv_report["ears"] = {
                                **cv_report["ears"],
                                "protrusion": _naso_aural_label(ratio),
                            }
    except Exception as exc:
        logger.warning("Ear landmarker enrichment skipped: %s", exc)

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
    metrics = compute_metrics_from_landmarks(landmarks, answers, image_stats, image_bytes=photo_bytes)
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
