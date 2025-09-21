# Italian Language Trainer — Polyglot PWA (Client-Only)

A 100% browser-based Progressive Web App (PWA) for practicing Italian vocabulary and tourist-friendly phrases, with Finnish 🇫🇮 and Swedish 🇸🇪 as native languages. No accounts, no servers, no databases — everything runs locally and persists to the user’s device.

Repository: **italian-language-trainer**

---

## ✨ Goals

- **Zero backend**: static hosting only; data stored locally via IndexedDB.
- **No login**: private by default; your data never leaves your device unless you export it.
- **Offline-first**: installable PWA, fully usable on planes, metros, or abroad with spotty connections.
- **Two study modes**: 1) Words (IT⇄FI/SE) and 2) Phrasebooks by scenario (restaurant, hotel, directions, etc.).
- **Smart review**: spaced-repetition scheduling (SM-2/Leitner) with gentle, human-friendly defaults.
- **Multidevice friendly**: optional import/export files to move progress between devices.
- **UI localization**: app interface available in **Finnish or Swedish**, selectable by the user. The chosen UI language also determines which translation pair (IT⇄FI or IT⇄SE) is used by default.

---

## 🎯 Feature Overview

- **Vocab Drills**

  - Direction: Italian→Finnish/Swedish and reverse.
  - Question types: typing, multiple-choice, and quick-flip flashcards.
  - Hints: first-letter, show IPA/pronunciation, reveal example sentence.

- **Phrasebooks**

  - Curated packs: *At the Restaurant*, *Hotel Check-in*, *Getting Around*, *Emergencies*, etc.
  - Tap-to-play audio, slow playback, and phonetic helper (IPA or syllable stress).

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
- **Styling**: Tailwind CSS; light/dark mode.

> **Why PWA?** Installable on iOS/Android/desktop; works offline; deployable as static files (GitHub Pages/Netlify/Cloudflare Pages).

---

## 🗂️ Project Structure

```
italian-language-trainer/
├─ public/
│  ├─ icons/               # PWA icons
│  ├─ manifest.webmanifest
│  └─ phrasepacks/         # Built-in content (JSON)
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

---

## 🧠 Spaced-Repetition

- Algorithm: **SM-2** with EF starting at 2.3.
- Daily caps: **15 new cards**, **120 reviews**.
- Leitner fallback for new users.

---

## 🚀 Getting Started

```bash
pnpm i
pnpm dev
pnpm build
pnpm preview
```

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

- **Unit**: Vitest for logic.
- **E2E**: Playwright for offline/PWA flows.
- **Lighthouse** audits.

---

## 🌍 Deployment

- GitHub Pages (dist → gh-pages).
- Netlify/Cloudflare Pages with SPA fallback.

---

## 🗺️ Roadmap

- [ ] Import/export progress
- [ ] Web Share Target for decks
- [ ] In-browser editor for custom decks
- [ ] Pronunciation check via STT
- [ ] Smarter multiple-choice distractors

---

## 🤝 Contributing

Private project (for you + spouse). Optionally accept phrasepack PRs.

---

## 📜 License

MIT (or private).

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

