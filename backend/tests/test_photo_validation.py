"""Tests for required photo pose validation."""

from backend.photo_validation import missing_required_poses, validate_required_poses


def test_all_poses_present():
    photos = {
        "front": b"x",
        "leftProfile": b"x",
        "rightProfile": b"x",
        "left45": b"x",
        "right45": b"x",
        "smile": b"x",
        "topHead": b"x",
    }
    assert missing_required_poses(photos) == []
    assert validate_required_poses(photos) == []


def test_missing_poses():
    photos = {"front": b"x", "smile": b"x"}
    missing = missing_required_poses(photos)
    assert "leftProfile" in missing
    assert "rightProfile" in missing
    assert "left45" in missing
    assert "right45" in missing
    assert "topHead" in missing
    assert "front" not in missing


def test_empty_bytes_counted_as_missing():
    photos = {pid: b"" for pid in ("front", "leftProfile", "rightProfile", "left45", "right45", "smile", "topHead")}
    assert len(missing_required_poses(photos)) == 7
