"""Prompt templates for extracting vocab pairs from images."""
from __future__ import annotations

import json


_RAW_SCHEMA_EXAMPLE = {
    "pairs": [
        {"src": "abito", "dst": "asun"},
        {"src": "vanno (andare*)", "dst": "menevat"},
    ]
}

_ITEMS_SCHEMA_EXAMPLE = {
    "items": [
        {"surface": "abito", "dst": "asun"},
        {"surface": "vanno", "lemma": "andare", "lemma_dst": "mennä", "dst": "menevat"},
        {"surface": "come?", "dst": "miten?"},
    ]
}


def build_image_pairs_prompt(src_lang: str, dst_lang: str) -> str:
    """Prompt for step 1: transcribe raw src/dst pairs from the image."""
    schema = json.dumps(_RAW_SCHEMA_EXAMPLE, ensure_ascii=True, indent=2)
    return (
        "You are transcribing a bilingual vocabulary list from a textbook image.\n"
        "Return ONLY valid JSON in the exact schema shown below.\n\n"
        f"Source language: {src_lang}\n"
        f"Target language: {dst_lang}\n\n"
        "Rules:\n"
        "- Ignore any non-vocabulary text like headings, page numbers, instructions, or notes.\n"
        "- Only include entries that clearly show a source term paired with its translation.\n"
        "- Keep terms as they appear in the image (including punctuation and parentheses).\n"
        "- Do not normalize, expand, or rewrite terms.\n"
        "- Preserve punctuation as it appears in the image (commas/semicolons).\n"
        "- Output must be valid JSON only (no markdown, no extra text).\n\n"
        "Schema example:\n"
        f"{schema}\n"
    )


def build_pairs_to_items_prompt(src_lang: str, dst_lang: str) -> str:
    """Prompt for step 2: turn raw pairs into clean extraction JSON per IMPORT_RULES."""
    schema = json.dumps(_ITEMS_SCHEMA_EXAMPLE, ensure_ascii=True, indent=2)
    return (
        "You are cleaning a raw extracted bilingual word list.\n"
        "Input is JSON pairs extracted from an image. Output is cleaned JSON in the schema below.\n\n"
        f"Source language: {src_lang}\n"
        f"Target language: {dst_lang}\n\n"
        "Rules (must follow):\n"
        "- Ignore any non-vocabulary text (headings/instructions) if present in the input.\n"
        "- surface must be the Italian quiz answer: a single word or a single fixed phrase.\n"
        "- Do NOT combine alternatives in one surface string (split into separate items).\n"
        "- Do NOT include lemma annotations or study notes in surface (no parentheses, no '*').\n"
        "- Do not translate, paraphrase, or normalize meanings.\n"
        "- Always keep the translation from the input word list.\n"
        "- Do not guess missing translations or add new items not supported by the input.\n"
        "- Keep punctuation in surface only when it's part of the quiz answer (e.g. 'Come?').\n"
        "- Keep translations as they appear in the input (commas/semicolons).\n\n"
        "Lemmas/base forms:\n"
        "- If the input contains a separate pair for the lemma/base form, include it as its own item.\n"
        "- Otherwise, do not invent lemma_dst.\n\n"
        "- Output must be valid JSON only (no markdown, no extra text).\n\n"
        "Schema example:\n"
        f"{schema}\n"
    )


def build_extraction_prompt(src_lang: str, dst_lang: str) -> str:
    """Backwards-compatible alias for step-2 prompt."""
    return build_pairs_to_items_prompt(src_lang, dst_lang)
