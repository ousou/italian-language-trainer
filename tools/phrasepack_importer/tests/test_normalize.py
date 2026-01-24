from phrasepack_importer.normalize import (
    ensure_unique_id,
    normalize_dst_text,
    normalize_src_text,
    normalize_text,
    slugify,
)


def test_normalize_text_cleans_spacing_and_punctuation():
    value = "  l’  amico   —  bello  "
    assert normalize_text(value) == "l' amico - bello"


def test_slugify_makes_ascii_ids():
    value = "L’amico, citta!"
    assert slugify(value) == "lamico-citta"


def test_normalize_src_text_fixes_ocr_apostrophe():
    value = "i'amico"
    assert normalize_src_text(value) == "l'amico"

    value = "I'appuntamento"
    assert normalize_src_text(value) == "l'appuntamento"


def test_normalize_dst_text_sentence_cases_questions():
    value = "missä? minne?"
    assert normalize_dst_text(value) == "Missä? Minne?"

    value = "kanssa (prep.)"
    assert normalize_dst_text(value) == "kanssa (prep.)"


def test_ensure_unique_id_appends_suffixes():
    existing = {"ciao"}
    assert ensure_unique_id("ciao", existing) == "ciao-2"
    assert ensure_unique_id("ciao", existing) == "ciao-3"
