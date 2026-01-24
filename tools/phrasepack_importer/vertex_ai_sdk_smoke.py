#!/usr/bin/env python3
from __future__ import annotations

import argparse
import os
import subprocess
import sys

from google import genai
from google.genai import types


def _detect_project() -> str:
    env_project = os.environ.get("GOOGLE_CLOUD_PROJECT")
    if env_project:
        return env_project

    try:
        output = subprocess.check_output(
            ["gcloud", "config", "get-value", "project"],
            stderr=subprocess.DEVNULL,
            text=True,
        ).strip()
    except (subprocess.SubprocessError, FileNotFoundError):
        output = ""

    if not output:
        raise RuntimeError(
            "No GCP project configured. Pass --project or set GOOGLE_CLOUD_PROJECT."
        )
    return output


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Smoke test for Vertex AI Python SDK (Gemini + image)."
    )
    parser.add_argument(
        "--image",
        required=True,
        help="Path to a local image file.",
    )
    parser.add_argument("--project", help="GCP project id (defaults to gcloud config).")
    parser.add_argument("--location", default="us-central1", help="Vertex AI region.")
    parser.add_argument(
        "--model",
        default="gemini-2.0-flash-001",
        help="Gemini model id.",
    )
    parser.add_argument(
        "--prompt",
        default="Briefly describe this image.",
        help="Prompt to send with the image.",
    )
    args = parser.parse_args()

    project = args.project or _detect_project()
    client = genai.Client(vertexai=True, project=project, location=args.location)
    with open(args.image, "rb") as f:
        image_part = types.Part.from_bytes(data=f.read(), mime_type="image/jpeg")

    response = client.models.generate_content(
        model=args.model,
        contents=[args.prompt, image_part],
    )
    print(response.text or "")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
