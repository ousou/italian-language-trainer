"""Gemini (Vertex AI) client wrapper."""
from __future__ import annotations

import os
import subprocess

from google import genai
from google.genai import types

from .schema import ExtractedPayload, ParseError, parse_extracted_json


class GeminiConfigError(RuntimeError):
    """Raised when project configuration is missing."""


def detect_project() -> str:
    """Resolve a GCP project id from env or gcloud config."""
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
        raise GeminiConfigError(
            "No GCP project configured. Set GOOGLE_CLOUD_PROJECT or pass --project."
        )
    return output


def _extract_text(response: types.GenerateContentResponse) -> str:
    text = response.text
    if not text:
        raise ParseError("Model response was empty.")
    return text


def extract_pairs(
    *,
    image_bytes: bytes,
    prompt: str,
    model: str,
    project: str | None,
    location: str,
    allow_repair: bool = True,
) -> ExtractedPayload:
    """Call Gemini with an image and prompt, returning validated JSON."""
    project_id = project or detect_project()
    client = genai.Client(vertexai=True, project=project_id, location=location)

    image_part = types.Part.from_bytes(data=image_bytes, mime_type="image/jpeg")
    response_schema = {
        "type": "OBJECT",
        "properties": {
            "items": {
                "type": "ARRAY",
                "items": {
                    "type": "OBJECT",
                    "properties": {
                        "surface": {"type": "STRING"},
                        "lemma": {"type": "STRING"},
                        "lemma_dst": {"type": "STRING"},
                        "src": {"type": "STRING"},
                        "dst": {"type": "STRING"},
                    },
                },
            }
        },
        "required": ["items"],
    }

    config = types.GenerateContentConfig(
        temperature=0,
        topP=1,
        topK=1,
        candidateCount=1,
        seed=1,
        responseMimeType="application/json",
        responseSchema=response_schema,
    )
    last_error: ParseError | None = None
    retry_prompt = prompt + "\nReturn strictly valid JSON only."

    for attempt in range(3):
        response = client.models.generate_content(
            model=model,
            contents=[prompt if attempt == 0 else retry_prompt, image_part],
            config=config,
        )
        raw_text = _extract_text(response)

        try:
            return parse_extracted_json(raw_text)
        except ParseError as exc:
            last_error = exc
            if not allow_repair:
                continue

        repair_prompt = (
            "Fix the following text into valid JSON that matches the schema shown. "
            "Return ONLY JSON, no extra text.\n\n"
            "Schema: {\"items\": [{\"surface\": \"...\", \"lemma\": \"...\", "
            "\"lemma_dst\": \"...\", \"dst\": \"...\"}]}\n\n"
            f"Text to fix:\n{raw_text}"
        )
        repair_response = client.models.generate_content(
            model=model,
            contents=repair_prompt,
            config=config,
        )
        repaired_text = _extract_text(repair_response)
        try:
            return parse_extracted_json(repaired_text)
        except ParseError as exc:
            last_error = exc

    raise last_error or ParseError("Failed to parse model output.")
