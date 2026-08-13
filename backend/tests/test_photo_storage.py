"""Unit tests for photo_storage.py"""

from backend.photo_storage import apply_photo_urls_to_cv_report, get_photo_storage


def test_save_and_url_binding():
    storage = get_photo_storage()
    stored = storage.save_pose("abc123", "front", b"\xff\xd8\xff fake jpeg")
    assert stored.poseId == "front"
    assert stored.publicUrl == "/api/media/assessments/abc123/front.jpg"
    assert stored.relativePath == "assessments/abc123/front.jpg"
    assert "abc123/front.jpg" in stored.publicUrl
    assert stored.byteSize > 0

    cv = apply_photo_urls_to_cv_report(
        {
            "faceShape": {},
            "symmetry": {},
            "chin": {"score": 70},
            "jaw": {"score": 70},
            "proportions": {
                "imageSrc": "data:image/jpeg;base64,AAAA",
                "proportionLines": {"hair": 8, "brow": 28, "nose": 55, "chin": 92},
                "overlaySpace": "crop",
                "ratios": {"nasoAural": {}},
            },
        },
        {"front": stored.publicUrl, "rightProfile": "/api/media/assessments/abc123/rightProfile.jpg"},
    )
    assert cv["photos"]["front"] == stored.publicUrl
    assert cv["faceShape"]["imageSrc"] == stored.publicUrl
    # Proportions overview is bound to the front pose in image space (current behavior).
    assert cv["proportions"]["imageSrc"] == stored.publicUrl
    assert cv["proportions"]["overlaySpace"] == "image"
    assert cv["proportions"]["ratios"]["nasoAural"]["photoSource"] == "rightProfile"
    assert cv["chin"]["photoSource"] == "front"
    assert cv["chin"]["imageSrcProfile"].endswith("rightProfile.jpg")
    assert cv["jaw"]["photoSource"] == "front"
    assert cv["jaw"]["imageSrcProfile"].endswith("rightProfile.jpg")


def test_naso_aural_binds_left_profile_when_photo_source_is_left():
    left_url = "/api/media/assessments/abc123/leftProfile.jpg"
    right_url = "/api/media/assessments/abc123/rightProfile.jpg"
    cv = apply_photo_urls_to_cv_report(
        {
            "proportions": {
                "ratios": {
                    "nasoAural": {
                        "photoSource": "leftProfile",
                        "dataSource": "ear_landmarker",
                        "yourValue": 0.82,
                    },
                },
            },
        },
        {"front": "/api/media/assessments/abc123/front.jpg", "leftProfile": left_url, "rightProfile": right_url},
    )
    naso = cv["proportions"]["ratios"]["nasoAural"]
    assert naso["photoSource"] == "leftProfile"
    assert naso["imageSrc"] == left_url


def _good_ear_side(pose_id: str, ec: float) -> dict:
    """Side dict that passes evaluate_ear_capture."""
    facing_right = pose_id == "rightProfile"
    side = {
        "poseId": pose_id,
        "status": "ready",
        "edgeCollapseFrac": ec,
        "confidences": [0.55] * 20,
        "repairedIndices": [],
        "landmarks": [{"id": i} for i in range(20)],
        "measurements": {
            "verticalHeightNorm": 0.12,
            "helixTop": {"x": 0.72 if facing_right else 0.28, "y": 0.28},
            "softBottom": {"x": 0.72 if facing_right else 0.28, "y": 0.40},
            "xMinNorm": 0.65 if facing_right else 0.22,
            "xMaxNorm": 0.78 if facing_right else 0.35,
        },
    }
    from backend.ear_analysis import evaluate_ear_capture

    side["earCapture"] = evaluate_ear_capture(side)
    return side


def test_pick_naso_ear_side_prefers_right_when_both_proper():
    from backend.ear_analysis import pick_naso_ear_side

    sides = {
        "right": _good_ear_side("rightProfile", 0.10),
        "left": _good_ear_side("leftProfile", 0.06),
    }
    picked = pick_naso_ear_side(sides)
    assert picked is not None
    assert picked["poseId"] == "rightProfile"


def test_pick_naso_ear_side_falls_back_to_left_when_right_not_proper():
    from backend.ear_analysis import pick_naso_ear_side

    sides = {
        "right": _good_ear_side("rightProfile", 0.20),
        "left": _good_ear_side("leftProfile", 0.06),
    }
    sides["right"]["edgeCollapseFrac"] = 0.20
    from backend.ear_analysis import evaluate_ear_capture

    sides["right"]["earCapture"] = evaluate_ear_capture(sides["right"])
    picked = pick_naso_ear_side(sides)
    assert picked is not None
    assert picked["poseId"] == "leftProfile"


