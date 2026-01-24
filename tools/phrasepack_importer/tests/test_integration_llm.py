import json
import os
from pathlib import Path

import pytest

from phrasepack_importer.gemini_client import extract_pairs
from phrasepack_importer.io import read_image_bytes
from phrasepack_importer.normalize import normalize_text
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
    extracted_src = {normalize_text(item.src).lower() for item in items}

    pack_path = repo_root / "public/phrasepacks/bella-vista-1-ch-1.json"
    pack = json.loads(pack_path.read_text())
    expected_src = {normalize_text(item["src"]).lower() for item in pack["items"]}

    matches = extracted_src & expected_src
    assert len(matches) >= 8
