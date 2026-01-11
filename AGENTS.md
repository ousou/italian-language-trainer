# Agent Instructions

## Core Principles

- **No backend**: all features must function without servers; local-only storage.
- **Business logic isolation**: keep domain logic separate from UI, storage, and framework code.
- **Unit-first testing**: business logic has dedicated unit tests without mocks or DOM.
- **Minimal e2e**: keep end-to-end tests lean and only for critical flows.

## Additional Guidance

- Keep `/src/logic` as a strict boundary: no DOM, no storage adapters, no framework types.
- Storage layer stays thin with typed DTOs; transformations live in logic.
- Every new logic module gets unit tests first; e2e only for happy-path flows.
- No network calls in app runtime; any `fetch` is build-time or test-only.
- Prefer deterministic time/randomness: inject `now()`/RNG into logic for tests.
