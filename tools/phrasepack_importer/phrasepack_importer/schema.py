"""Schema models for LLM extraction and phrasepacks."""
from __future__ import annotations

import json
from typing import Any, Iterable

from pydantic import BaseModel, ValidationError, model_validator


class ExtractedItem(BaseModel):
    surface: str | None = None
    lemma: str | None = None
    src: str | None = None
    dst: str | None = None

    @model_validator(mode="after")
    def _require_surface(self) -> "ExtractedItem":
        if not (self.surface or self.src):
            raise ValueError("Each item must include surface or src.")
        return self

    def resolved_surface(self) -> str:
        return self.surface or self.src or ""


class ExtractedPayload(BaseModel):
    items: list[ExtractedItem]


class PhrasepackItem(BaseModel):
    id: str
    src: str
    dst: str


class Phrasepack(BaseModel):
    type: str
    id: str
    title: str
    src: str
    dst: str
    items: list[PhrasepackItem]


class ParseError(ValueError):
    """Raised when JSON parsing or schema validation fails."""


class ValidationReport(BaseModel):
    items: list[ExtractedItem]


def _strip_code_fences(raw: str) -> str:
    text = raw.strip()
    if not text.startswith("```"):
        return text

    lines = text.splitlines()
    if lines and lines[0].startswith("```"):
        lines = lines[1:]
    if lines and lines[-1].startswith("```"):
        lines = lines[:-1]
    return "\n".join(lines).strip()


def parse_extracted_json(raw: str) -> ExtractedPayload:
    """Parse and validate raw JSON from the LLM."""
    try:
        data = json.loads(_strip_code_fences(raw))
    except json.JSONDecodeError as exc:
        raise ParseError(f"Invalid JSON: {exc}") from exc

    try:
        return ExtractedPayload.model_validate(data)
    except ValidationError as exc:
        raise ParseError(f"JSON schema mismatch: {exc}") from exc


def assert_non_empty(items: Iterable[ExtractedItem]) -> list[ExtractedItem]:
    """Ensure the extraction returned at least one item."""
    items_list = [
        item
        for item in items
        if item.dst and item.resolved_surface().strip()
    ]
    if not items_list:
        raise ParseError("No items were extracted from the image.")
    return items_list


def serialize_phrasepack(phrasepack: Phrasepack) -> dict[str, Any]:
    """Return a JSON-serializable dict with stable key ordering."""
    return phrasepack.model_dump()
