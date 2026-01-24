from phrasepack_importer.prompt import build_image_pairs_prompt, build_pairs_to_items_prompt


def test_prompt_mentions_non_vocab_exclusion():
    prompt = build_image_pairs_prompt("it", "fi")
    assert "Ignore any non-vocabulary text" in prompt
    assert "Only include entries" in prompt


def test_transform_prompt_mentions_single_answer_and_lemmas():
    prompt = build_pairs_to_items_prompt("it", "fi")
    assert "single word or a single fixed phrase" in prompt
    assert "Do NOT combine alternatives" in prompt
    assert "Always keep the translation" in prompt
    assert "do not invent lemma_dst" in prompt
