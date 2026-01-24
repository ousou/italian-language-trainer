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
_SRC_LEMMA_RE = re.compile(r"^(?P<surface>[^()]+?)\s*\((?P<lemma>[^)]+)\)\s*$")
_LEADING_SRC_JUNK_RE = re.compile(r'^[\".]+\s*(?=[^\W\d_])')
_ALT_SPLIT_RE = re.compile(r"[,/;]\s*")
_ALT_TOKEN_RE = re.compile(r"^[^\W\d_]+(?:['-][^\W\d_]+)*$", re.UNICODE)

_GENDER_TOKENS = {
    "fi": ("mies", "nainen"),
    "sv": ("man", "kvinna"),
}


def normalize_text(value: str) -> str:
    """Normalize whitespace and punctuation without changing meaning."""
    normalized = value.translate(_PUNCT_TRANSLATION)
    normalized = re.sub(r"\s+", " ", normalized).strip()
    return normalized


def normalize_src_text(value: str) -> str:
    """Normalize source text and fix obvious OCR errors."""
    normalized = normalize_text(value)
    normalized = normalized.replace("*", "")
    normalized = _OCR_APOSTROPHE_RE.sub("l'", normalized)
    normalized = _LEADING_SRC_JUNK_RE.sub("", normalized)
    if normalized.lower() == "si":
        normalized = "s\u00ec"
    return normalized


def split_surface_and_lemmas(surface: str, lemma: str | None) -> list[str]:
    """Split parenthesized lemmas and obvious alternative lists."""
    match = _SRC_LEMMA_RE.match(surface)
    if not match:
        base = surface
    else:
        base = match.group("surface").strip()

    # Split obvious single-token alternatives like "italiano, italiana" into
    # separate quiz answers. Avoid splitting multi-word phrases with commas.
    if any(sep in base for sep in [",", "/", ";"]):
        parts = [p.strip() for p in _ALT_SPLIT_RE.split(base) if p.strip()]
        if len(parts) >= 2 and all(_ALT_TOKEN_RE.match(p) for p in parts):
            return parts

    return [base]


def split_gendered_dst(dst: str, dst_lang: str, count: int) -> list[str] | None:
    """Split gender-combined dst notes to match split src alternatives.

    Example: "italialainen (mies, nainen)" -> ["italialainen (mies)", "italialainen (nainen)"]
    """
    if count != 2:
        return None
    tokens = _GENDER_TOKENS.get(dst_lang)
    if not tokens:
        return None
    male, female = tokens[0], tokens[1]

    text = normalize_text(dst)
    l = text.rfind("(")
    r = text.rfind(")")
    if l == -1 or r == -1 or r < l:
        return None
    inside = text[l + 1 : r].casefold()
    if male not in inside or female not in inside:
        return None

    # Determine order based on appearance within the parenthesized note.
    order = [male, female] if inside.find(male) < inside.find(female) else [female, male]

    prefix = text[:l].rstrip()
    suffix = text[r + 1 :].lstrip()
    if suffix and suffix[0] in ".,;:!?":
        joiner = ""
    elif suffix:
        joiner = " "
    else:
        joiner = ""

    return [f"{prefix} ({gender}){joiner}{suffix}".strip() for gender in order]


def normalize_dst_text(value: str) -> str:
    """Normalize target text and enforce sentence casing when punctuated."""
    normalized = normalize_text(value)
    # The model sometimes uses semicolons as list separators; prefer commas for
    # synonym lists while keeping semicolons for clearly separate clauses.
    normalized = normalized.replace("?; ", "? ").replace("!; ", "! ").replace(".; ", ". ")
    normalized = re.sub(r";\s+(?=[a-zåäö])", ", ", normalized)
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
