"""Unit tests for photo_storage.py"""

import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from backend.photo_storage import LocalPublicPhotoStorage, apply_photo_urls_to_cv_report


def test_save_and_url_binding():
    with tempfile.TemporaryDirectory() as tmp:
        storage = LocalPublicPhotoStorage(upload_root=Path(tmp) / "assessments")
        stored = storage.save_pose("abc123", "front", b"\xff\xd8\xff fake jpeg")
        assert stored.poseId == "front"
        assert "abc123/front.jpg" in stored.publicUrl
        assert stored.byteSize > 0

        cv = apply_photo_urls_to_cv_report(
            {"faceShape": {}, "symmetry": {}, "proportions": {"ratios": {"nasoAural": {}}}},
            {"front": stored.publicUrl, "rightProfile": "/uploads/assessments/abc123/rightProfile.jpg"},
        )
        assert cv["photos"]["front"] == stored.publicUrl
        assert cv["faceShape"]["imageSrc"] == stored.publicUrl
        assert cv["proportions"]["ratios"]["nasoAural"]["photoSource"] == "rightProfile"
