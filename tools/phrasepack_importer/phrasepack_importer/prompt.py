"""Prompt templates for extracting vocab pairs from images."""
from __future__ import annotations

import json


_SCHEMA_EXAMPLE = {
    "items": [
        {"surface": "vanno", "lemma": "andare", "lemma_dst": "mennä", "dst": "menevat"},
        {"surface": "come?", "dst": "miten?"},
    ]
}


def build_extraction_prompt(src_lang: str, dst_lang: str) -> str:
    """Return a strict JSON-only extraction prompt for the LLM."""
    schema = json.dumps(_SCHEMA_EXAMPLE, ensure_ascii=True, indent=2)
    return (
        "You are extracting a bilingual wordlist from a textbook image.\n"
        f"Return ONLY valid JSON in the exact schema shown below.\n\n"
        f"Source language: {src_lang}\n"
        f"Target language: {dst_lang}\n\n"
        "Rules:\n"
        "- Ignore any non-vocabulary text like headings, instructions, or notes.\n"
        "- Only include entries that show a source term paired with its translation.\n"
        "- Output must be valid JSON, no markdown or extra text.\n"
        "- The JSON root object has a single field: items.\n"
        "- Each item has surface (the exact form shown in the image) and dst.\n"
        "- If a base form/lemma is shown, put it in lemma and provide its translation in lemma_dst.\n"
        "- If lemma_dst would be identical to dst, omit lemma and lemma_dst.\n"
        "- Do not append lemma text to surface.\n"
        "- Keep terms as they appear in the image, preserving punctuation.\n"
        "- If multiple translations exist, include them in dst separated by '; '.\n\n"
        "Schema example:\n"
        f"{schema}\n"
    )
