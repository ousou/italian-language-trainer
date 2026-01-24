# Phrasepack Import Rules

These rules define what the phrasepack importer must output.

## Goal

- The importer reads a word list from an image and produces a vocab phrasepack JSON.
- The output should follow the source material (the image) as closely as possible.

## Core Restrictions (Must)

- Italian `src` must be a single answer.
  - A single answer means a single word or a single fixed phrase.
  - `src` must NOT contain multiple alternatives combined into one string.

Examples (bad -> good):
- `italiano, italiana` -> two items: `italiano` and `italiana`
- `questo, questa` -> two items: `questo` and `questa`
- `essere*` -> `essere`

- Italian `src` must NOT include lemma annotations or study notes.
  - Do not include parentheses, asterisks, or similar markers in `src`.

Examples (bad):
- `vanno (andare*)`
- `abiti (abitare)`
- `essere*`

## Lemmas / Base Forms (Nice To Have)

- If the image shows both a surface form and a lemma/base form, it is OK to include both,
  but they must be separate items.

Example:
- Image shows: `vanno (andare)`
  - Item 1: `src = vanno`
  - Item 2: `src = andare` (only if the image also provides a translation for `andare`)

Important:
- Never attach the lemma to the surface form in the same `src` string.
- Only add a lemma entry if the image provides a translation for the lemma.
  - Do not invent lemma translations, and do not reuse the surface translation for the lemma
    if it changes meaning (e.g. "asun" != "asua").

## Translation Source (Must)

- Always use the translations from the image vocabulary list.
- The importer must NOT translate with an LLM or any external dictionary.
  - The LLM is only used for extraction and cleanup (formatting, splitting alternatives, removing annotations).

## Non-vocabulary Text (Must Ignore)

- Ignore headings, instructions, examples, page numbers, and other non-vocabulary content.
- Only include entries that are clearly a bilingual pair: Italian term + translation.
