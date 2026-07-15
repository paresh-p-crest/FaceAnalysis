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


def test_delete_assessment_photos():
    storage = get_photo_storage()
    storage.save_pose("del123", "front", b"\xff\xd8\xff a")
    storage.save_pose("del123", "smile", b"\xff\xd8\xff b")
    storage.delete_assessment_photos("del123")
    assert storage.media.get_bytes("assessments/del123/front.jpg") is None
    assert storage.media.get_bytes("assessments/del123/smile.jpg") is None
