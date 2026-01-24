from phrasepack_importer.normalize import (
    ensure_unique_id,
    normalize_dst_text,
    normalize_src_text,
    normalize_text,
    split_gendered_dst,
    slugify,
    split_surface_and_lemmas,
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

    value = "si"
    assert normalize_src_text(value) == "s\u00ec"

    value = 'essere*'
    assert normalize_src_text(value) == "essere"

    value = '"".\tè'
    assert normalize_src_text(value) == "è"


def test_normalize_dst_text_sentence_cases_questions():
    value = "missä? minne?"
    assert normalize_dst_text(value) == "Missä? Minne?"

    value = "kanssa (prep.)"
    assert normalize_dst_text(value) == "kanssa (prep.)"

    value = "saapuu; tulee"
    assert normalize_dst_text(value) == "saapuu, tulee"

    value = "Missä?; minne?"
    assert normalize_dst_text(value) == "Missä? Minne?"


def test_split_gendered_dst_splits_parenthesized_note():
    assert split_gendered_dst("italialainen (mies, nainen)", "fi", 2) == [
        "italialainen (mies)",
        "italialainen (nainen)",
    ]
    assert split_gendered_dst("tämä (mies, nainen)", "fi", 2) == [
        "tämä (mies)",
        "tämä (nainen)",
    ]
    assert split_gendered_dst("italialainen (mies, nainen)", "sv", 2) is None
    assert split_gendered_dst("italialainen", "fi", 2) is None


def test_split_surface_and_lemmas_fallback_parens():
    assert split_surface_and_lemmas("vanno (andare*)", None) == ["vanno"]
    assert split_surface_and_lemmas("abiti (abitare)", None) == ["abiti"]
    assert split_surface_and_lemmas("essere", None) == ["essere"]
    assert split_surface_and_lemmas("italiano, italiana", None) == ["italiano", "italiana"]
    assert split_surface_and_lemmas("questo/questa", None) == ["questo", "questa"]
    assert split_surface_and_lemmas("Ah sì, che bello!", None) == ["Ah sì, che bello!"]


def test_ensure_unique_id_appends_suffixes():
    existing = {"ciao"}
    assert ensure_unique_id("ciao", existing) == "ciao-2"
    assert ensure_unique_id("ciao", existing) == "ciao-3"
