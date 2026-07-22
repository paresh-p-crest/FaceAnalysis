from __future__ import annotations

from dataclasses import dataclass
from typing import Optional


@dataclass(frozen=True)
class HairStyleSpec:
    style_id: str
    display_name: str
    descriptor: str


@dataclass(frozen=True)
class OutfitStyleSpec:
    style_id: str
    occasion_name: str
    descriptor: str


@dataclass(frozen=True)
class AgingTierSpec:
    style_id: str
    years: int
    skin_text: str
    soft_tissue_text: str
    hair_dark_text: str
    hair_light_text: str


_UNKNOWN_STYLE_KEY = "neutral"


HAIR_STYLES_BY_FACE_SHAPE: dict[str, list[HairStyleSpec]] = {
    # Balanced, widely compatible options.
    "oval": [
        HairStyleSpec(
            style_id="textured_crop",
            display_name="Textured Crop",
            descriptor="short, choppy layers with natural movement on top and clean tapered sides",
        ),
        HairStyleSpec(
            style_id="side_part_classic",
            display_name="Side Part Classic",
            descriptor="a classic side part with balanced length and controlled volume for a polished silhouette",
        ),
        HairStyleSpec(
            style_id="slick_back",
            display_name="Slick Back",
            descriptor="a sleek, glossy slick-back with disciplined side-to-top flow and a clean finish",
        ),
        HairStyleSpec(
            style_id="curtain_fringe",
            display_name="Curtain Fringe",
            descriptor="a curtain fringe with soft separation and gentle framing at the forehead",
        ),
        HairStyleSpec(
            style_id="buzz_crew_cut",
            display_name="Buzz/Crew Cut",
            descriptor="a short buzz or crew cut with tight edges and a neat, low-maintenance shape",
        ),
    ],
    # Add height and angularity.
    "round": [
        HairStyleSpec(
            style_id="textured_quiff",
            display_name="Textured Quiff",
            descriptor="a textured quiff with lift at the crown and tapered sides for extra height",
        ),
        HairStyleSpec(
            style_id="undercut_volume_top",
            display_name="Undercut Volume Top",
            descriptor="an undercut with volume on top to elongate the face and sharpen the sides",
        ),
        HairStyleSpec(
            style_id="angular_fringe",
            display_name="Angular Fringe",
            descriptor="an angular fringe that creates stronger lines across the forehead while keeping the sides clean",
        ),
        HairStyleSpec(
            style_id="high_fade_pompadour",
            display_name="High-Fade Pompadour",
            descriptor="a high-fade pompadour with elevated front volume and a crisp taper",
        ),
        HairStyleSpec(
            style_id="side_part_height",
            display_name="Side Part With Height",
            descriptor="a side part with extra height on top to reduce roundness and improve structure",
        ),
    ],
    # Soften angles.
    "square": [
        HairStyleSpec(
            style_id="textured_crop_soft_fringe",
            display_name="Textured Crop (Soft Fringe)",
            descriptor="a textured crop paired with a soft fringe to ease straight lines around the forehead",
        ),
        HairStyleSpec(
            style_id="side_swept_undercut",
            display_name="Side-Swept Undercut",
            descriptor="a side-swept undercut with blended texture to keep edges sharp but not harsh",
        ),
        HairStyleSpec(
            style_id="tousled_waves",
            display_name="Tousled Waves",
            descriptor="light, tousled waves with natural separation to soften the jawline impression",
        ),
        HairStyleSpec(
            style_id="layered_medium_length",
            display_name="Layered Medium Length",
            descriptor="medium length with layered movement that blends corners and creates a softer overall shape",
        ),
        HairStyleSpec(
            style_id="low_taper_soft_top",
            display_name="Low Taper (Soft Top)",
            descriptor="a low taper with a softer top texture to keep structure while reducing boxiness",
        ),
    ],
    # Avoid adding heavy width; balance and frame the jaw.
    "heart": [
        HairStyleSpec(
            style_id="side_swept_medium_layers",
            display_name="Side-Swept Medium Layers",
            descriptor="side-swept medium layers that create balanced weight around the mid-face and jaw",
        ),
        HairStyleSpec(
            style_id="chin_length_textured_cut",
            display_name="Chin-Length Textured Cut",
            descriptor="a chin-length textured cut that adds controlled balance lower down without looking bulky",
        ),
        HairStyleSpec(
            style_id="soft_curtain_fringe",
            display_name="Soft Curtain Fringe",
            descriptor="a soft curtain fringe with gentle framing to reduce emphasis on the forehead",
        ),
        HairStyleSpec(
            style_id="classic_taper_side_part",
            display_name="Classic Taper (Side Part)",
            descriptor="a classic taper with a side part for tidy structure and calmer facial framing",
        ),
        HairStyleSpec(
            style_id="textured_forward_fringe",
            display_name="Textured Forward Fringe",
            descriptor="a textured forward fringe to visually balance the proportions while keeping the overall look natural",
        ),
    ],
    # Add width without excessive vertical height.
    "oblong": [
        HairStyleSpec(
            style_id="textured_fringe_horizontal_volume",
            display_name="Textured Fringe (Horizontal Volume)",
            descriptor="a textured fringe with horizontal volume to visually reduce length and add width",
        ),
        HairStyleSpec(
            style_id="side_part_with_width",
            display_name="Side Part (With Width)",
            descriptor="a side part with extra width on the sides to create a more even face proportion",
        ),
        HairStyleSpec(
            style_id="medium_wavy_layers",
            display_name="Medium Wavy Layers",
            descriptor="medium wavy layers that add balanced texture and a wider-looking silhouette",
        ),
        HairStyleSpec(
            style_id="low_fade_soft_textured_top",
            display_name="Low Fade (Soft Textured Top)",
            descriptor="a low fade with a soft textured top to keep the shape neat while avoiding extra height",
        ),
        HairStyleSpec(
            style_id="curtain_fringe_side_volume",
            display_name="Curtain Fringe (Side Volume)",
            descriptor="a curtain fringe with side volume to add width while keeping the top controlled",
        ),
    ],
    "neutral": [
        HairStyleSpec(
            style_id="textured_crop",
            display_name="Textured Crop",
            descriptor="short, choppy layers with natural movement on top and clean tapered sides",
        ),
        HairStyleSpec(
            style_id="side_part_classic",
            display_name="Side Part Classic",
            descriptor="a classic side part with balanced length and controlled volume for a polished silhouette",
        ),
        HairStyleSpec(
            style_id="layered_medium_texture",
            display_name="Medium Textured Layers",
            descriptor="medium textured layers that add movement without making the style look overly sharp",
        ),
        HairStyleSpec(
            style_id="low_taper_soft_top",
            display_name="Low Taper",
            descriptor="a low taper with a soft, natural top texture that keeps framing clean",
        ),
        HairStyleSpec(
            style_id="curtain_fringe",
            display_name="Curtain Fringe",
            descriptor="a curtain fringe with soft separation and gentle framing at the forehead",
        ),
    ],
}


