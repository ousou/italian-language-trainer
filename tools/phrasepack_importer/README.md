# Phrasepack Importer Tools

This folder will hold the command-line tooling for creating phrasepack JSON files
from textbook images. It uses the Vertex AI Python SDK (Gemini).

## Setup

From this folder (keep the venv local to `tools/phrasepack_importer/`):

```bash
python3 -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
```

## Smoke test

```bash
python vertex_ai_sdk_smoke.py \
  --image ../../pictures/bella_vista_1_ch_1.jpg \
  --prompt "What languages appear on this page? Answer briefly."
```

You can override the model if needed:

```bash
python vertex_ai_sdk_smoke.py --model gemini-2.0-flash-001 --image ../../pictures/bella_vista_1_ch_1.jpg
```

## Phrasepack extraction (CLI)

```bash
python -m phrasepack_importer \
  --image ../../pictures/bella_vista_1_ch_1.jpg \
  --id bella-vista-1-ch-1 \
  --title "Bella Vista 1 ch 1" \
  --src it \
  --dst fi
```

Generated JSON preserves Unicode characters to match existing phrasepacks.
Extraction normalizes casing for punctuated translations and fixes common OCR
apostrophe errors like `i'amico` → `l'amico`.
Sentence casing is only applied for questions/exclamations or sentence-ending
periods (not abbreviations like `(prep.)`).
Prompts instruct the model to ignore headings or instructions and only capture
paired vocabulary entries.
If a lemma/base form is present in the image, the model should place it in
`lemma` and provide `lemma_dst` so the surface form stays clean for quizzes.
If the model ignores this and includes lemmas in parentheses, the importer
keeps only the surface form to avoid pairing the wrong translation.
Lemma entries are skipped when `lemma_dst` matches the surface translation.

## Tests

Unit tests:

```bash
pip install -r requirements-dev.txt
pytest
```

Live Gemini integration test (requires network + billing):

```bash
RUN_LLM_TESTS=1 pytest tests/test_integration_llm.py
```

## Import rules

See `tools/phrasepack_importer/IMPORT_RULES.md` for the constraints the importer
must follow (single-answer Italian src, split alternatives, remove annotations).
