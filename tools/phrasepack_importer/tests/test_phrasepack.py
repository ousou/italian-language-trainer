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
    extracted = [ExtractedItem(surface="vanno", lemma="andare", dst="menevat")]
    pack = build_phrasepack(
        pack_id="test-pack",
        title="Test",
        src_lang="it",
        dst_lang="fi",
        extracted_items=extracted,
    )

    assert [item.src for item in pack.items] == ["vanno", "andare"]


def test_build_phrasepack_splits_fallback_parentheses():
    extracted = [ExtractedItem(surface="abiti (abitare*)", dst="asut")]
    pack = build_phrasepack(
        pack_id="test-pack",
        title="Test",
        src_lang="it",
        dst_lang="fi",
        extracted_items=extracted,
    )

    assert [item.src for item in pack.items] == ["abiti", "abitare"]
