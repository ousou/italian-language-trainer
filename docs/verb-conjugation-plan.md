# Verb Conjugation Practice (Plan)

Goal: add an offline-only drill mode to practice Italian verb conjugations, keeping domain logic isolated in
`/src/logic` with unit-first tests.

This plan targets v1: present indicative, 6 persons (io/tu/lui|lei/noi/voi/loro), verb-form-only input.

## User Flow (One Verb Card)

1. Prompt (L1 -> Italian):
   - Show the verb meaning/translation in the user language (e.g. Finnish "olla").
   - Ask for the Italian infinitive (e.g. "essere").
   - Allow up to 2 attempts:
     - If correct on attempt 1 or 2: proceed to conjugation phase.
     - If still wrong after attempt 2: reveal the correct infinitive and proceed to conjugation anyway.

2. Conjugation phase (present indicative):
   - Prompt sequentially, one person at a time (mobile-friendly):
     - io, tu, lui/lei, noi, voi, loro
   - User inputs verb form only (e.g. "sono", not "io sono").
   - For each person, allow up to 2 attempts:
     - Correct on attempt 1: mark that person correct.
     - Correct on attempt 2: mark correct-with-penalty (see Scoring).
     - Wrong after attempt 2: reveal the correct form and mark incorrect.

3. Card completion:
   - Show a recap for the verb:
     - Infinitive correctness (1st try / 2nd try / revealed)
     - Conjugation score (e.g. "4.5 / 6")
     - Optionally a compact table of user answers vs expected.
   - Then allow moving to the next verb.

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
          "io": "sono",
          "tu": "sei",
          "luiLei": "e",
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
- Conjugations are explicit strings; answer matching uses the existing normalization rules.

### TypeScript types (conceptual)

- Add new types in `src/types.ts`:
  - `VerbPerson = 'io' | 'tu' | 'luiLei' | 'noi' | 'voi' | 'loro'`
  - `VerbConjugationTable = Record<VerbPerson, string>`
  - `VerbItem { id, src, dst, conjugations: { present: VerbConjugationTable } }`
  - `VerbPack { type:'verbs', id, title, src, dst, items: VerbItem[] }`

## Business Logic (Strict /src/logic boundary)

Create a dedicated logic module, e.g. `src/logic/verbSession.ts`:
- No DOM, no IndexedDB, no framework types.
- Pure functions + serializable state, similar to `src/logic/session.ts`.
- Use `src/logic/answerCheck.ts` (`isAnswerCorrect`) for comparisons.

### Session state (conceptual)

Track:
- Pack id, order, current verb index
- Phase: `infinitive` -> `conjugation` -> `doneForVerb`
- For current verb:
  - `infinitive`: attempts (0..2), answer(s), result (correct first/second/revealed)
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

## UI Plan (Minimal changes, step-by-step prompts)

Add a new drill mode selector:
- "Vocabulary translation" (existing)
- "Verb conjugation" (new)

Pack selection:
- Keep verb packs separate from phrase packs.
- In UI, either:
  1) show a different pack dropdown depending on drill mode, or
  2) a single dropdown with grouped options (phrases vs verbs).

Verb drill UI elements:
- Prompt header: meaning (dst) + optionally show infinitive once revealed/answered.
- Input box (single) reused for infinitive and each person prompt.
- Person label when in conjugation phase (e.g. "tu").
- Attempt indicator (e.g. "Attempt 1/2") for current prompt.
- Feedback after each submission and on reveal.
- Recap panel after completing 6 persons:
  - Show earned points and a short list/table of any mistakes.

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
  - redoIncorrect verb-level behavior
  - normalization (accents/case/punctuation) on conjugations

Minimal e2e (Playwright):
- Add one happy-path test:
  - select a verb pack
  - answer infinitive correctly
  - answer 6 present forms with at least one second-attempt correction
  - verify recap shows partial score and the session advances

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

