# Italian Language Trainer — Polyglot PWA (Client-Only)

A 100% browser-based Progressive Web App (PWA) for practicing Italian vocabulary and tourist-friendly phrases, with Finnish 🇫🇮 and Swedish 🇸🇪 as native languages. No accounts, no servers, no databases — everything runs locally and persists to the user’s device.

Repository: **italian-language-trainer**

Served at: https://ousou.github.io/italian-language-trainer/

---

## ✨ Goals

- **Zero backend**: static hosting only; data stored locally via IndexedDB.
- **No login**: private by default; your data never leaves your device unless you export it.
- **Offline-first**: installable PWA, fully usable on planes, metros, or abroad with spotty connections.
- **Three study modes**: 1) Words (IT⇄FI/SE) 2) Phrasebooks by scenario (restaurant, hotel, directions, etc.) and 3) Verb conjugation drills.
- **Smart review**: spaced-repetition scheduling (SM-2/Leitner) with gentle, human-friendly defaults.
- **Multidevice friendly**: optional import/export files to move progress between devices.
- **UI localization**: app interface available in **Finnish or Swedish**, selectable by the user. The chosen UI language also determines which translation pair (IT⇄FI or IT⇄SE) is used by default.

---

## ✅ Core Principles

- **No backend**: all features must function without servers; local-only storage.
- **Business logic isolation**: keep domain logic separate from UI, storage, and framework code.
- **Unit-first testing**: business logic has dedicated unit tests without mocks or DOM.
- **Minimal e2e**: keep end-to-end tests lean and only for critical flows.

---

## 🎯 Feature Overview

- **Vocab Drills**

  - Direction: Italian→Finnish/Swedish and reverse.
  - Question types: typing, multiple-choice, and quick-flip flashcards.
  - Hints: first-letter, show IPA/pronunciation, reveal example sentence.

- **Phrasebooks**

  - Curated packs: *At the Restaurant*, *Hotel Check-in*, *Getting Around*, *Emergencies*, etc.
  - Tap-to-play audio, slow playback, and phonetic helper (IPA or syllable stress).

- **Verb Conjugation**

  - Prompt the meaning in the user language, then type the Italian infinitive.
  - Present-tense conjugation for io/tu/lui|lei/noi/voi/loro.
  - Two attempts per form, with partial-credit scoring.

## 📱 Responsive Support

The app is designed to work on both desktop and mobile (portrait and landscape):

- Verb conjugation rows keep the person label and input on the same line on mobile portrait to support fast typing.
- Feedback and the revealed correct answer are shown below the row to keep the main line compact.

## ✅ Visual Regression Checks

In addition to unit tests and functional e2e tests, the repo uses Playwright screenshot snapshots to catch layout
regressions on both desktop and mobile viewports. Run:

```bash
pnpm test:e2e
```

Baseline snapshots should only be updated when a visual change is intentional (e.g. layout, spacing, typography, copy,
colors). If snapshots fail unexpectedly, treat it as a regression and fix the UI instead of updating baselines.

When intentionally updating UI visuals, update baselines with:

```bash
pnpm test:e2e -- --update-snapshots
```

Notes:

- Snapshots are committed under `tests/e2e/*.snapshots/` and are OS-specific (e.g. `*-linux.png` in CI). Prefer
  updating snapshots on the same OS/browser environment used by CI to avoid mismatches.
- Always review the updated PNG diffs before committing snapshot updates.

- **Spaced Repetition**

  - **Algorithms**: SM-2 (Anki-style) by default with a simple Leitner fallback.
  - Daily queue capped to avoid burnout; streaks and gentle nudges.

- **Audio & Speech**

  - Text-to-Speech via Web Speech Synthesis; optional recorded audio blobs.
  - Optional (device-dependent) speech-recognition check for pronunciation.

- **Localization**

  - **UI languages**: Finnish and Swedish. User selects preferred UI language at first launch (and can change it later).
  - **Translation pairs**: Italian⇄Finnish if UI is in Finnish, Italian⇄Swedish if UI is in Swedish. Both packs can be available if desired.
  - Pluggable content packs; community-friendly JSON.

- **Privacy & Portability**

  - All study data in **IndexedDB**; settings in **localStorage**.
  - One-click **Export** (JSON) and **Import** to move progress.

---

## 🧱 Tech Stack (Browser-Only)

