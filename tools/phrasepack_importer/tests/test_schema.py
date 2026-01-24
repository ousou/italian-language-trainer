import pytest

from phrasepack_importer.schema import (
    ParseError,
    assert_non_empty,
    assert_non_empty_pairs,
    parse_extracted_json,
    parse_raw_pairs_json,
)


def test_parse_extracted_json_valid():
    raw = '{"items": [{"surface": "ciao", "dst": "moi"}]}'
    payload = parse_extracted_json(raw)
    assert payload.items[0].surface == "ciao"


def test_parse_extracted_json_code_fenced():
    raw = '```json\n{"items": [{"src": "ciao", "dst": "moi"}]}\n```'
    payload = parse_extracted_json(raw)
    assert payload.items[0].dst == "moi"


def test_parse_extracted_json_extracts_embedded_object():
    raw = 'prefix text {"items": [{"surface": "ciao", "dst": "moi"}]} trailing'
    payload = parse_extracted_json(raw)
    assert payload.items[0].surface == "ciao"


def test_parse_extracted_json_requires_surface_or_src():
    raw = '{"items": [{"dst": "moi"}]}'
    with pytest.raises(ParseError):
        parse_extracted_json(raw)


def test_assert_non_empty_filters_missing_dst():
    payload = parse_extracted_json('{"items": [{"surface": "ciao", "dst": null}]}')
    with pytest.raises(ParseError):
        assert_non_empty(payload.items)


def test_parse_extracted_json_invalid():
    with pytest.raises(ParseError):
        parse_extracted_json("not-json")


def test_parse_raw_pairs_json_valid():
    payload = parse_raw_pairs_json('{"pairs": [{"src": "ciao", "dst": "moi"}]}')
    assert payload.pairs[0].src == "ciao"


def test_assert_non_empty_pairs_filters_blanks():
    payload = parse_raw_pairs_json('{"pairs": [{"src": " ", "dst": "moi"}]}')
    with pytest.raises(ParseError):
        assert_non_empty_pairs(payload.pairs)
