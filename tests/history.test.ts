import { describe, expect, it } from 'vitest';
import { buildHistorySummary, buildPackSummaries } from '../src/logic/history.ts';
import type { ReviewCard } from '../src/logic/review.ts';
import type { ReviewEvent } from '../src/logic/reviewEvents.ts';

function makeCard(overrides: Partial<ReviewCard> = {}): ReviewCard {
  return {
    id: 'pack:item:src-to-dst',
    packId: 'pack',
    itemId: 'item',
    direction: 'src-to-dst',
    attempts: 3,
    correct: 2,
    incorrect: 1,
    streak: 1,
    lapses: 1,
    lastResult: 'correct',
    lastReviewedAt: 1700000000000,
    lastQuality: 4,
    ef: 2.3,
    intervalDays: 1,
    repetitions: 1,
    dueAt: 1700086400000,
    ...overrides
  };
}

function makeEvent(overrides: Partial<ReviewEvent> = {}): ReviewEvent {
  return {
    id: 'event-1',
    packId: 'pack',
    itemId: 'item',
    direction: 'src-to-dst',
    result: 'correct',
    timestamp: 1700000000000,
    ...overrides
  };
}

describe('buildHistorySummary', () => {
  it('summarizes totals, accuracy, and time range', () => {
    const events = [
      makeEvent({ result: 'correct', timestamp: 1700000000000 }),
      makeEvent({ id: 'event-2', result: 'incorrect', timestamp: 1700000500000 })
    ];
    const cards = [makeCard({ attempts: 2 }), makeCard({ id: 'pack:item2:dst-to-src', itemId: 'item2' })];

    const summary = buildHistorySummary(events, cards);

    expect(summary.totalAttempts).toBe(2);
    expect(summary.correct).toBe(1);
    expect(summary.incorrect).toBe(1);
    expect(summary.accuracy).toBe(50);
    expect(summary.firstReviewedAt).toBe(1700000000000);
    expect(summary.lastReviewedAt).toBe(1700000500000);
    expect(summary.uniqueItems).toBe(2);
  });
});

describe('buildPackSummaries', () => {
  it('groups attempts by pack', () => {
    const events = [
      makeEvent({ packId: 'pack-a', result: 'correct', timestamp: 1700000000000 }),
      makeEvent({ id: 'event-2', packId: 'pack-b', result: 'incorrect', timestamp: 1700000100000 }),
      makeEvent({ id: 'event-3', packId: 'pack-a', result: 'incorrect', timestamp: 1700000200000 })
    ];

    const summaries = buildPackSummaries(events);

    expect(summaries).toHaveLength(2);
    const packA = summaries.find((summary) => summary.packId === 'pack-a');
    expect(packA?.attempts).toBe(2);
    expect(packA?.correct).toBe(1);
    expect(packA?.incorrect).toBe(1);
    expect(packA?.accuracy).toBe(50);
  });
});
