"""Tests for BSON/JSON-safe serialization of analysis payloads."""

from __future__ import annotations

import numpy as np

from backend.serialization import to_json_safe


def test_to_json_safe_converts_numpy_bool():
    out = to_json_safe({"ok": np.True_, "no": np.False_})
    assert out == {"ok": True, "no": False}
    assert type(out["ok"]) is bool
    assert type(out["no"]) is bool


def test_to_json_safe_converts_numpy_numbers_and_arrays():
    out = to_json_safe({
        "i": np.int64(7),
        "f": np.float64(1.5),
        "arr": np.array([1, 2], dtype=np.int32),
    })
    assert out == {"i": 7, "f": 1.5, "arr": [1, 2]}
    assert type(out["i"]) is int
    assert type(out["f"]) is float
