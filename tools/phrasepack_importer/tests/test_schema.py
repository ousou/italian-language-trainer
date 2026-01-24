import pytest

from phrasepack_importer.schema import ParseError, parse_extracted_json


def test_parse_extracted_json_valid():
    raw = '{"items": [{"src": "ciao", "dst": "moi"}]}'
    payload = parse_extracted_json(raw)
    assert payload.items[0].src == "ciao"


def test_parse_extracted_json_invalid():
    with pytest.raises(ParseError):
        parse_extracted_json("not-json")
