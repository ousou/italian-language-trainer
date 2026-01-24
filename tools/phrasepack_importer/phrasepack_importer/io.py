"""File IO helpers for the phrasepack importer."""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any


def read_image_bytes(path: Path) -> bytes:
    """Load an image file as bytes."""
    return path.read_bytes()


def write_json(path: Path, payload: dict[str, Any]) -> None:
    """Write JSON to disk with stable formatting."""
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=True, indent=2) + "\n")
