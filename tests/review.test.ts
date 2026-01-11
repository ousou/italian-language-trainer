import { describe, expect, it } from 'vitest';
import {
  applyReviewResult,
  buildReviewCardId,
  createReviewCard,
  DAY_MS
} from '../src/logic/review.ts';

describe('review scheduling', () => {
  it('builds a stable review card id', () => {
    const id = buildReviewCardId('pack-1', 'item-2', 'src-to-dst');
    expect(id).toBe('pack-1:item-2:src-to-dst');
  });

  it('updates stats and scheduling data for a correct answer', () => {
    const card = createReviewCard({ packId: 'pack', itemId: 'item', direction: 'dst-to-src' });
    const now = 1_000;
    const updated = applyReviewResult(card, { correct: true, now });

    expect(updated.attempts).toBe(1);
    expect(updated.correct).toBe(1);
    expect(updated.incorrect).toBe(0);
    expect(updated.repetitions).toBe(1);
    expect(updated.intervalDays).toBe(1);
    expect(updated.dueAt).toBe(now + DAY_MS);
    expect(updated.lastResult).toBe('correct');
  });

  it('resets repetition counters for low quality answers', () => {
    const card = {
      ...createReviewCard({ packId: 'pack', itemId: 'item', direction: 'src-to-dst' }),
      repetitions: 3,
      intervalDays: 12,
      streak: 2
    };
    const now = 5_000;
    const updated = applyReviewResult(card, { correct: false, now, quality: 2 });

    expect(updated.repetitions).toBe(0);
    expect(updated.intervalDays).toBe(1);
    expect(updated.streak).toBe(0);
    expect(updated.lapses).toBe(1);
    expect(updated.lastResult).toBe('incorrect');
  });
});
