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


class FeatureSubsection(BaseModel):
    title: str
    body: str = Field(..., min_length=80, max_length=1500)
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
        return self


class ProtocolOverview(BaseModel):
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

    subsection_item = {
        "type": "object",
        "properties": {
            "title": {"type": "string", "enum": titles},
            "body": {"type": "string", "minLength": 80, "maxLength": 1500},
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