OUTFIT_STYLES: list[OutfitStyleSpec] = [
    OutfitStyleSpec(
        style_id="professional",
        occasion_name="professional/business",
        descriptor="a tailored blazer or structured shirt, polished and office-appropriate",
    ),
    OutfitStyleSpec(
        style_id="smart_casual",
        occasion_name="smart-casual",
        descriptor="a knit or oxford with a light jacket, refined but relaxed",
    ),
    OutfitStyleSpec(
        style_id="casual_everyday",
        occasion_name="casual everyday",
        descriptor="a clean tee or casual shirt, approachable weekend wear",
    ),
    OutfitStyleSpec(
        style_id="minimalist_monochrome",
        occasion_name="minimalist monochrome",
        descriptor="simple tonal layers in a restrained palette with clean lines",
    ),
    OutfitStyleSpec(
        style_id="textured_layered",
        occasion_name="textured layered",
        descriptor="a cardigan or light overshirt with subtle depth and layering",
    ),
]


AGING_TIERS: list[AgingTierSpec] = [
    AgingTierSpec(
        style_id="aging_3",
        years=3,
        skin_text="negligible texture change, minor freshness reduction",
        hair_dark_text="no visible change to color or density",
        hair_light_text="no visible change to color or density",
        soft_tissue_text="no visible change",
    ),
    AgingTierSpec(
        style_id="aging_5",
        years=5,
        skin_text="fine lines beginning at eyes and forehead, slight texture change",
        hair_dark_text="subtle early graying at temples, no density change",
        hair_light_text="no change to hair color or density",
        soft_tissue_text="very subtle softening under the eyes only",
    ),
    AgingTierSpec(
        style_id="aging_10",
        years=10,
        skin_text="visible fine lines at eyes, forehead, and mouth corners; mild texture and tone change",
        hair_dark_text=(
            "light natural graying at temples and hairline, subtle change in hair density "
            "consistent with natural aging (do not introduce baldness patterns not already present in the reference)"
        ),
        hair_light_text=(
            "no change to hair color; subtle change in hair density consistent with natural aging "
            "(do not introduce baldness patterns not already present in the reference)"
        ),
        soft_tissue_text=(
            "mild, natural softening around the jawline and under-eye area — no sagging or jowls, "
            "no volume loss severe enough to change face shape"
        ),
    ),
]


def resolve_face_shape_key(cv_report: dict) -> str:
    """Normalize cvReport.faceShape.shape to lookup key.

    ponytail: This is intentionally strict to prevent silent Oval fallbacks. Unknown
    values map to a neutral consultation bank.
    """

    raw = (cv_report or {}).get("faceShape") or {}
    shape = raw.get("shape") if isinstance(raw, dict) else None
    if not isinstance(shape, str):
        return _UNKNOWN_STYLE_KEY

    key = shape.strip().lower()
    mapping = {
        "oval": "oval",
        "round": "round",
        "square": "square",
        "heart": "heart",
        "oblong": "oblong",
    }
    return mapping.get(key, _UNKNOWN_STYLE_KEY)


def hair_styles_for(cv_report: dict) -> list[HairStyleSpec]:
    key = resolve_face_shape_key(cv_report or {})
    # key is always one of HAIR_STYLES_BY_FACE_SHAPE keys.
    return HAIR_STYLES_BY_FACE_SHAPE[key]

