import { describe, expect, it } from 'vitest';
import type { DrillDirection, VocabItem } from '../src/types.ts';
import { buildSrsOrder } from '../src/logic/srs.ts';
import { createReviewCard, type ReviewCard } from '../src/logic/review.ts';

const DEFAULT_DIRECTION: DrillDirection = 'dst-to-src';

function buildItems(count: number): VocabItem[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `item-${index}`,
    src: `it-${index}`,
    dst: `fi-${index}`
  }));
}

function makeCard(itemId: string, direction: DrillDirection, dueAt?: number): ReviewCard {
  return {
    ...createReviewCard({ packId: 'pack', itemId, direction }),
    attempts: 1,
    repetitions: 1,
    intervalDays: 1,
    dueAt
  };
}

describe('buildSrsOrder', () => {
  it('uses shuffled new items when no review data exists', () => {
    const items = buildItems(3);
    const order = buildSrsOrder(items, DEFAULT_DIRECTION, [], {
      now: 1_000,
      sessionSize: 2,
      maxNew: 15,
      maxReview: 120,
      rng: () => 0.999999
    });

    expect(order).toEqual([0, 1]);
  });

  it('prioritizes due cards before new and upcoming items', () => {
    const items = buildItems(4);
    const cards = [
      makeCard('item-2', DEFAULT_DIRECTION, 500),
      makeCard('item-1', DEFAULT_DIRECTION, 1_500)
    ];

    const order = buildSrsOrder(items, DEFAULT_DIRECTION, cards, {
      now: 1_000,
      sessionSize: 4,
      maxNew: 2,
      maxReview: 120,
      rng: () => 0.999999
    });

    expect(order).toEqual([2, 0, 3, 1]);
  });

  it('respects caps and fills with upcoming cards', () => {
    const items = buildItems(6);
    const cards = [
      makeCard('item-0', DEFAULT_DIRECTION, 100),
      makeCard('item-1', DEFAULT_DIRECTION, 200),
      makeCard('item-2', DEFAULT_DIRECTION, 300),
      makeCard('item-3', DEFAULT_DIRECTION, 2_000)
    ];

    const order = buildSrsOrder(items, DEFAULT_DIRECTION, cards, {
      now: 1_000,
      sessionSize: 4,
      maxNew: 1,
      maxReview: 2,
      rng: () => 0.999999
    });

    expect(order).toEqual([0, 1, 4, 3]);
  });

  it('filters cards by direction', () => {
    const items = buildItems(2);
    const cards = [makeCard('item-0', 'src-to-dst', 100)];

    const order = buildSrsOrder(items, DEFAULT_DIRECTION, cards, {
      now: 1_000,
      sessionSize: 2,
      maxNew: 15,
      maxReview: 120,
      rng: () => 0.999999
    });

    expect(order).toEqual([0, 1]);
  });
});
