"""Normalization helpers for text and ids."""
from __future__ import annotations

import re
import unicodedata


_PUNCT_TRANSLATION = str.maketrans(
    {
        "“": '"',
        "”": '"',
        "„": '"',
        "’": "'",
        "‘": "'",
        "`": "'",
        "–": "-",
        "—": "-",
        "…": "...",
        " ": " ",
    }
)

_SENTENCE_START_RE = re.compile(r"(^|[!?]\s+|\.\s+)([a-zåäö])")
_OCR_APOSTROPHE_RE = re.compile(r"\b[iI][’'](?=[a-z])")
_SENTENCE_PERIOD_RE = re.compile(r"\.(\s|$)")


def normalize_text(value: str) -> str:
    """Normalize whitespace and punctuation without changing meaning."""
    normalized = value.translate(_PUNCT_TRANSLATION)
    normalized = re.sub(r"\s+", " ", normalized).strip()
    return normalized


def normalize_src_text(value: str) -> str:
    """Normalize source text and fix obvious OCR errors."""
    normalized = normalize_text(value)
    normalized = _OCR_APOSTROPHE_RE.sub("l'", normalized)
    return normalized


def normalize_dst_text(value: str) -> str:
    """Normalize target text and enforce sentence casing when punctuated."""
    normalized = normalize_text(value)
    should_case = False
    if "?" in normalized or "!" in normalized:
        should_case = True
    elif "." in normalized and _SENTENCE_PERIOD_RE.search(normalized):
        should_case = True

    if should_case:
        normalized = _SENTENCE_START_RE.sub(
            lambda match: f"{match.group(1)}{match.group(2).upper()}", normalized
        )
    return normalized


def slugify(value: str) -> str:
    """Create a stable ASCII id from a term."""
    normalized = normalize_text(value).lower()
    normalized = normalized.replace("'", "")
    normalized = unicodedata.normalize("NFKD", normalized)
    normalized = normalized.encode("ascii", "ignore").decode("ascii")
    normalized = re.sub(r"[^a-z0-9]+", "-", normalized)
    normalized = normalized.strip("-")
    return normalized or "item"


def ensure_unique_id(base_id: str, existing: set[str]) -> str:
    """Ensure ids are unique by appending numeric suffixes."""
    if base_id not in existing:
        existing.add(base_id)
        return base_id

    counter = 2
    while True:
        candidate = f"{base_id}-{counter}"
        if candidate not in existing:
            existing.add(candidate)
            return candidate
        counter += 1
