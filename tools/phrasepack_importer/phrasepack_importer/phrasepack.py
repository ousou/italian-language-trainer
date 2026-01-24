"""Phrasepack assembly helpers."""
from __future__ import annotations

from .normalize import (
    ensure_unique_id,
    normalize_dst_text,
    normalize_src_text,
    slugify,
    split_surface_and_lemmas,
)
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
        surface = normalize_src_text(item.resolved_surface())
        if not item.dst:
            continue
        dst = normalize_dst_text(item.dst)
        if not surface or not dst:
            continue

        lemma = normalize_src_text(item.lemma) if item.lemma else None
        variants = split_surface_and_lemmas(surface, lemma)

        for src in variants:
            base_id = slugify(src)
            item_id = ensure_unique_id(base_id, seen_ids)
            items.append(PhrasepackItem(id=item_id, src=src, dst=dst))

        if item.lemma and item.lemma_dst and lemma:
            if lemma.lower() not in {v.lower() for v in variants}:
                lemma_dst = normalize_dst_text(item.lemma_dst)
                if lemma_dst and lemma_dst != dst:
                    lemma_id = ensure_unique_id(slugify(lemma), seen_ids)
                    items.append(PhrasepackItem(id=lemma_id, src=lemma, dst=lemma_dst))

    return Phrasepack(
        type="vocab",
        id=pack_id,
        title=title,
        src=src_lang,
        dst=dst_lang,
        items=items,
    )
