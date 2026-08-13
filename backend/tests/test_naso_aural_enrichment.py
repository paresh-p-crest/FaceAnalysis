"""Tests for naso_aural_enrichment.py"""

from backend.naso_aural_enrichment import (
    build_naso_aural_by_pose,
    enrich_naso_aural_from_ears,
    resolve_naso_profile_pose,
    set_admin_naso_profile_pose,
)
from backend.tests.test_photo_storage import _good_ear_side


def _minimal_cv_report():
    return {
        "profile": {
            "rightProfile": {
                "overlay": {
                    "nasoAural": {
                        "noseTop": {"x": 0.4, "y": 0.30},
                        "noseBottom": {"x": 0.4, "y": 0.45},
                    }
                }
            },
            "leftProfile": {
                "overlay": {
                    "nasoAural": {
                        "noseTop": {"x": 0.6, "y": 0.30},
                        "noseBottom": {"x": 0.6, "y": 0.45},
                    }
                }
            },
        },
        "proportions": {
            "ratios": {
                "nasoAural": {
                    "ratioLabel": "NASO-AURAL RATIO",
                    "yourValue": 0.82,
                    "idealValue": 1.0,
                }
            }
        },
        "nose": {},
        "ears": {},
    }


def test_build_naso_aural_by_pose_includes_improper_sides():
    cv = _minimal_cv_report()
    right = _good_ear_side("rightProfile", 0.20)
    right["edgeCollapseFrac"] = 0.20
    from backend.ear_analysis import evaluate_ear_capture

    right["earCapture"] = evaluate_ear_capture(right)
    left = _good_ear_side("leftProfile", 0.06)
    left["earCapture"] = evaluate_ear_capture(left)
    sides = {"right": right, "left": left}
    by_pose = build_naso_aural_by_pose(cv, {}, sides)
    assert "rightProfile" in by_pose
    assert "leftProfile" in by_pose
    assert by_pose["rightProfile"]["earCaptureProper"] is False
    assert by_pose["leftProfile"]["earCaptureProper"] is True


def test_resolve_naso_profile_pose_defaults_right():
    ears = {
        "nasoAuralByPose": {
            "rightProfile": {"yourValue": 0.9},
            "leftProfile": {"yourValue": 0.8},
        },
        "measurementProfilePose": "leftProfile",
    }
    assert resolve_naso_profile_pose(ears) == "rightProfile"


def test_resolve_naso_profile_pose_respects_admin():
    ears = {
        "adminMeasurementProfilePose": "leftProfile",
        "nasoAuralByPose": {
            "rightProfile": {"yourValue": 0.9},
            "leftProfile": {"yourValue": 0.8},
        },
    }
    assert resolve_naso_profile_pose(ears) == "leftProfile"


def test_set_admin_naso_profile_pose_updates_active_ratio():
    cv = _minimal_cv_report()
    right = _good_ear_side("rightProfile", 0.10)
    left = _good_ear_side("leftProfile", 0.06)
    from backend.ear_analysis import evaluate_ear_capture

    right["earCapture"] = evaluate_ear_capture(right)
    left["earCapture"] = evaluate_ear_capture(left)
    cv["ears"] = {
        "sides": {"right": right, "left": left},
        "nasoAuralByPose": build_naso_aural_by_pose(cv, {}, {"right": right, "left": left}),
    }
    analysis = {"cvReport": enrich_naso_aural_from_ears(cv, {})}
    patched = set_admin_naso_profile_pose(analysis, "leftProfile")
    naso = patched["cvReport"]["proportions"]["ratios"]["nasoAural"]
    assert naso["photoSource"] == "leftProfile"
    assert patched["cvReport"]["ears"]["adminMeasurementProfilePose"] == "leftProfile"
