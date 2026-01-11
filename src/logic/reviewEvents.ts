import type { DrillDirection } from '../types.ts';
import type { ReviewResult } from './review.ts';

export interface ReviewEvent {
  id: string;
  packId: string;
  itemId: string;
  direction: DrillDirection;
  result: ReviewResult;
  timestamp: number;
}

export interface DailyAttemptCount {
  dayKey: string;
  count: number;
}

export function buildDayKey(timestamp: number): string {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function startOfLocalDay(timestamp: number): number {
  const date = new Date(timestamp);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

export function buildDailyAttemptCounts(events: ReviewEvent[], now: number, days: number): DailyAttemptCount[] {
  const safeDays = Math.max(1, Math.floor(days));
  const dayStart = startOfLocalDay(now);

  const countsByDay = new Map<string, number>();
  for (const event of events) {
    const key = buildDayKey(event.timestamp);
    countsByDay.set(key, (countsByDay.get(key) ?? 0) + 1);
  }

  const results: DailyAttemptCount[] = [];
  for (let offset = safeDays - 1; offset >= 0; offset -= 1) {
    const date = new Date(dayStart);
    date.setDate(date.getDate() - offset);
    const key = buildDayKey(date.getTime());
    results.push({ dayKey: key, count: countsByDay.get(key) ?? 0 });
  }

  return results;
}
