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


def normalize_text(value: str) -> str:
    """Normalize whitespace and punctuation without changing meaning."""
    normalized = value.translate(_PUNCT_TRANSLATION)
    normalized = re.sub(r"\s+", " ", normalized).strip()
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
