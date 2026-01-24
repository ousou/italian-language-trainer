import json
import os
from pathlib import Path

import pytest

from phrasepack_importer.gemini_client import extract_pairs
from phrasepack_importer.io import read_image_bytes
from phrasepack_importer.normalize import normalize_text
from phrasepack_importer.phrasepack import build_phrasepack
from phrasepack_importer.prompt import build_extraction_prompt
from phrasepack_importer.schema import assert_non_empty


@pytest.mark.skipif(
    os.environ.get("RUN_LLM_TESTS") != "1",
    reason="Set RUN_LLM_TESTS=1 to run live Gemini integration test.",
)
def test_extracts_known_terms_from_ch1_image():
    repo_root = Path(__file__).resolve().parents[3]
    image_path = repo_root / "pictures/bella_vista_1_ch_1.jpg"
    prompt = build_extraction_prompt("it", "fi")
    model = os.environ.get("LLM_MODEL", "gemini-2.0-flash-001")
    location = os.environ.get("LLM_LOCATION", "us-central1")

    extracted = extract_pairs(
        image_bytes=read_image_bytes(image_path),
        prompt=prompt,
        model=model,
        project=os.environ.get("GOOGLE_CLOUD_PROJECT"),
        location=location,
    )

    items = assert_non_empty(extracted.items)
    phrasepack = build_phrasepack(
        pack_id="bella-vista-1-ch-1",
        title="Bella Vista 1 ch 1",
        src_lang="it",
        dst_lang="fi",
        extracted_items=items,
    )

    fixture_path = repo_root / "tools/phrasepack_importer/tests/fixtures/ch1_expected.json"
    expected = json.loads(fixture_path.read_text())

    actual_items = sorted(
        [(normalize_text(item.src), normalize_text(item.dst)) for item in phrasepack.items]
    )
    expected_items = sorted(
        [(normalize_text(item["src"]), normalize_text(item["dst"])) for item in expected["items"]]
    )

    assert actual_items == expected_items
    assert all("(" not in src and ")" not in src for src, _ in actual_items)
