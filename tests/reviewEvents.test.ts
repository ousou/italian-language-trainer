import { describe, expect, it } from 'vitest';
import { buildDailyAttemptCounts, buildDayKey } from '../src/logic/reviewEvents.ts';

describe('buildDailyAttemptCounts', () => {
  it('creates a fixed window with zero-filled days', () => {
    const now = new Date(2025, 0, 10, 12, 0, 0).getTime();
    const events = [
      {
        id: 'event-1',
        packId: 'pack',
        itemId: 'item',
        direction: 'src-to-dst',
        result: 'correct',
        timestamp: new Date(2025, 0, 10, 9, 0, 0).getTime()
      },
      {
        id: 'event-2',
        packId: 'pack',
        itemId: 'item',
        direction: 'src-to-dst',
        result: 'incorrect',
        timestamp: new Date(2025, 0, 8, 15, 0, 0).getTime()
      }
    ];

    const counts = buildDailyAttemptCounts(events, now, 3);

    expect(counts).toEqual([
      { dayKey: buildDayKey(new Date(2025, 0, 8, 12, 0, 0).getTime()), count: 1 },
      { dayKey: buildDayKey(new Date(2025, 0, 9, 12, 0, 0).getTime()), count: 0 },
      { dayKey: buildDayKey(new Date(2025, 0, 10, 12, 0, 0).getTime()), count: 1 }
    ]);
  });
});
