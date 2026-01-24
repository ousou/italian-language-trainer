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
