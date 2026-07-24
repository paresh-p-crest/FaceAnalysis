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
_STYLE_PREFERENCES = ("masculine", "feminine", "no-preference")


def resolve_style_preference(answers: Optional[dict]) -> str:
    """Map questionnaire answers to a style-bank key.

    1. genderPreference masculine / feminine → that bank
    2. else if growBeard === yes → masculine (soft proxy)
    3. else → no-preference
    """
    ans = answers or {}
    pref = str(ans.get("genderPreference") or "").strip().lower()
    if pref in ("masculine", "feminine"):
        return pref
    if str(ans.get("growBeard") or "").strip().lower() == "yes":
        return "masculine"
    return "no-preference"


# ── Masculine hair (existing barbershop bank) ─────────────────────────────────

_MASCULINE_HAIR: dict[str, list[HairStyleSpec]] = {
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


_FEMININE_HAIR: dict[str, list[HairStyleSpec]] = {
    "oval": [
        HairStyleSpec(
            style_id="soft_layered_bob",
            display_name="Soft Layered Bob",
            descriptor="a soft layered bob with gentle movement and clean ends that flatter balanced proportions",
        ),
        HairStyleSpec(
            style_id="long_face_framing_layers",
            display_name="Long Face-Framing Layers",
            descriptor="long face-framing layers with soft movement that skim the cheeks and jaw",
        ),
        HairStyleSpec(
            style_id="soft_side_part_feminine",
            display_name="Soft Side Part",
            descriptor="a soft side part with polished mid-length volume and natural flow",
        ),
        HairStyleSpec(
            style_id="curtain_bangs_medium",
            display_name="Curtain Bangs Medium",
            descriptor="medium-length hair with soft curtain bangs gently framing the forehead",
        ),
        HairStyleSpec(
            style_id="soft_updo_framing",
            display_name="Soft Updo Framing",
            descriptor="a soft, loosely gathered updo with face-framing pieces left free around the temples",
        ),
    ],
    "round": [
        HairStyleSpec(
            style_id="crown_volume_long_layers",
            display_name="Crown Volume Long Layers",
            descriptor="long layers with lift at the crown to add height and elongate a rounder face",
        ),
        HairStyleSpec(
            style_id="soft_pixie_with_height",
            display_name="Soft Pixie With Height",
            descriptor="a soft pixie with textured crown height and tapered sides for a longer silhouette",
        ),
        HairStyleSpec(
            style_id="long_layers_with_lift",
            display_name="Long Layers With Lift",
            descriptor="long layered hair with crown lift and tapered ends to reduce roundness",
        ),
        HairStyleSpec(
            style_id="side_swept_bangs_height",
            display_name="Side-Swept Bangs With Height",
            descriptor="side-swept bangs with volume on top to create vertical emphasis",
        ),
        HairStyleSpec(
            style_id="textured_lob_height",
            display_name="Textured Lob With Height",
            descriptor="a textured lob with subtle crown lift and soft ends for a taller face read",
        ),
    ],
    "square": [
        HairStyleSpec(
            style_id="soft_waves_jaw",
            display_name="Soft Waves (Jaw Softening)",
            descriptor="soft waves with movement around the jaw to ease angular corners",
        ),
        HairStyleSpec(
            style_id="rounded_bob",
            display_name="Rounded Bob",
            descriptor="a rounded bob with curved ends that soften a strong jawline",
        ),
        HairStyleSpec(
            style_id="face_framing_layers_soft",
            display_name="Face-Framing Soft Layers",
            descriptor="face-framing soft layers that blend corners and create a gentler outline",
        ),
        HairStyleSpec(
            style_id="curtain_bangs_soft",
            display_name="Soft Curtain Bangs",
            descriptor="soft curtain bangs with medium length to ease forehead lines and soften angles",
        ),
        HairStyleSpec(
            style_id="medium_layers_soft_corners",
            display_name="Medium Layers (Soft Corners)",
            descriptor="medium layered hair with soft ends that reduce boxiness around the face",
        ),
    ],
    "heart": [
        HairStyleSpec(
            style_id="chin_length_soft_bob",
            display_name="Chin-Length Soft Bob",
            descriptor="a chin-length soft bob that adds balanced weight lower down without bulk at the temples",
        ),
        HairStyleSpec(
            style_id="side_swept_layers_balance",
            display_name="Side-Swept Layers (Balance)",
            descriptor="side-swept medium layers that balance mid-face width and frame the jaw gently",
        ),
        HairStyleSpec(
            style_id="soft_curtain_bangs_heart",
            display_name="Soft Curtain Bangs",
            descriptor="soft curtain bangs that reduce forehead emphasis while keeping the look feminine",
        ),
        HairStyleSpec(
            style_id="shoulder_waves_balance",
            display_name="Shoulder Waves (Balance)",
            descriptor="shoulder-length soft waves that add lower-face balance and gentle width",
        ),
        HairStyleSpec(
            style_id="textured_lob_jaw_balance",
            display_name="Textured Lob (Jaw Balance)",
            descriptor="a textured lob with soft ends that visually balance a narrower jaw",
        ),
    ],
    "oblong": [
        HairStyleSpec(
            style_id="soft_bangs_width",
            display_name="Soft Bangs With Width",
            descriptor="soft bangs with side volume to visually shorten length and add width",
        ),
        HairStyleSpec(
            style_id="wavy_shoulder_layers",
            display_name="Wavy Shoulder Layers",
            descriptor="wavy shoulder-length layers that add horizontal volume without extra height",
        ),
        HairStyleSpec(
            style_id="side_part_soft_width",
            display_name="Soft Side Part With Width",
            descriptor="a soft side part with fuller sides to create a more even face proportion",
        ),
        HairStyleSpec(
            style_id="chin_bob_horizontal",
            display_name="Chin Bob (Horizontal)",
            descriptor="a chin-length bob with soft horizontal volume to reduce a long silhouette",
        ),
        HairStyleSpec(
            style_id="curtain_bangs_side_volume_soft",
            display_name="Curtain Bangs (Side Volume)",
            descriptor="curtain bangs with soft side volume to add width while keeping the top controlled",
        ),
    ],
    "neutral": [
        HairStyleSpec(
            style_id="soft_layered_bob",
            display_name="Soft Layered Bob",
            descriptor="a soft layered bob with gentle movement and clean ends",
        ),
        HairStyleSpec(
            style_id="long_face_framing_layers",
            display_name="Long Face-Framing Layers",
            descriptor="long face-framing layers with soft movement around the cheeks and jaw",
        ),
        HairStyleSpec(
            style_id="soft_side_part_feminine",
            display_name="Soft Side Part",
            descriptor="a soft side part with polished mid-length volume and natural flow",
        ),
        HairStyleSpec(
            style_id="curtain_bangs_medium",
            display_name="Curtain Bangs Medium",
            descriptor="medium-length hair with soft curtain bangs gently framing the forehead",
        ),
        HairStyleSpec(
            style_id="medium_soft_layers_fem",
            display_name="Medium Soft Layers",
            descriptor="medium soft layers with natural movement and a gentle feminine silhouette",
        ),
    ],
}


_NO_PREF_HAIR: dict[str, list[HairStyleSpec]] = {
    "oval": [
        HairStyleSpec(
            style_id="medium_soft_layers",
            display_name="Medium Soft Layers",
            descriptor="medium soft layers with natural movement and a balanced, unisex silhouette",
        ),
        HairStyleSpec(
            style_id="curtain_fringe_neutral",
            display_name="Curtain Fringe",
            descriptor="a curtain fringe with soft separation and gentle framing at the forehead",
        ),
        HairStyleSpec(
            style_id="soft_textured_top",
            display_name="Soft Textured Top",
            descriptor="a soft textured top with clean tapered sides — neat without a heavy barbershop read",
        ),
        HairStyleSpec(
            style_id="balanced_side_part",
            display_name="Balanced Side Part",
            descriptor="a balanced side part with controlled mid-length volume for a polished neutral look",
        ),
        HairStyleSpec(
            style_id="shoulder_soft_layers",
            display_name="Shoulder Soft Layers",
            descriptor="shoulder-length soft layers with easy movement and gender-neutral framing",
        ),
    ],
    "round": [
        HairStyleSpec(
            style_id="crown_lift_soft_layers",
            display_name="Crown Lift Soft Layers",
            descriptor="soft layers with crown lift to add height without a strongly gendered cut",
        ),
        HairStyleSpec(
            style_id="textured_top_height",
            display_name="Textured Top With Height",
            descriptor="a textured top with lift at the crown and softly tapered sides",
        ),
        HairStyleSpec(
            style_id="long_layers_neutral_lift",
            display_name="Long Layers With Lift",
            descriptor="long layers with subtle crown lift to elongate a rounder face",
        ),
        HairStyleSpec(
            style_id="side_swept_fringe_height",
            display_name="Side-Swept Fringe With Height",
            descriptor="a side-swept fringe with top volume for vertical emphasis",
        ),
        HairStyleSpec(
            style_id="lob_soft_height",
            display_name="Soft Lob With Height",
            descriptor="a soft lob with slight crown lift and clean ends",
        ),
    ],
    "square": [
        HairStyleSpec(
            style_id="soft_waves_neutral",
            display_name="Soft Waves",
            descriptor="soft waves with natural separation to ease angular lines around the jaw",
        ),
        HairStyleSpec(
            style_id="rounded_soft_bob",
            display_name="Rounded Soft Bob",
            descriptor="a rounded soft bob with curved ends that soften a strong jawline",
        ),
        HairStyleSpec(
            style_id="face_framing_neutral_layers",
            display_name="Face-Framing Layers",
            descriptor="face-framing layers that blend corners into a softer overall shape",
        ),
        HairStyleSpec(
            style_id="curtain_fringe_soft_neutral",
            display_name="Soft Curtain Fringe",
            descriptor="a soft curtain fringe with medium length to ease forehead lines",
        ),
        HairStyleSpec(
            style_id="medium_layers_neutral",
            display_name="Medium Soft Layers",
            descriptor="medium soft layers that reduce boxiness while staying unisex",
        ),
    ],
    "heart": [
        HairStyleSpec(
            style_id="chin_length_neutral",
            display_name="Chin-Length Soft Cut",
            descriptor="a chin-length soft cut that adds balance lower down without temple bulk",
        ),
        HairStyleSpec(
            style_id="side_swept_neutral_layers",
            display_name="Side-Swept Medium Layers",
            descriptor="side-swept medium layers that balance mid-face width and frame the jaw",
        ),
        HairStyleSpec(
            style_id="soft_curtain_neutral",
            display_name="Soft Curtain Fringe",
            descriptor="a soft curtain fringe that gently reduces forehead emphasis",
        ),
        HairStyleSpec(
            style_id="shoulder_waves_neutral",
            display_name="Shoulder Soft Waves",
            descriptor="shoulder-length soft waves that add lower-face balance",
        ),
        HairStyleSpec(
            style_id="textured_lob_neutral",
            display_name="Textured Soft Lob",
            descriptor="a textured soft lob with ends that visually balance a narrower jaw",
        ),
    ],
    "oblong": [
        HairStyleSpec(
            style_id="fringe_width_neutral",
            display_name="Soft Fringe With Width",
            descriptor="a soft fringe with side volume to visually shorten length and add width",
        ),
        HairStyleSpec(
            style_id="wavy_shoulder_neutral",
            display_name="Wavy Shoulder Layers",
            descriptor="wavy shoulder layers that add horizontal volume without extra height",
        ),
        HairStyleSpec(
            style_id="side_part_width_neutral",
            display_name="Side Part With Soft Width",
            descriptor="a side part with fuller sides for a more even face proportion",
        ),
        HairStyleSpec(
            style_id="chin_bob_neutral",
            display_name="Chin Soft Bob",
            descriptor="a chin-length soft bob with horizontal volume to reduce a long silhouette",
        ),
        HairStyleSpec(
            style_id="curtain_side_volume_neutral",
            display_name="Curtain Fringe (Side Volume)",
            descriptor="a curtain fringe with soft side volume while keeping the top controlled",
        ),
    ],
    "neutral": [
        HairStyleSpec(
            style_id="medium_soft_layers",
            display_name="Medium Soft Layers",
            descriptor="medium soft layers with natural movement and a balanced silhouette",
        ),
        HairStyleSpec(
            style_id="curtain_fringe_neutral",
            display_name="Curtain Fringe",
            descriptor="a curtain fringe with soft separation and gentle framing at the forehead",
        ),
        HairStyleSpec(
            style_id="soft_textured_top",
            display_name="Soft Textured Top",
            descriptor="a soft textured top with clean tapered sides",
        ),
        HairStyleSpec(
            style_id="balanced_side_part",
            display_name="Balanced Side Part",
            descriptor="a balanced side part with controlled mid-length volume",
        ),
        HairStyleSpec(
            style_id="shoulder_soft_layers",
            display_name="Shoulder Soft Layers",
            descriptor="shoulder-length soft layers with easy movement",
        ),
    ],
}


HAIR_STYLES_BY_PREFERENCE: dict[str, dict[str, list[HairStyleSpec]]] = {
    "masculine": _MASCULINE_HAIR,
    "feminine": _FEMININE_HAIR,
    "no-preference": _NO_PREF_HAIR,
}

# Backward-compatible alias (masculine bank).
HAIR_STYLES_BY_FACE_SHAPE = _MASCULINE_HAIR


_MASCULINE_OUTFIT: list[OutfitStyleSpec] = [
    OutfitStyleSpec(
        style_id="professional",
        occasion_name="Professional/Business",
        descriptor="a tailored blazer or structured shirt, polished and office-appropriate",
    ),
    OutfitStyleSpec(
        style_id="smart_casual",
        occasion_name="Smart-Casual",
        descriptor="a knit or oxford with a light jacket, refined but relaxed",
    ),
    OutfitStyleSpec(
        style_id="casual_everyday",
        occasion_name="Casual Everyday",
        descriptor="a clean tee or casual shirt, approachable weekend wear",
    ),
    OutfitStyleSpec(
        style_id="minimalist_monochrome",
        occasion_name="Minimalist Monochrome",
        descriptor="simple tonal layers in a restrained palette with clean lines",
    ),
    OutfitStyleSpec(
        style_id="textured_layered",
        occasion_name="Textured Layered",
        descriptor="a cardigan or light overshirt with subtle depth and layering",
    ),
]

_FEMININE_OUTFIT: list[OutfitStyleSpec] = [
    OutfitStyleSpec(
        style_id="professional",
        occasion_name="Professional/Business",
        descriptor="a tailored blazer or structured blouse, polished and office-appropriate",
    ),
    OutfitStyleSpec(
        style_id="smart_casual",
        occasion_name="Smart-Casual",
        descriptor="a soft knit or silk blouse with a light jacket, refined but relaxed",
    ),
    OutfitStyleSpec(
        style_id="casual_everyday",
        occasion_name="Casual Everyday",
        descriptor="a clean tee or soft knit top, approachable weekend wear",
    ),
    OutfitStyleSpec(
        style_id="minimalist_monochrome",
        occasion_name="Minimalist Monochrome",
        descriptor="simple tonal layers in a restrained palette with clean feminine lines",
    ),
    OutfitStyleSpec(
        style_id="textured_layered",
        occasion_name="Textured Layered",
        descriptor="a soft cardigan or light wrap layer with subtle depth and layering",
    ),
]

_NO_PREF_OUTFIT: list[OutfitStyleSpec] = [
    OutfitStyleSpec(
        style_id="professional",
        occasion_name="Professional/Business",
        descriptor="a tailored blazer or structured top, polished and office-appropriate",
    ),
    OutfitStyleSpec(
        style_id="smart_casual",
        occasion_name="Smart-Casual",
        descriptor="a soft knit or neat shirt with a light jacket, refined but relaxed",
    ),
    OutfitStyleSpec(
        style_id="casual_everyday",
        occasion_name="Casual Everyday",
        descriptor="a clean tee or simple top, approachable weekend wear",
    ),
    OutfitStyleSpec(
        style_id="minimalist_monochrome",
        occasion_name="Minimalist Monochrome",
        descriptor="simple tonal layers in a restrained palette with clean lines",
    ),
    OutfitStyleSpec(
        style_id="textured_layered",
        occasion_name="Textured Layered",
        descriptor="a cardigan or light layering piece with subtle depth",
    ),
]

OUTFIT_STYLES_BY_PREFERENCE: dict[str, list[OutfitStyleSpec]] = {
    "masculine": _MASCULINE_OUTFIT,
    "feminine": _FEMININE_OUTFIT,
    "no-preference": _NO_PREF_OUTFIT,
}

# Backward-compatible alias (masculine outfit bank).
OUTFIT_STYLES = _MASCULINE_OUTFIT


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


def hair_styles_for(cv_report: dict, answers: Optional[dict] = None) -> list[HairStyleSpec]:
    pref = resolve_style_preference(answers)
    bank = HAIR_STYLES_BY_PREFERENCE.get(pref) or HAIR_STYLES_BY_PREFERENCE["no-preference"]
    key = resolve_face_shape_key(cv_report or {})
    return bank[key]


def outfit_styles_for(answers: Optional[dict] = None) -> list[OutfitStyleSpec]:
    pref = resolve_style_preference(answers)
    return list(OUTFIT_STYLES_BY_PREFERENCE.get(pref) or OUTFIT_STYLES_BY_PREFERENCE["no-preference"])


def iter_all_hair_styles() -> list[HairStyleSpec]:
    """Flatten all preference × face-shape hair banks (for styleId lookup)."""
    seen: set[str] = set()
    out: list[HairStyleSpec] = []
    for pref in _STYLE_PREFERENCES:
        for styles in HAIR_STYLES_BY_PREFERENCE[pref].values():
            for spec in styles:
                if spec.style_id in seen:
                    continue
                seen.add(spec.style_id)
                out.append(spec)
    return out
