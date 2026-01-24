from phrasepack_importer.phrasepack import build_phrasepack
from phrasepack_importer.schema import ExtractedItem


def test_build_phrasepack_normalizes_and_ids():
    extracted = [
        ExtractedItem(surface=" Ciao ", dst=" Moi "),
        ExtractedItem(surface="Ciao", dst="Hei"),
        ExtractedItem(surface="  ", dst="skip"),
    ]
    pack = build_phrasepack(
        pack_id="test-pack",
        title="Test",
        src_lang="it",
        dst_lang="fi",
        extracted_items=extracted,
    )

    assert pack.type == "vocab"
    assert pack.id == "test-pack"
    assert pack.src == "it"
    assert pack.dst == "fi"
    assert [item.id for item in pack.items] == ["ciao", "ciao-2"]
    assert pack.items[0].src == "Ciao"
    assert pack.items[0].dst == "Moi"


def test_build_phrasepack_splits_lemma_variant():
    extracted = [
        ExtractedItem(
            surface="vanno",
            lemma="andare",
            lemma_dst="menn\u00e4",
            dst="menevat",
        )
    ]
    pack = build_phrasepack(
        pack_id="test-pack",
        title="Test",
        src_lang="it",
        dst_lang="fi",
        extracted_items=extracted,
    )

    assert [item.src for item in pack.items] == ["vanno", "andare"]


def test_build_phrasepack_skips_lemma_when_dst_matches():
    extracted = [
        ExtractedItem(
            surface="abito",
            lemma="abitare",
            lemma_dst="asun",
            dst="asun",
        )
    ]
    pack = build_phrasepack(
        pack_id="test-pack",
        title="Test",
        src_lang="it",
        dst_lang="fi",
        extracted_items=extracted,
    )

    assert [item.src for item in pack.items] == ["abito"]


def test_build_phrasepack_splits_fallback_parentheses():
    extracted = [ExtractedItem(surface="abiti (abitare*)", dst="asut")]
    pack = build_phrasepack(
        pack_id="test-pack",
        title="Test",
        src_lang="it",
        dst_lang="fi",
        extracted_items=extracted,
    )

    assert [item.src for item in pack.items] == ["abiti"]


def test_build_phrasepack_dedupes_identical_pairs():
    extracted = [
        ExtractedItem(surface="essere", dst="olla"),
        ExtractedItem(surface="sono", lemma="essere", lemma_dst="olla", dst="olen"),
        ExtractedItem(surface="sei", lemma="essere", lemma_dst="olla", dst="olet"),
    ]
    pack = build_phrasepack(
        pack_id="test-pack",
        title="Test",
        src_lang="it",
        dst_lang="fi",
        extracted_items=extracted,
    )

    # Only one essere->olla card should exist even if lemma repeats across items.
    assert len([item for item in pack.items if item.src == "essere" and item.dst == "olla"]) == 1
