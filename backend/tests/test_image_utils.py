import base64

import pytest

from backend.image_utils import decode_image, decode_photo_dict


def _tiny_jpeg_data_url() -> str:
    # Minimal JPEG file bytes (valid header/footer, not a renderable photo).
    raw = bytes.fromhex(
        "ffd8ffe000104a46494600010100000100010000ffdb004300"
        "080606070605080707070909080a0c140d0c0b0b0c1912130f"
        "141d1a1f1e1d1a1c1c20242e2720222c231c1c2837292c303134"
        "34341f27393d38323c2e333432ffdb0043010909090c0b0c18"
        "0d0d1832211c213232323232323232323232323232323232"
        "3232323232323232323232323232323232323232ffc0001108"
        "0001000103011100021100031100ffc4001500010100000000"
        "0000000000000000000000ffc4001410010000000000000000"
        "00000000000000ffda0008010100003f00d2cfd0ffd9"
    )
    return "data:image/jpeg;base64," + base64.b64encode(raw).decode("ascii")


def test_decode_image_data_url():
    decoded = decode_image(_tiny_jpeg_data_url())
    assert decoded.startswith(b"\xff\xd8")


def test_decode_photo_dict_skips_invalid_entries():
    good = _tiny_jpeg_data_url()
    photos = decode_photo_dict({"front": good, "bad": "not-base64!!!"})
    assert "front" in photos
    assert "bad" not in photos


def test_decode_image_rejects_empty_string():
    with pytest.raises(ValueError):
        decode_image("")
