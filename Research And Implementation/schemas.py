"""Shared data formats (frozen on Day 1). Layer 1 -> SpecialistReport -> Layer 2 -> Result."""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, field_validator, model_validator

from regions import country_of, validate_code

_EPS = 1e-6


class Clue(BaseModel):
    category: Literal["language", "text", "road_number", "sign", "bollard", "plate",
                      "road_marking", "vegetation", "terrain", "architecture", "sun", "other"]
    observation: str                # what was seen: "white bollard with red reflector"
    raw_text: str | None = None     # exact text read, if any: "N-632", "Rua da Igreja"
    view_id: str                    # which crop it came from: "yaw135_tile2"
    implies: list[str]              # places it points to: ["FR"], ["ES-GA","ES-AS"]
    excludes: list[str] = []        # places it rules out
    confidence: float = Field(ge=0, le=1)

    @field_validator("implies", "excludes")
    @classmethod
    def _codes(cls, v: list[str]) -> list[str]:
        return [validate_code(c) for c in v]


class SpecialistReport(BaseModel):  # Layer 1 -> Layer 2
    specialist: str                 # "text", "road", "environment", "built", "sun", "plonk", "geoclip"
    image_id: str
    clues: list[Clue]               # empty list = nothing useful visible
    region_scores: dict[str, float] = {}   # optional prior, e.g. from PLONK or GeoCLIP
    localizability: float | None = None    # PLONK only

    @field_validator("region_scores")
    @classmethod
    def _scores(cls, v: dict[str, float]) -> dict[str, float]:
        for c in v:
            validate_code(c)
        return v


class Hint(BaseModel):              # pasted in by the user
    type: Literal["country", "region", "city", "text", "other"]
    value: str                      # ISO code for country/region; free text for city/text/other

    @model_validator(mode="after")
    def _check(self) -> "Hint":
        if self.type in ("country", "region"):
            validate_code(self.value)
            is_country = "-" not in self.value
            if (self.type == "country") != is_country:
                raise ValueError(f"{self.type} hint has wrong code granularity: {self.value}")
        return self


class Candidate(BaseModel):         # Layer 2 output
    rank: int = Field(ge=1)
    lat: float = Field(ge=-90, le=90)
    lon: float = Field(ge=-180, le=180)
    radius_km: float = Field(ge=0)
    name: str
    region: str
    probability: float = Field(ge=0, le=1)
    evidence: list[str]
    verified_by: list[str] = []

    @field_validator("region")
    @classmethod
    def _region(cls, v: str) -> str:
        return validate_code(v)


class Result(BaseModel):            # what the UI / CLI / eval consumes
    image_id: str
    candidates: list[Candidate]
    region_probs: dict[str, float]  # THE authoritative region answer
    low_confidence: bool = False
    hint_advice: Literal["submit", "take_hint"]
    suggested_hint: str | None = None
    hints_used: list[Hint] = []

    @field_validator("region_probs")
    @classmethod
    def _probs(cls, v: dict[str, float]) -> dict[str, float]:
        for c, p in v.items():
            validate_code(c)
            if p < 0:
                raise ValueError(f"negative probability for {c}")
        if sum(v.values()) > 1 + _EPS:
            raise ValueError("region_probs sum to more than 1")
        return v

    @model_validator(mode="after")
    def _check(self) -> "Result":
        if sum(c.probability for c in self.candidates) > 1 + _EPS:
            raise ValueError("candidate probabilities sum to more than 1")
        return self

    def top_region(self) -> str | None:
        """argmax(region_probs), preferring region codes over bare country codes."""
        regions = {c: p for c, p in self.region_probs.items() if "-" in c}
        pool = regions or self.region_probs
        return max(pool, key=pool.get) if pool else None

    def top_country(self) -> str | None:
        """Country with the largest summed probability (regions + bare country codes)."""
        totals: dict[str, float] = {}
        for c, p in self.region_probs.items():
            totals[country_of(c)] = totals.get(country_of(c), 0.0) + p
        return max(totals, key=totals.get) if totals else None
