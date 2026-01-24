"""Phrasepack assembly helpers."""
from __future__ import annotations

from .normalize import ensure_unique_id, normalize_text, slugify
from .schema import ExtractedItem, Phrasepack, PhrasepackItem


def build_phrasepack(
    *,
    pack_id: str,
    title: str,
    src_lang: str,
    dst_lang: str,
    extracted_items: list[ExtractedItem],
) -> Phrasepack:
    """Build a phrasepack from extracted items with normalized ids."""
    seen_ids: set[str] = set()
    items: list[PhrasepackItem] = []

    for item in extracted_items:
        src = normalize_text(item.src)
        dst = normalize_text(item.dst)
        if not src or not dst:
            continue

        base_id = slugify(src)
        item_id = ensure_unique_id(base_id, seen_ids)
        items.append(PhrasepackItem(id=item_id, src=src, dst=dst))

    return Phrasepack(
        type="vocab",
        id=pack_id,
        title=title,
        src=src_lang,
        dst=dst_lang,
        items=items,
    )
