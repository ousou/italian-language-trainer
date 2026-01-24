"""Gemini (Vertex AI) client wrapper."""
from __future__ import annotations

import os
import subprocess

from google import genai
from google.genai import types

from .schema import (
    ExtractedPayload,
    ParseError,
    RawPairsPayload,
    assert_non_empty_pairs,
    parse_extracted_json,
    parse_raw_pairs_json,
 )


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


def _default_config(*, response_schema: dict) -> types.GenerateContentConfig:
    # temperature=0 + seed makes this as deterministic as Gemini/Vertex supports.
    return types.GenerateContentConfig(
        temperature=0,
        topP=1,
        topK=1,
        candidateCount=1,
        seed=1,
        responseMimeType="application/json",
        responseSchema=response_schema,
    )


def _call_json_with_repair(
    *,
    client: genai.Client,
    model: str,
    contents: list[types.Part | str] | str,
    config: types.GenerateContentConfig,
    parse_fn,
    allow_repair: bool,
    repair_schema_hint: str,
) -> object:
    last_error: ParseError | None = None
    retry_suffix = "\nReturn strictly valid JSON only."

    for attempt in range(3):
        response = client.models.generate_content(
            model=model,
            contents=(
                [contents + ("" if attempt == 0 else retry_suffix)]
                if isinstance(contents, str)
                else [
                    (contents[0] + ("" if attempt == 0 else retry_suffix)),
                    *contents[1:],
                ]
            ),
            config=config,
        )
        raw_text = _extract_text(response)

        try:
            return parse_fn(raw_text)
        except ParseError as exc:
            last_error = exc
            if not allow_repair:
                continue

        repair_prompt = (
            "Fix the following text into valid JSON that matches the schema shown. "
            "Return ONLY JSON, no extra text.\n\n"
            f"Schema: {repair_schema_hint}\n\n"
            f"Text to fix:\n{raw_text}"
        )
        repair_response = client.models.generate_content(
            model=model,
            contents=repair_prompt,
            config=config,
        )
        repaired_text = _extract_text(repair_response)
        try:
            return parse_fn(repaired_text)
        except ParseError as exc:
            last_error = exc

    raise last_error or ParseError("Failed to parse model output.")


def extract_raw_pairs(
    *,
    image_bytes: bytes,
    prompt: str,
    model: str,
    project: str | None,
    location: str,
    allow_repair: bool = True,
) -> RawPairsPayload:
    """Step 1: call Gemini Vision to transcribe raw src/dst pairs."""
    project_id = project or detect_project()
    client = genai.Client(vertexai=True, project=project_id, location=location)

    image_part = types.Part.from_bytes(data=image_bytes, mime_type="image/jpeg")
    response_schema = {
        "type": "OBJECT",
        "properties": {
            "pairs": {
                "type": "ARRAY",
                "items": {
                    "type": "OBJECT",
                    "properties": {
                        "src": {"type": "STRING"},
                        "dst": {"type": "STRING"},
                    },
                    "required": ["src", "dst"],
                },
            }
        },
        "required": ["pairs"],
    }
    config = _default_config(response_schema=response_schema)

    return _call_json_with_repair(
        client=client,
        model=model,
        contents=[prompt, image_part],
        config=config,
        parse_fn=parse_raw_pairs_json,
        allow_repair=allow_repair,
        repair_schema_hint='{"pairs": [{"src": "...", "dst": "..."}]}',
    )


def pairs_to_items(
    *,
    pairs_json: str,
    prompt: str,
    model: str,
    project: str | None,
    location: str,
    allow_repair: bool = True,
) -> ExtractedPayload:
    """Step 2: convert raw pairs JSON into cleaned extraction JSON."""
    project_id = project or detect_project()
    client = genai.Client(vertexai=True, project=project_id, location=location)

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
    config = _default_config(response_schema=response_schema)
    full_prompt = (
        f"{prompt}\n\n"
        "Input pairs JSON:\n"
        f"{pairs_json}\n"
    )
    return _call_json_with_repair(
        client=client,
        model=model,
        contents=full_prompt,
        config=config,
        parse_fn=parse_extracted_json,
        allow_repair=allow_repair,
        repair_schema_hint='{"items": [{"surface": "...", "lemma": "...", "lemma_dst": "...", "dst": "..."}]}',
    )


def extract_pairs(
    *,
    image_bytes: bytes,
    image_prompt: str,
    transform_prompt: str,
    model: str,
    project: str | None,
    location: str,
    allow_repair: bool = True,
) -> ExtractedPayload:
    """2-step extraction: image -> raw pairs -> cleaned extraction JSON."""
    raw_pairs = extract_raw_pairs(
        image_bytes=image_bytes,
        prompt=image_prompt,
        model=model,
        project=project,
        location=location,
        allow_repair=allow_repair,
    )
    # Keep the intermediate JSON stable and explicit for the second call.
    filtered = RawPairsPayload(pairs=assert_non_empty_pairs(raw_pairs.pairs))
    pairs_json = filtered.model_dump_json(ensure_ascii=False, indent=2)
    return pairs_to_items(
        pairs_json=pairs_json,
        prompt=transform_prompt,
        model=model,
        project=project,
        location=location,
        allow_repair=allow_repair,
    )
