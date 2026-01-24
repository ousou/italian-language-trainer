"""Prompt templates for extracting vocab pairs from images."""
from __future__ import annotations

import json


_SCHEMA_EXAMPLE = {
    "items": [
        {"src": "ciao", "dst": "moi"},
        {"src": "come?", "dst": "miten?"},
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
        "- Output must be valid JSON, no markdown or extra text.\n"
        "- The JSON root object has a single field: items.\n"
        "- Each item has src (source term) and dst (target term).\n"
        "- Keep terms as they appear in the image, preserving punctuation.\n"
        "- If multiple translations exist, include them in dst separated by '; '.\n\n"
        "Schema example:\n"
        f"{schema}\n"
    )
