import type { ReviewCard, ReviewResult } from './review.ts';
import type { ReviewEvent } from './reviewEvents.ts';
import type { DrillDirection } from '../types.ts';

export interface HistorySnapshot {
  cards: ReviewCard[];
  events: ReviewEvent[];
}

export interface HistoryExport {
  version: 1;
  createdAt: number;
  cards: ReviewCard[];
  events: ReviewEvent[];
}

export interface HistorySummary {
  totalAttempts: number;
  correct: number;
  incorrect: number;
  accuracy: number;
  firstReviewedAt?: number;
  lastReviewedAt?: number;
  uniqueItems: number;
}

export interface PackHistorySummary {
  packId: string;
  attempts: number;
  correct: number;
  incorrect: number;
  accuracy: number;
  firstReviewedAt?: number;
  lastReviewedAt?: number;
}

export function createHistoryExport(snapshot: HistorySnapshot, now: number): HistoryExport {
  return {
    version: 1,
    createdAt: now,
    cards: snapshot.cards,
    events: snapshot.events
  };
}

export function parseHistoryExport(raw: string): HistorySnapshot {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error('History file is not valid JSON.');
  }

  if (!isRecord(parsed) || parsed.version !== 1) {
    throw new Error('History file has an unsupported format.');
  }

  const cardsRaw = parsed.cards;
  const eventsRaw = parsed.events;

  if (!Array.isArray(cardsRaw) || !Array.isArray(eventsRaw)) {
    throw new Error('History file is missing required data.');
  }

  const cards: ReviewCard[] = [];
  for (const entry of cardsRaw) {
    if (!isReviewCard(entry)) {
      throw new Error('History file contains invalid review card data.');
    }
    cards.push(entry);
  }

  const events: ReviewEvent[] = [];
  for (const entry of eventsRaw) {
    if (!isReviewEvent(entry)) {
      throw new Error('History file contains invalid review event data.');
    }
    events.push(entry);
  }

  return { cards, events };
}

export function buildHistorySummary(events: ReviewEvent[], cards: ReviewCard[]): HistorySummary {
  const totalAttempts = events.length;
  const correct = events.filter((event) => event.result === 'correct').length;
  const incorrect = events.filter((event) => event.result === 'incorrect').length;
  const accuracy = totalAttempts > 0 ? Math.round((correct / totalAttempts) * 100) : 0;

  const timestamps = events.map((event) => event.timestamp);
  const firstReviewedAt = timestamps.length > 0 ? Math.min(...timestamps) : undefined;
  const lastReviewedAt = timestamps.length > 0 ? Math.max(...timestamps) : undefined;

  const itemKeys = new Set<string>();
  for (const card of cards) {
    itemKeys.add(`${card.packId}:${card.itemId}`);
  }
  for (const event of events) {
    itemKeys.add(`${event.packId}:${event.itemId}`);
  }

  return {
    totalAttempts,
    correct,
    incorrect,
    accuracy,
    firstReviewedAt,
    lastReviewedAt,
    uniqueItems: itemKeys.size
  };
}

export function buildPackSummaries(events: ReviewEvent[]): PackHistorySummary[] {
  const summaries = new Map<string, PackHistorySummary>();

  for (const event of events) {
    const summary =
      summaries.get(event.packId) ??
      {
        packId: event.packId,
        attempts: 0,
        correct: 0,
        incorrect: 0,
        accuracy: 0,
        firstReviewedAt: event.timestamp,
        lastReviewedAt: event.timestamp
      };

    summary.attempts += 1;
    if (event.result === 'correct') {
      summary.correct += 1;
    } else {
      summary.incorrect += 1;
    }
    summary.firstReviewedAt = Math.min(summary.firstReviewedAt ?? event.timestamp, event.timestamp);
    summary.lastReviewedAt = Math.max(summary.lastReviewedAt ?? event.timestamp, event.timestamp);
    summaries.set(event.packId, summary);
  }

  for (const summary of summaries.values()) {
    summary.accuracy = summary.attempts > 0 ? Math.round((summary.correct / summary.attempts) * 100) : 0;
  }

  return Array.from(summaries.values()).sort((a, b) => b.attempts - a.attempts);
}


function isReviewEvent(value: unknown): value is ReviewEvent {
  if (!isRecord(value)) {
    return false;
  }
  return (
    isString(value.id) &&
    isString(value.packId) &&
    isString(value.itemId) &&
    isDrillDirection(value.direction) &&
    isReviewResult(value.result) &&
    isFiniteNumber(value.timestamp)
  );
}

function isReviewCard(value: unknown): value is ReviewCard {
  if (!isRecord(value)) {
    return false;
  }
  return (
    isString(value.id) &&
    isString(value.packId) &&
    isString(value.itemId) &&
    isDrillDirection(value.direction) &&
    isFiniteNumber(value.attempts) &&
    isFiniteNumber(value.correct) &&
    isFiniteNumber(value.incorrect) &&
    isFiniteNumber(value.streak) &&
    isFiniteNumber(value.lapses) &&
    isReviewResultOrUndefined(value.lastResult) &&
    isOptionalNumber(value.lastReviewedAt) &&
    isOptionalNumber(value.lastQuality) &&
    isFiniteNumber(value.ef) &&
    isFiniteNumber(value.intervalDays) &&
    isFiniteNumber(value.repetitions) &&
    isOptionalNumber(value.dueAt)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isOptionalNumber(value: unknown): value is number | undefined {
  return value === undefined || isFiniteNumber(value);
}

function isDrillDirection(value: unknown): value is DrillDirection {
  return value === 'src-to-dst' || value === 'dst-to-src';
}

function isReviewResult(value: unknown): value is ReviewResult {
  return value === 'correct' || value === 'incorrect';
}

function isReviewResultOrUndefined(value: unknown): value is ReviewResult | undefined {
  return value === undefined || isReviewResult(value);
}
