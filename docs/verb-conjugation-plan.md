# Verb Conjugation Practice (Plan)

Goal: add an offline-only drill mode to practice Italian verb conjugations, keeping domain logic isolated in
`/src/logic` with unit-first tests.

This plan targets v1: present indicative, 6 persons (io/tu/lui|lei/noi/voi/loro), verb-form-only input.
Optionally, each expected answer may include multiple accepted variants (e.g. alternative conjugations, or
accepting "io sono" in addition to "sono" if the pack provides it).

## User Flow (One Verb Card)

1. Prompt (L1 -> Italian):
   - Show the verb meaning/translation in the user language (e.g. Finnish "olla").
   - Ask for the Italian infinitive (e.g. "essere").
   - Allow up to 2 attempts:
     - If correct on attempt 1 or 2: proceed to conjugation phase.
     - If still wrong after attempt 2: reveal the correct infinitive and proceed to conjugation anyway.
   - After the infinitive is resolved (correct or revealed), keep the correct infinitive visible during conjugation.

2. Conjugation phase (present indicative):
   - Show all six persons at once with six inputs:
     - io, tu, lui/lei, noi, voi, loro
   - User inputs verb form only (e.g. "sono", not "io sono").
   - Each input supports up to 2 attempts:
     - Attempt 1: if wrong, show "Try again" for that row.
     - Attempt 2: if wrong, reveal the correct form in that row.
   - The user can complete rows in any order; each row is independently resolved.

3. Card completion:
   - Show a recap for the verb:
     - Infinitive correctness (1st try / 2nd try / revealed)
     - Conjugation score (e.g. "4 / 6 correct, 1 on 2nd try")
     - Total points (e.g. "5.5 / 7 points")
     - Conjugation table stays visible with both user answers and correct answers.
   - Then allow moving to the next verb.

## Interaction Rules (Infinitive + Per-Row State)

Infinitive is a single step; conjugation uses six independent rows.

Infinitive step:
- Two attempts, same behavior as before (correct-first / correct-second / revealed).
- After it resolves, show the correct infinitive and enable conjugation inputs.

Conjugation rows:
- Each person has a row with its own input, feedback, and result state.
- Attempt 1:
  - If correct: resolve row as "correct-first".
  - If wrong: show "Try again" for that row and keep it editable.
- Attempt 2:
  - If correct: resolve row as "correct-second".
  - If wrong: resolve row as "revealed" and show the correct form.

Controls / enabled state:
- Infinitive:
  - Single "Check" button for the infinitive step.
  - "Next verb" disabled until all six conjugation rows are resolved.
- Conjugation rows:
  - Each row has its own "Check" button (or a single "Check all" that evaluates only unresolved rows).
  - Resolved rows become read-only and show the expected form.
- Enter key:
  - While editing a row, Enter triggers that row's check.
  - When all rows resolve, Enter can activate "Next verb".

## Data Model (Separate Verb Packs)

Verb packs are separate from existing phrase packs and are loaded from local JSON in `public/verbpacks/`.

### JSON shape (v1)

Each pack contains explicit conjugation tables (works for regular and irregular verbs, fully offline).

Example (illustrative):

```json
{
  "type": "verbs",
  "id": "core-it-fi-verbs-a1",
  "title": "Core Verbs A1 — Italian⇄Finnish",
  "src": "it",
  "dst": "fi",
  "items": [
    {
      "id": "essere",
      "src": "essere",
      "dst": "olla",
      "conjugations": {
        "present": {
          "io": ["sono", "io sono"],
          "tu": "sei",
          "luiLei": "è",
          "noi": "siamo",
          "voi": "siete",
          "loro": "sono"
        }
      }
    }
  ]
}
```

Notes:
- `src` is always Italian infinitive in v1.
- `dst` is the user language translation (Finnish/Swedish).
- Conjugations are explicit strings; a field may also be a string array to represent accepted variants.
- If a field is a string array, the first entry is the canonical display form; all entries are accepted.
- Answer matching uses the existing normalization rules (case/accents/punctuation-insensitive).

### TypeScript types (conceptual)

- Add new types in `src/types.ts`:
  - `AnswerSpec = string | string[]`
  - `VerbPerson = 'io' | 'tu' | 'luiLei' | 'noi' | 'voi' | 'loro'`
  - `VerbConjugationTable = Record<VerbPerson, AnswerSpec>`
  - `VerbItem { id, src: AnswerSpec, dst: string, conjugations: { present: VerbConjugationTable } }`
  - `VerbPack { type:'verbs', id, title, src, dst, items: VerbItem[] }`

## Business Logic (Strict /src/logic boundary)

Create a dedicated logic module, e.g. `src/logic/verbSession.ts`:
- No DOM, no IndexedDB, no framework types.
- Pure functions + serializable state, similar to `src/logic/session.ts`.
- Use `src/logic/answerCheck.ts` (`isAnswerCorrect`) for comparisons.
- Add a small helper that supports variants:
  - `isAnswerCorrectSpec(expected: AnswerSpec, actual: string): boolean` which returns true if any accepted
    expected variant matches `actual` using `isAnswerCorrect`.

### Session state (conceptual)

