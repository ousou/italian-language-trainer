import { describe, expect, it } from 'vitest';
import type { VocabPack } from '../src/types.ts';
import {
  buildSessionOrder,
  createSession,
  DEFAULT_SESSION_SIZE,
  nextCard,
  redoIncorrect,
  submitAnswer
} from '../src/logic/session.ts';

const SAMPLE_PACK: VocabPack = {
  type: 'vocab',
  id: 'sample',
  title: 'Sample',
  src: 'it',
  dst: 'fi',
  items: Array.from({ length: 25 }, (_, index) => ({
    id: `item-${index}`,
    src: `it-${index}`,
    dst: `fi-${index}`
  }))
};

describe('buildSessionOrder', () => {
  it('caps the session size at the default limit', () => {
    const order = buildSessionOrder(SAMPLE_PACK.items.length, DEFAULT_SESSION_SIZE, () => 0.42);
    expect(order).toHaveLength(DEFAULT_SESSION_SIZE);
  });

  it('uses the full pack when smaller than the session size', () => {
    const order = buildSessionOrder(5, DEFAULT_SESSION_SIZE, () => 0.1);
    expect(order).toHaveLength(5);
  });
});

describe('submitAnswer and session flow', () => {
  it('marks correct answers and increments counters', () => {
    const order = [0];
    const session = createSession(SAMPLE_PACK, 'src-to-dst', order);
    const next = submitAnswer(SAMPLE_PACK, session, 'fi-0');

    expect(next.lastResult).toBe('correct');
    expect(next.sessionCorrect).toBe(1);
    expect(next.sessionIncorrect).toBe(0);
    expect(next.sessionComplete).toBe(true);
  });

  it('accepts answers without accents or case', () => {
    const pack: VocabPack = {
      type: 'vocab',
      id: 'accent',
      title: 'Accent',
      src: 'it',
      dst: 'fi',
      items: [{ id: 'ciao', src: 'Città', dst: 'Test' }]
    };
    const session = createSession(pack, 'dst-to-src', [0]);
    const next = submitAnswer(pack, session, 'citta');

    expect(next.lastResult).toBe('correct');
  });

  it('records incorrect answers with prompt and expected text', () => {
    const order = [0];
    const session = createSession(SAMPLE_PACK, 'src-to-dst', order);
    const next = submitAnswer(SAMPLE_PACK, session, 'wrong');

    expect(next.lastResult).toBe('incorrect');
    expect(next.sessionIncorrect).toBe(1);
    expect(next.incorrectItems).toHaveLength(1);
    expect(next.incorrectItems[0].prompt).toBe('it-0');
    expect(next.incorrectItems[0].expected).toBe('fi-0');
  });

  it('allows one retry after an almost-correct answer', () => {
    const pack: VocabPack = {
      type: 'vocab',
      id: 'almost',
      title: 'Almost',
      src: 'it',
      dst: 'fi',
      items: [{ id: 'casa', src: 'casa', dst: 'house' }]
    };
    const session = createSession(pack, 'dst-to-src', [0]);
    const almost = submitAnswer(pack, session, 'cas');

    expect(almost.lastResult).toBe('almost');
    expect(almost.sessionIncorrect).toBe(0);
    expect(almost.sessionComplete).toBe(false);

    const corrected = submitAnswer(pack, almost, 'casa');
    expect(corrected.lastResult).toBe('correct');
    expect(corrected.sessionCorrect).toBe(1);
    expect(corrected.sessionComplete).toBe(true);
  });

  it('advances to the next card only after an answer', () => {
    const order = [0, 1];
    const session = createSession(SAMPLE_PACK, 'src-to-dst', order);
    const skipped = nextCard(session);
    expect(skipped.currentIndex).toBe(0);

    const answered = submitAnswer(SAMPLE_PACK, session, 'fi-0');
    const next = nextCard(answered);
    expect(next.currentIndex).toBe(1);
    expect(next.lastResult).toBeUndefined();
  });

  it('does not advance after an almost-correct answer', () => {
    const pack: VocabPack = {
      type: 'vocab',
      id: 'almost-advance',
      title: 'Almost Advance',
      src: 'it',
      dst: 'fi',
      items: [{ id: 'ciao', src: 'ciao', dst: 'hello' }, { id: 'grazie', src: 'grazie', dst: 'thanks' }]
    };
    const session = createSession(pack, 'dst-to-src', [0, 1]);
    const almost = submitAnswer(pack, session, 'cia');
    const next = nextCard(almost);
    expect(next.currentIndex).toBe(0);
    expect(next.lastResult).toBe('almost');
  });
});

describe('redoIncorrect', () => {
  it('restarts a session using the incorrect items', () => {
    const order = [0, 1];
    const session = createSession(SAMPLE_PACK, 'src-to-dst', order);
    const incorrect = submitAnswer(SAMPLE_PACK, session, 'wrong');
    const reset = redoIncorrect(SAMPLE_PACK, incorrect);

    expect(reset.order).toEqual([0]);
    expect(reset.sessionCorrect).toBe(0);
    expect(reset.sessionIncorrect).toBe(0);
    expect(reset.sessionComplete).toBe(false);
  });
});