def test_pick_profile_ear_side_right_first_when_both_proper():
    from backend.ear_analysis import pick_profile_ear_side

    sides = {
        "right": _good_ear_side("rightProfile", 0.10),
        "left": _good_ear_side("leftProfile", 0.06),
    }
    picked = pick_profile_ear_side(sides)
    assert picked is not None
    assert picked["poseId"] == "rightProfile"


def test_naso_aural_defaults_right_when_by_pose_present():
    left_url = "/api/media/assessments/abc123/leftProfile.jpg"
    right_url = "/api/media/assessments/abc123/rightProfile.jpg"

    cv = apply_photo_urls_to_cv_report(
        {
            "ears": {
                "earLandmarkSource": "ear_landmarker",
                "sides": {
                    "right": _good_ear_side("rightProfile", 0.20),
                    "left": _good_ear_side("leftProfile", 0.05),
                },
                "nasoAuralByPose": {
                    "rightProfile": {"yourValue": 0.88},
                    "leftProfile": {"yourValue": 0.91},
                },
            },
            "proportions": {
                "ratios": {
                    "nasoAural": {
                        "photoSource": "leftProfile",
                        "dataSource": "ear_landmarker",
                        "yourValue": 0.82,
                    },
                },
            },
        },
        {"leftProfile": left_url, "rightProfile": right_url},
    )
    naso = cv["proportions"]["ratios"]["nasoAural"]
    assert naso["photoSource"] == "rightProfile"
    assert naso["imageSrc"] == right_url


def test_naso_aural_infers_left_from_ear_landmarker_when_photo_source_missing():
    left_url = "/api/media/assessments/abc123/leftProfile.jpg"
    right_url = "/api/media/assessments/abc123/rightProfile.jpg"
    cv = apply_photo_urls_to_cv_report(
        {
            "ears": {
                "earLandmarkSource": "ear_landmarker",
                "sides": {
                    "right": {"status": "failed", "reason": "edge_collapse"},
                    "left": _good_ear_side("leftProfile", 0.06),
                },
            },
            "proportions": {
                "ratios": {
                    "nasoAural": {
                        "dataSource": "ear_landmarker",
                        "yourValue": 0.82,
                    },
                },
            },
        },
        {"leftProfile": left_url, "rightProfile": right_url},
    )
    naso = cv["proportions"]["ratios"]["nasoAural"]
    assert naso["photoSource"] == "leftProfile"
    assert naso["imageSrc"] == left_url


def test_naso_aural_binds_right_when_both_improper_but_measurable():
    left_url = "/api/media/assessments/abc123/leftProfile.jpg"
    right_url = "/api/media/assessments/abc123/rightProfile.jpg"
    bad_right = _good_ear_side("rightProfile", 0.20)
    bad_right["edgeCollapseFrac"] = 0.20
    from backend.ear_analysis import evaluate_ear_capture

    bad_right["earCapture"] = evaluate_ear_capture(bad_right)
    bad_left = _good_ear_side("leftProfile", 0.20)
    bad_left["edgeCollapseFrac"] = 0.20
    bad_left["earCapture"] = evaluate_ear_capture(bad_left)

    cv = apply_photo_urls_to_cv_report(
        {
            "ears": {
                "earLandmarkSource": "ear_landmarker",
                "sides": {"right": bad_right, "left": bad_left},
                "nasoAuralByPose": {
                    "rightProfile": {"yourValue": 0.88, "photoSource": "rightProfile"},
                    "leftProfile": {"yourValue": 0.91, "photoSource": "leftProfile"},
                },
            },
            "proportions": {
                "ratios": {
                    "nasoAural": {
                        "photoSource": "rightProfile",
                        "dataSource": "ear_landmarker",
                    },
                },
            },
        },
        {"leftProfile": left_url, "rightProfile": right_url},
    )
    naso = cv["proportions"]["ratios"]["nasoAural"]
    assert naso["photoSource"] == "rightProfile"
    assert naso["imageSrc"] == right_url


def test_delete_assessment_photos():
    storage = get_photo_storage()
    storage.save_pose("del123", "front", b"\xff\xd8\xff a")
    storage.save_pose("del123", "smile", b"\xff\xd8\xff b")
    storage.delete_assessment_photos("del123")
    assert storage.media.get_bytes("assessments/del123/front.jpg") is None
    assert storage.media.get_bytes("assessments/del123/smile.jpg") is None