Track:
- Pack id, order, current verb index
- Phase: `infinitive` -> `conjugation` -> `recap`
- For current verb:
  - `infinitive`: attempts (0..2), answer(s), result (correct-first/correct-second/revealed)
  - `conjugation`: current person index (0..5), attempts (0..2), answers, per-person result
- Aggregates:
  - `sessionCorrect`, `sessionIncorrect` (card-level; see Scoring + SRS mapping)
  - `incorrectItems` list for "redo incorrect" mode (include per-person mistakes for diagnostics)

### Core functions (conceptual)

- `createVerbSession(pack, order, options?)`
- `submitInfinitiveAnswer(pack, state, answer)`:
  - Consumes an attempt (max 2).
  - On success: transition to conjugation phase.
  - On second failure: reveal expected infinitive, transition to conjugation phase.
- `submitConjugationAnswer(pack, state, answer)`:
  - Applies to the current person prompt.
  - Consumes an attempt (max 2).
  - On success: advance to next person (or complete verb after 6).
  - On second failure: reveal expected form, advance.
- `nextVerb(state)`:
  - Only when the current verb is complete.
- `redoIncorrect(pack, state)`:
  - Rebuild session order from incorrect verb indices (verb-level).

## Scoring + SRS Integration (Partial Credit)

Each verb attempt produces one SRS review update (reuse existing IndexedDB review system).

### Per-prompt points (infinitive + each person)

For each prompt (7 total per verb in v1):
- Correct on 1st attempt: 1.0 point
- Correct on 2nd attempt: 0.5 point
- Wrong after 2 attempts (revealed): 0.0 point

Total points:
- `maxPoints = 7` (1 infinitive + 6 persons)
- `earnedPoints = sum(points)`
- `ratio = earnedPoints / maxPoints`

### Mapping points -> SRS quality

Use a 0..5 quality scale compatible with existing `applyReviewResult`:
- `quality = round(ratio * 5)` (0..5)
- `correct = quality >= 3`

Record once per verb at verb completion:
- `recordReviewResult({ packId, itemId: verb.id, direction:'dst-to-src' }, { now, correct, quality })`

Rationale:
- Keeps storage unchanged and deterministic.
- Gives partial credit scheduling effects without tracking 6 separate SRS cards per verb.

### Redo incorrect policy

For "Redo incorrect", include verbs where the final verb result is incorrect, i.e. `correct === false`
(equivalently `quality < 3`).

## UI Plan (All Six Forms Visible)

Add a new drill mode selector:
- "Vocabulary translation" (existing)
- "Verb conjugation" (new)

Pack selection:
- Keep verb packs separate from phrase packs.
- In UI, either:
  1) show a different pack dropdown depending on drill mode, or
  2) a single dropdown with grouped options (phrases vs verbs).

Verb drill UI elements:
- Prompt header: meaning (dst) + infinitive (hidden until resolved).
- Infinitive input section with 2-attempt feedback.
- Conjugation table with six rows:
  - Columns: person label, input, feedback, correct answer (revealed after resolution).
  - Each row shows its own attempt status.
- Recap panel after all six rows resolve:
  - Show conjugation summary: "X/6 correct" and "Y correct on 2nd try".
  - Show total summary: "P/7 points" (ties to SRS quality mapping).
  - Keep the full conjugation table visible for pattern learning.

Keyboard behavior:
- Keep the existing "Enter advances when the step is already checked" behavior, adapted for step-by-step prompts.

## Storage and Boundaries

- No new backend, no network calls at runtime.
- Verb packs are static local JSON under `public/`.
- IndexedDB review storage is reused as-is.
- Any mapping/transforms between raw JSON and logic types should stay out of `/src/logic`:
  - Parsing/normalization lives in `src/data/*`.
  - Domain behavior lives in `src/logic/*`.

## Tests

Unit-first (Vitest, no DOM):
- Add `tests/verbSession.test.ts`:
  - infinitive: 2-attempt behavior + reveal + proceeds to conjugation
  - conjugation: 2-attempt behavior per person + reveal
  - scoring: earnedPoints and quality mapping for key cases (all first-try, all second-try, mixed, all revealed)
  - redoIncorrect verb-level behavior (quality < 3)
  - variants: accepts any variant in `AnswerSpec` (string array)
  - normalization (accents/case/punctuation) on conjugations
  - Data for unit tests is an in-memory `VerbPack` constant inside the test file (no JSON required).

Minimal e2e (Playwright):
- Add one happy-path test:
  - select a verb pack
  - answer infinitive correctly
  - answer 6 present forms with at least one second-attempt correction
  - verify recap shows partial score and the session advances
  - E2E uses a small real `public/verbpacks/*.json` file and adds it to the verb pack list in `src/data/verbpacks.ts`.

## Implementation Checklist (Later)

1) Types:
   - Extend `src/types.ts` with VerbPack/VerbItem types.
2) Data loader:
   - Add `src/data/verbpacks.ts` (available packs + fetch + validation).
3) Logic:
   - Add `src/logic/verbSession.ts` + `tests/verbSession.test.ts`.
4) UI:
   - Update `src/main.ts` to support drill mode + verb drill rendering.
5) E2E:
   - Add `tests/e2e/verbs.spec.ts`.
6) Add initial verb pack JSON:
   - Include at least 5 verbs, including irregulars (e.g. essere, avere, andare).
