"""Canonical 16-page Qoves protocol PDF section map."""

from __future__ import annotations

from typing import Literal

from .config import PROTOCOL_FEATURE_IDS
from .narrative_schemas import FEATURE_SUBSECTION_TITLES

PageKind = Literal["static", "generated"]

PROTOCOL_PAGE_IDS = (
    "cover",
    "disclaimer",
    "intro",
    "understanding",
    "protocol_overview",
    *PROTOCOL_FEATURE_IDS,
    "closing",
)

STATIC_PAGE_IDS = frozenset({"cover", "disclaimer", "intro", "understanding"})

GENERATED_PAGE_IDS = frozenset(
    {"protocol_overview", "closing", *PROTOCOL_FEATURE_IDS}
)

PROTOCOL_PAGE_META: list[dict] = [
    {"id": "cover", "page": 1, "kind": "static", "label": "Cover"},
    {"id": "disclaimer", "page": 2, "kind": "static", "label": "Disclaimer"},
    {"id": "intro", "page": 3, "kind": "static", "label": "Introduction"},
    {"id": "understanding", "page": 4, "kind": "static", "label": "Understanding Your Results"},
    {"id": "protocol_overview", "page": 5, "kind": "generated", "label": "Client Protocol"},
    {"id": "hair", "page": 6, "kind": "generated", "label": "Hair Recommendations"},
    {"id": "eyes", "page": 7, "kind": "generated", "label": "Eye Recommendations"},
    {"id": "nose", "page": 8, "kind": "generated", "label": "Nose Recommendations"},
    {"id": "cheeks", "page": 9, "kind": "generated", "label": "Cheek Recommendations"},
    {"id": "jaw", "page": 10, "kind": "generated", "label": "Jaw Recommendations"},
    {"id": "lips", "page": 11, "kind": "generated", "label": "Lip Recommendations"},
    {"id": "chin", "page": 12, "kind": "generated", "label": "Chin Recommendations"},
    {"id": "skin", "page": 13, "kind": "generated", "label": "Skin Recommendations"},
    {"id": "neck", "page": 14, "kind": "generated", "label": "Neck Recommendations"},
    {"id": "ears", "page": 15, "kind": "generated", "label": "Ear Recommendations"},
    {"id": "closing", "page": 16, "kind": "generated", "label": "Closing Recommendations"},
]

FEATURE_PAGE_NUMBERS = {
    item["id"]: item["page"]
    for item in PROTOCOL_PAGE_META
    if item["id"] in PROTOCOL_FEATURE_IDS
}


def subsection_titles_for_feature(feature_id: str) -> list[str]:
    return list(FEATURE_SUBSECTION_TITLES.get(feature_id, []))


def is_static_page(page_id: str) -> bool:
    return page_id in STATIC_PAGE_IDS