- **Build/Framework**: Vite + TypeScript (vanilla, no React).
- **State & UI**: Pure JavaScript/TypeScript DOM rendering with small helper functions.
- **Storage**: IndexedDB (via [`idb`](https://github.com/jakearchibald/idb) helper) + localStorage.
- **PWA**: Service Worker + Web App Manifest; offline caching strategy (stale-while-revalidate).
- **Audio**: Web Speech Synthesis API + Web Audio API.
- **Testing**: Vitest + Playwright.
- **Styling**: Hand-authored CSS; light/dark mode.

> **Why PWA?** Installable on iOS/Android/desktop; works offline; deployable as static files (GitHub Pages/Netlify/Cloudflare Pages).

---

## 🗂️ Project Structure

```
italian-language-trainer/
├─ public/
│  ├─ icons/               # PWA icons
│  ├─ manifest.webmanifest
│  ├─ phrasepacks/         # Built-in content (JSON)
│  └─ verbpacks/           # Built-in verb conjugations (JSON)
├─ src/
│  ├─ app/                 # App shell, routes
│  ├─ components/          # Small reusable UI functions
│  ├─ data/                # Data access (idb wrapper, repositories)
│  ├─ logic/               # SRS algorithms, schedulers, scoring
│  ├─ pages/               # Views (Drill, Phrasebook, Settings, Export)
│  ├─ speech/              # TTS / STT adapters
│  ├─ styles/
│  ├─ sw.ts                # Service worker (workbox or manual)
│  └─ main.ts              # Entry point (vanilla JS/TS)
├─ scripts/                # Content tooling (validate packs)
├─ tools/                  # Offline tooling (phrasepack importer, etc.)
├─ tests/                  # Unit + e2e
├─ README.md
└─ package.json
```

---

## 🔐 Privacy & Data

- **No tracking, no telemetry.**

- **Storage locations**:

  - `IndexedDB`: study items, reviews, scheduling state, audio blobs
  - `localStorage`: UI prefs (including chosen UI language), last deck, theme

- **Portability**: *Settings → Export* creates a file like:

```json
{
  "version": 1,
  "profile": {"name": "local-user"},
  "langs": ["it-fi", "it-sv"],
  "uiLang": "fi",
  "srs": {"algorithm": "sm2", "cards": [/* ... */]},
  "customDecks": [/* optional user content */]
}
```

---

## 📦 Content Format

### Vocab Pack (IT⇄FI example)

```json
{
  "type": "vocab",
  "id": "core-it-fi-a1",
  "title": "Core A1 — Italian⇄Finnish",
  "src": "it",
  "dst": "fi",
  "items": [
    {
      "id": "ciao",
      "src": "ciao",
      "dst": "moi",
      "ipa": "ˈtʃa.o",
      "examples": [{"it": "Ciao!", "fi": "Moi!"}]
    }
  ]
}
```

### Phrase Pack (IT⇄SV example)

```json
{
  "type": "phrases",
  "id": "restaurant-it-sv",
  "title": "På Restaurangen",
  "src": "it",
  "dst": "sv",
  "sections": [
    {
      "title": "Beställa",
      "items": [
        {
          "id": "posso-avere-il-menu",
          "it": "Posso avere il menù, per favore?",
          "sv": "Kan jag få menyn, tack?",
          "ipa": "ˈpɔs.so aˈvɛ.re il meˈny per faˈvo.re"
        }
      ]
    }
  ]
}
```

### Verb Pack (IT⇄FI example)

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
      "src": ["essere", "esser"],
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

---

## 🧰 Phrasepack Importer Tooling

The command-line tooling for generating phrasepacks from images lives in
`tools/phrasepack_importer/` and uses its own Python virtual environment.

Quick setup (run from that folder):

```bash
python3 -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
```

Smoke test:

```bash
python vertex_ai_sdk_smoke.py --image ../../pictures/bella_vista_1_ch_1.jpg
```

Basic extraction:

```bash
python -m phrasepack_importer \
  --image ../../pictures/bella_vista_1_ch_1.jpg \
  --id bella-vista-1-ch-1 \
  --title "Bella Vista 1 ch 1" \
  --src it \
  --dst fi
```

By default, this writes to `public/phrasepacks/<id>.json` at the repository root.

Generated JSON preserves Unicode characters to match existing phrasepacks.
Extraction normalizes casing for punctuated translations and fixes common OCR
apostrophe errors like `i'amico` → `l'amico`.
Sentence casing is only applied for questions/exclamations or sentence-ending
periods (not abbreviations like `(prep.)`).
Prompts instruct the model to ignore headings or instructions and only capture
paired vocabulary entries.
Extraction is done in two LLM calls (vision -> text cleanup). Translations are
always taken from the image wordlist (no LLM translation).

Tool tests:

```bash
pip install -r requirements-dev.txt
pytest
```

Live Gemini integration test (requires network + billing):

```bash
RUN_LLM_TESTS=1 pytest tests/test_integration_llm.py
```

---

## 🧠 Spaced-Repetition

- Algorithm: **SM-2** with EF starting at 2.3.
- Daily caps: **15 new cards**, **120 reviews**.
- Leitner fallback for new users.
- Sessions are built per pack: due cards first, then new items, then upcoming reviews to fill the session size.
- If caps limit the queue, sessions can be shorter than the default size.

### Current storage behavior (prototype)

- **Stats scope**: Per item per direction, keyed by `packId:itemId:direction`. This means the same word in different packs tracks separately, and `src→dst` vs `dst→src` are independent.
- **What is recorded**: Attempts/correct/incorrect counts, streaks, lapses, last result, SM-2 scheduling fields (`ef`, `intervalDays`, `repetitions`, `dueAt`), plus `lastReviewedAt` and optional `lastQuality`.
- **Review history**: Each answer also appends a local review event (timestamp, result, item, direction) to support daily activity tracking and future analytics.
- **How items are chosen**: Current sessions still use randomized order from the selected pack (no SRS queue yet). Review stats are collected during sessions to enable a future “due cards” queue.
- **How items are chosen**: Sessions now build an SRS queue per pack, prioritizing due cards, then new items, then upcoming reviews to fill the session.
- **Stats UI**: The session view includes a button to reveal a stats panel that summarizes attempts/accuracy for the current pack, shows a configurable daily-activity line chart (defaults to 7 days, switchable to 14/30), and keeps the per-item list collapsed until requested.

---

## 🚀 Getting Started

```bash
pnpm i
pnpm dev
pnpm build
pnpm preview
```

Local app: run `pnpm dev`, then open the URL shown by Vite (usually
`http://localhost:5173`).

No secrets needed. Optional env vars: `VITE_APP_NAME`, `VITE_DEFAULT_PAIR=it-fi`.

---

## 📲 PWA & Offline

- Service Worker pre-caches shell and packs.
- Install prompts for iOS/Android/desktop.
- Versioning via `appVersion` in `sw.ts`.

---

## 🔊 Speech & Audio

- TTS with `speechSynthesis` (`it-IT` voice if available).
- Slow playback mode.
- Optional user recording stored in IndexedDB.

---

## ♿ Accessibility

- High-contrast theme toggle.
- Full keyboard support.
- ARIA-live announcements.

---

## 🧪 Testing

- Unit tests with Vitest:

```bash
pnpm test
```

- E2E tests with Playwright (runs the Vite dev server):

```bash
pnpm test:e2e
```

---

## 🌍 Deployment

- GitHub Pages (dist → gh-pages).
- Netlify/Cloudflare Pages with SPA fallback.

### GitHub Pages (manual)

```bash
pnpm i
pnpm build
```

Then publish `dist/` to a `gh-pages` branch and set **Settings → Pages** to
serve from that branch. If you plan to host from a subpath, set Vite's
`base` in `vite.config.ts` before building.

---

## 🗺️ Roadmap

- [ ] Import/export progress
- [ ] Web Share Target for decks
- [ ] In-browser editor for custom decks
- [ ] Pronunciation check via STT
- [ ] Smarter multiple-choice distractors

---


## Appendix A — Interfaces

```ts
export type LangPair = "it-fi" | "it-sv";

export interface VocabItem {
  id: string; src: string; dst: string;
  ipa?: string; examples?: { it: string; fi?: string; sv?: string }[];
}

export interface PhraseItem {
  id: string; it: string; fi?: string; sv?: string;
  ipa?: string; audio?: string | null;
}

export interface ReviewCard {
  id: string; packId: string; dir: "src->dst" | "dst->src";
  ef: number; interval: number; reps: number; due: number;
}
```

---

## FAQ

**Why no backend?** Privacy + zero cost.\
**Sync across devices?** Use export/import.\
**Which language pair?** Determined by chosen UI (Finnish → IT⇄FI, Swedish → IT⇄SV).\
**Will TTS work everywhere?** Depends on OS voices; falls back gracefully.
