"""Unit tests for temple-geometry Norwood staging (no photo IO required)."""

from __future__ import annotations

import numpy as np

from backend.hair_analysis import _norwood_stage, _norwood_stage_geometric
from backend.hair_segmentation import (
    _density_roi_below_hairline,
    _hairline_row_at_column,
    _temple_recession_metrics,
)


def test_norwood_geometric_stage1_low_temple_recession():
    tm = {
        "templeRecession": 0.01,
        "midFrontalFrac": 0.10,
    }
    assert _norwood_stage_geometric(tm, density_pct=30.0, thinning="None detected") == 1


def test_norwood_geometric_stage2_moderate_temple():
    tm = {"templeRecession": 0.05, "midFrontalFrac": 0.12}
    assert _norwood_stage_geometric(tm, density_pct=40.0, thinning="None detected") == 2


def test_norwood_geometric_stage3_from_midline_or_deep_temple():
    tm = {"templeRecession": 0.10, "midFrontalFrac": 0.15}
    assert _norwood_stage_geometric(tm, density_pct=40.0, thinning="None detected") == 3
    tm2 = {"templeRecession": 0.04, "midFrontalFrac": 0.25}
    assert _norwood_stage_geometric(tm2, density_pct=40.0, thinning="None detected") == 3


def test_norwood_geometric_density_escalates_only_from_stage3():
    # Stage 1 geometry must not jump to 6 solely from low density
    tm = {"templeRecession": 0.01, "midFrontalFrac": 0.10}
    assert _norwood_stage_geometric(tm, density_pct=10.0, thinning="None detected") == 1
    # Stage 3+ can escalate via density
    tm3 = {"templeRecession": 0.10, "midFrontalFrac": 0.15}
    assert _norwood_stage_geometric(tm3, density_pct=10.0, thinning="None detected") >= 6


def test_density_fallback_still_callable():
    assert _norwood_stage(50.0, "Full", "None detected") == 1


def test_temple_metrics_symmetric_full_hairline():
    # Synthetic: solid hair band from row 0.08h downward → near-zero temple recession
    h, w = 200, 200
    mask = np.zeros((h, w), dtype=np.uint8)
    mask[int(h * 0.08) :, :] = 255
    tm = _temple_recession_metrics(mask)
    assert tm["templeRecession"] < 0.03
    assert tm["midHairlineRow"] < int(h * 0.15)


def test_temple_metrics_detects_bilateral_recessions():
    h, w = 200, 200
    mask = np.zeros((h, w), dtype=np.uint8)
    # Mid hairline early
    mask[int(h * 0.10) :, int(w * 0.35) : int(w * 0.65)] = 255
    # Temples start much lower
    mask[int(h * 0.28) :, : int(w * 0.35)] = 255
    mask[int(h * 0.28) :, int(w * 0.65) :] = 255
    tm = _temple_recession_metrics(mask)
    assert tm["templeRecession"] >= 0.07


def test_density_roi_clamps_extreme_hairline_rows():
    h, w = 100, 100
    mask = np.ones((h, w), dtype=np.uint8) * 255
    roi0 = _density_roi_below_hairline(mask, 0)
    assert roi0.size > 0
    roi_far = _density_roi_below_hairline(mask, int(h * 0.9))
    assert roi_far.size > 0


def test_hairline_row_returns_end_when_empty():
    mask = np.zeros((50, 50), dtype=np.uint8)
    assert _hairline_row_at_column(mask, 25, 8, 1, 40) == 40


if __name__ == "__main__":
    test_norwood_geometric_stage1_low_temple_recession()
    test_norwood_geometric_stage2_moderate_temple()
    test_norwood_geometric_stage3_from_midline_or_deep_temple()
    test_norwood_geometric_density_escalates_only_from_stage3()
    test_density_fallback_still_callable()
    test_temple_metrics_symmetric_full_hairline()
    test_temple_metrics_detects_bilateral_recessions()
    test_density_roi_clamps_extreme_hairline_rows()
    test_hairline_row_returns_end_when_empty()
    print("all hair norwood geometry tests passed")
