from phrasepack_importer.prompt import build_extraction_prompt


def test_prompt_mentions_non_vocab_exclusion():
    prompt = build_extraction_prompt("it", "fi")
    assert "Ignore any non-vocabulary text" in prompt
    assert "Only include entries" in prompt
    assert "lemma" in prompt
