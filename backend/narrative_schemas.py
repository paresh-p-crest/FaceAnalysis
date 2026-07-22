"""JSON Schema + Pydantic models for structured PDF narrative generation."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, field_validator, model_validator

from .config import FEATURE_NARRATIVE_IDS, PROTOCOL_FEATURE_IDS

EvidenceTier = Literal["lifestyle", "otc", "refer_clinician"]

FEATURE_SUBSECTION_TITLES: dict[str, list[str]] = {
    "hair": ["Hair Style", "Hair Loss", "Hair Health"],
    "eyes": ["Eyebrows", "Eyelashes", "Eyes", "Under eye"],
    "nose": ["Nose"],
    "cheeks": ["Cheek Structure"],
    "jaw": ["Jaw Structure", "Further Enhancement"],
    "lips": ["Lips"],
    "chin": ["Chin"],
    "skin": ["Skincare Protocol", "Further Skin Enhancement"],
    "neck": ["Neck Size", "Neck Skin"],
    "ears": ["Ear Structure"],
    "smile": ["Smile Shape", "Teeth & Gingiva"],
}

# Body char bounds: short ≈60–90 words, standard ≈100–140, long ≈120–160.
SUBSECTION_BODY_SHORT = (80, 1000)
SUBSECTION_BODY_STANDARD = (80, 1500)
SUBSECTION_BODY_LONG = (80, 2000)

DEFAULT_SUBSECTION_BODY_MIN = SUBSECTION_BODY_STANDARD[0]
DEFAULT_SUBSECTION_BODY_MAX = SUBSECTION_BODY_STANDARD[1]

# Every feature title has an explicit length band (primary = long, secondary = short).
FEATURE_SUBSECTION_BODY_LIMITS: dict[str, dict[str, tuple[int, int]]] = {
    "hair": {
        "Hair Style": SUBSECTION_BODY_LONG,
        "Hair Loss": SUBSECTION_BODY_STANDARD,
        "Hair Health": SUBSECTION_BODY_SHORT,
    },
    "eyes": {
        "Eyebrows": SUBSECTION_BODY_LONG,
        "Eyelashes": SUBSECTION_BODY_SHORT,
        "Eyes": SUBSECTION_BODY_LONG,
        "Under eye": SUBSECTION_BODY_LONG,
    },
    "nose": {
        "Nose": SUBSECTION_BODY_LONG,
    },
    "cheeks": {
        "Cheek Structure": SUBSECTION_BODY_LONG,
    },
    "jaw": {
        "Jaw Structure": SUBSECTION_BODY_LONG,
        "Further Enhancement": SUBSECTION_BODY_SHORT,
    },
    "lips": {
        "Lips": SUBSECTION_BODY_LONG,
    },
    "chin": {
        "Chin": SUBSECTION_BODY_LONG,
    },
    "skin": {
        "Skincare Protocol": SUBSECTION_BODY_LONG,
        "Further Skin Enhancement": SUBSECTION_BODY_SHORT,
    },
    "neck": {
        "Neck Size": SUBSECTION_BODY_STANDARD,
        "Neck Skin": SUBSECTION_BODY_LONG,
    },
    "ears": {
        "Ear Structure": SUBSECTION_BODY_LONG,
    },
    "smile": {
        "Smile Shape": SUBSECTION_BODY_LONG,
        "Teeth & Gingiva": SUBSECTION_BODY_STANDARD,
    },
}


def subsection_body_limits(feature_id: str, title: str) -> tuple[int, int]:
    """Return (min_length, max_length) for a feature subsection body."""
    overrides = FEATURE_SUBSECTION_BODY_LIMITS.get(feature_id) or {}
    return overrides.get(title, (DEFAULT_SUBSECTION_BODY_MIN, DEFAULT_SUBSECTION_BODY_MAX))


def subsection_body_word_target(max_len: int) -> str:
    """Prompt-facing word band for a subsection max char cap."""
    if max_len <= SUBSECTION_BODY_SHORT[1]:
        return "~60–90 words (keep shorter; one focused paragraph)"
    if max_len <= SUBSECTION_BODY_STANDARD[1]:
        return "~100–140 words"
    return "~120–160 words (longer guidance allowed)"


def feature_subsection_length_prompt(feature_id: str) -> str:
    """Bullet list of per-title length targets for the LLM user message."""
    titles = FEATURE_SUBSECTION_TITLES.get(feature_id) or []
    if not titles:
        return ""
    lines = ["Length targets for subsections (qualitative prose only):"]
    for title in titles:
        _min_len, max_len = subsection_body_limits(feature_id, title)
        lines.append(f"- {title}: {subsection_body_word_target(max_len)}.")
    return "\n".join(lines)


class FeatureSubsection(BaseModel):
    title: str
    # Ceiling is the shared upper bound; per-title caps enforced on FeatureNarrative.
    body: str = Field(..., min_length=80, max_length=2000)
    # Assigned server-side when omitted by the LLM (slim schema).
    evidenceTier: EvidenceTier = "otc"

    @field_validator("body")
    @classmethod
    def strip_body(cls, v: str) -> str:
        return v.strip()


class FeatureNarrative(BaseModel):
    """Stored feature page. LLM is only asked for summary + subsections; other fields are hydrated server-side."""

    featureId: str
    summary: str = Field(..., min_length=10, max_length=500)
    subsections: list[FeatureSubsection]
    measuredFacts: list[str] = Field(default_factory=list, max_length=20)
    limitations: list[str] = Field(default_factory=list, max_length=8)
    description: str = Field(default="", max_length=1200)
    recommendations: list[str] = Field(default_factory=list, max_length=8)

    @field_validator("featureId")
    @classmethod
    def valid_feature_id(cls, v: str) -> str:
        if v not in FEATURE_NARRATIVE_IDS:
            raise ValueError(f"featureId must be one of {FEATURE_NARRATIVE_IDS}")
        return v

    @model_validator(mode="after")
    def validate_subsections(self) -> "FeatureNarrative":
        expected = FEATURE_SUBSECTION_TITLES.get(self.featureId, [])
        if len(self.subsections) != len(expected):
            raise ValueError(
                f"{self.featureId} requires {len(expected)} subsections, got {len(self.subsections)}"
            )
        for i, (sub, title) in enumerate(zip(self.subsections, expected)):
            if sub.title != title:
                raise ValueError(
                    f"subsection[{i}] title must be {title!r}, got {sub.title!r}"
                )
            min_len, max_len = subsection_body_limits(self.featureId, title)
            body_len = len(sub.body or "")
            if body_len < min_len:
                raise ValueError(
                    f"subsection {title!r} body must be at least {min_len} characters, got {body_len}"
                )
            if body_len > max_len:
                raise ValueError(
                    f"subsection {title!r} body must be at most {max_len} characters, got {body_len}"
                )
        return self


class ProtocolOverview(BaseModel):
    summary: str = Field(..., min_length=40, max_length=500)


class TreatmentPhaseItem(BaseModel):
    name: str = Field(..., min_length=2, max_length=80)
    detail: str = Field(..., min_length=2, max_length=120)


class TreatmentPhase(BaseModel):
    title: str = Field(..., min_length=4, max_length=80)
    duration: str = Field(..., min_length=4, max_length=80)
    items: list[TreatmentPhaseItem] = Field(..., min_length=2, max_length=3)


class TreatmentPhases(BaseModel):
    phase01: TreatmentPhase
    phase02: TreatmentPhase
    phase03: TreatmentPhase
    summary: str = Field(..., min_length=40, max_length=500)


class ExecutiveNarrative(BaseModel):
    summary: str = Field(..., min_length=40, max_length=600)
    strengths: list[str] = Field(..., min_length=1, max_length=5)
    focusAreas: list[str] = Field(..., min_length=1, max_length=5)
    recommendations: list[str] = Field(..., min_length=2, max_length=8)
    disclaimer: str = Field(..., min_length=20, max_length=300)


class ClosingSynthesis(BaseModel):
    paragraphs: list[str] = Field(..., min_length=3, max_length=5)
    referencedFeatures: list[str] = Field(default_factory=list, max_length=10)

    @field_validator("paragraphs")
    @classmethod
    def strip_paragraphs(cls, v: list[str]) -> list[str]:
        return [p.strip() for p in v if p and p.strip()]


def feature_narrative_json_schema(feature_id: str) -> dict:
    """Slim LLM JSON schema: summary + subsection bodies only (PDF-used fields)."""
    titles = FEATURE_SUBSECTION_TITLES.get(feature_id)
    if not titles:
        raise ValueError(f"Unknown feature_id: {feature_id}")

    # Ordered prefix items so each title can have its own body maxLength.
    subsection_items = []
    for title in titles:
        min_len, max_len = subsection_body_limits(feature_id, title)
        subsection_items.append(
            {
                "type": "object",
                "properties": {
                    "title": {"type": "string", "enum": [title]},
                    "body": {
                        "type": "string",
                        "minLength": min_len,
                        "maxLength": max_len,
                    },
                },
                "required": ["title", "body"],
                "additionalProperties": False,
            }
        )

    # Fallback items schema for providers that ignore prefixItems.
    max_ceiling = max(subsection_body_limits(feature_id, t)[1] for t in titles)
    min_floor = min(subsection_body_limits(feature_id, t)[0] for t in titles)
    subsection_item = {
        "type": "object",
        "properties": {
            "title": {"type": "string", "enum": titles},
            "body": {
                "type": "string",
                "minLength": min_floor,
                "maxLength": max_ceiling,
            },
        },
        "required": ["title", "body"],
        "additionalProperties": False,
    }

    return {
        "type": "object",
        "properties": {
            "featureId": {"type": "string", "enum": [feature_id]},
            "summary": {"type": "string", "minLength": 10, "maxLength": 500},
            "subsections": {
                "type": "array",
                "minItems": len(titles),
                "maxItems": len(titles),
                "prefixItems": subsection_items,
                "items": subsection_item,
            },
        },
        "required": ["featureId", "summary", "subsections"],
        "additionalProperties": False,
    }


def protocol_overview_json_schema() -> dict:
    return {
        "type": "object",
        "properties": {
            "summary": {"type": "string", "minLength": 40, "maxLength": 500},
        },
        "required": ["summary"],
        "additionalProperties": False,
    }


def treatment_phases_json_schema() -> dict:
    item = {
        "type": "object",
        "properties": {
            "name": {"type": "string", "minLength": 2, "maxLength": 80},
            "detail": {"type": "string", "minLength": 2, "maxLength": 120},
        },
        "required": ["name", "detail"],
        "additionalProperties": False,
    }
    phase = {
        "type": "object",
        "properties": {
            "title": {"type": "string", "minLength": 4, "maxLength": 80},
            "duration": {"type": "string", "minLength": 4, "maxLength": 80},
            "items": {"type": "array", "items": item, "minItems": 2, "maxItems": 3},
        },
        "required": ["title", "duration", "items"],
        "additionalProperties": False,
    }
    return {
        "type": "object",
        "properties": {
            "phase01": phase,
            "phase02": phase,
            "phase03": phase,
            "summary": {"type": "string", "minLength": 40, "maxLength": 500},
        },
        "required": ["phase01", "phase02", "phase03", "summary"],
        "additionalProperties": False,
    }


def closing_synthesis_json_schema() -> dict:
    return {
        "type": "object",
        "properties": {
            "paragraphs": {
                "type": "array",
                "items": {"type": "string", "minLength": 80, "maxLength": 900},
                "minItems": 3,
                "maxItems": 5,
            },
            "referencedFeatures": {
                "type": "array",
                "items": {"type": "string", "enum": list(PROTOCOL_FEATURE_IDS)},
                "maxItems": 10,
            },
        },
        "required": ["paragraphs"],
        "additionalProperties": False,
    }


def executive_narrative_json_schema() -> dict:
    return {
        "type": "object",
        "properties": {
            "summary": {"type": "string", "minLength": 40, "maxLength": 600},
            "strengths": {
                "type": "array",
                "items": {"type": "string"},
                "minItems": 1,
                "maxItems": 5,
            },
            "focusAreas": {
                "type": "array",
                "items": {"type": "string"},
                "minItems": 1,
                "maxItems": 5,
            },
            "recommendations": {
                "type": "array",
                "items": {"type": "string"},
                "minItems": 2,
                "maxItems": 8,
            },
            "disclaimer": {"type": "string", "minLength": 20, "maxLength": 300},
        },
        "required": ["summary", "strengths", "focusAreas", "recommendations", "disclaimer"],
        "additionalProperties": False,
    }
