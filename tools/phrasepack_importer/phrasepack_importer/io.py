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
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n")


class RepoRootNotFoundError(RuntimeError):
    """Raised when the repository root cannot be located."""


def detect_repo_root() -> Path:
    """Find the repository root by locating the app public/phrasepacks.

    The tools directory also has a public/phrasepacks folder for fixtures,
    so we first prefer a directory that looks like the app root.
    """
    for start in [Path.cwd(), Path(__file__).resolve()]:
        for parent in [start, *start.parents]:
            if (parent / "package.json").is_file() and (parent / "public" / "phrasepacks").is_dir():
                return parent
        for parent in [start, *start.parents]:
            if (parent / "public" / "phrasepacks").is_dir():
                return parent
    raise RepoRootNotFoundError(
        "Could not locate repo root (public/phrasepacks not found)."
    )


def default_phrasepack_output_path(pack_id: str) -> Path:
    """Default output path under the app's public/phrasepacks folder."""
    repo_root = detect_repo_root()
    return repo_root / "public" / "phrasepacks" / f"{pack_id}.json"
