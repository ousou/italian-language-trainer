"""CLI entrypoint for phrasepack importer."""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

from .gemini_client import extract_pairs
from .io import default_phrasepack_output_path, read_image_bytes, write_json
from .phrasepack import build_phrasepack
from .prompt import build_image_pairs_prompt, build_pairs_to_items_prompt
from .schema import ParseError, assert_non_empty, serialize_phrasepack


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Extract bilingual wordlists from images into phrasepack JSON."
    )
    parser.add_argument("--image", required=True, help="Path to the input image.")
    parser.add_argument("--id", required=True, help="Phrasepack id.")
    parser.add_argument("--title", required=True, help="Phrasepack title.")
    parser.add_argument("--src", required=True, help="Source language code.")
    parser.add_argument("--dst", required=True, help="Target language code.")
    parser.add_argument(
        "--out",
        help="Output JSON path (defaults to public/phrasepacks/<id>.json).",
    )
    parser.add_argument(
        "--model",
        default="gemini-2.0-flash-001",
        help="Gemini model id.",
    )
    parser.add_argument(
        "--location",
        default="us-central1",
        help="Vertex AI location.",
    )
    parser.add_argument("--project", help="GCP project id.")
    parser.add_argument(
        "--no-repair",
        action="store_true",
        help="Disable JSON repair pass.",
    )
    return parser


def run(argv: list[str]) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)

    image_path = Path(args.image)
    if not image_path.exists():
        print(f"Image not found: {image_path}", file=sys.stderr)
        return 2

    output_path = Path(args.out) if args.out else default_phrasepack_output_path(args.id)

    try:
        print("Building prompts...")
        image_prompt = build_image_pairs_prompt(args.src, args.dst)
        transform_prompt = build_pairs_to_items_prompt(args.src, args.dst)
        print("Reading image...")
        image_bytes = read_image_bytes(image_path)
        print("Extracting pairs with Gemini...")
        extracted = extract_pairs(
            image_bytes=image_bytes,
            image_prompt=image_prompt,
            transform_prompt=transform_prompt,
            model=args.model,
            project=args.project,
            location=args.location,
            allow_repair=not args.no_repair,
        )
        print("Validating extracted items...")
        items = assert_non_empty(extracted.items)
    except ParseError as exc:
        print(f"Extraction failed: {exc}", file=sys.stderr)
        return 1

    print("Building phrasepack...")
    phrasepack = build_phrasepack(
        pack_id=args.id,
        title=args.title,
        src_lang=args.src,
        dst_lang=args.dst,
        extracted_items=items,
    )
    print("Writing output...")
    write_json(output_path, serialize_phrasepack(phrasepack))
    print(f"Wrote phrasepack: {output_path}")
    return 0


def main() -> int:
    return run(sys.argv[1:])
