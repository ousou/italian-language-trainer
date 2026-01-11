import type { DrillDirection } from '../types.ts';

export type ReviewResult = 'correct' | 'incorrect';

export interface ReviewCardSeed {
  packId: string;
  itemId: string;
  direction: DrillDirection;
}

export interface ReviewCard {
  id: string;
  packId: string;
  itemId: string;
  direction: DrillDirection;
  attempts: number;
  correct: number;
  incorrect: number;
  streak: number;
  lapses: number;
  lastResult?: ReviewResult;
  lastReviewedAt?: number;
  lastQuality?: number;
  ef: number;
  intervalDays: number;
  repetitions: number;
  dueAt?: number;
}

export interface ReviewInput {
  correct: boolean;
  now: number;
  quality?: number;
}

export const DEFAULT_EASE_FACTOR = 2.3;
export const MIN_EASE_FACTOR = 1.3;
export const DAY_MS = 24 * 60 * 60 * 1000;

export function buildReviewCardId(packId: string, itemId: string, direction: DrillDirection): string {
  return `${packId}:${itemId}:${direction}`;
}

export function createReviewCard(seed: ReviewCardSeed): ReviewCard {
  return {
    id: buildReviewCardId(seed.packId, seed.itemId, seed.direction),
    packId: seed.packId,
    itemId: seed.itemId,
    direction: seed.direction,
    attempts: 0,
    correct: 0,
    incorrect: 0,
    streak: 0,
    lapses: 0,
    lastResult: undefined,
    lastReviewedAt: undefined,
    lastQuality: undefined,
    ef: DEFAULT_EASE_FACTOR,
    intervalDays: 0,
    repetitions: 0,
    dueAt: undefined
  };
}

export function applyReviewResult(card: ReviewCard, input: ReviewInput): ReviewCard {
  const quality = clampQuality(input.quality ?? (input.correct ? 4 : 2));
  const nextEf = updateEaseFactor(card.ef, quality);

  const attempts = card.attempts + 1;
  const correct = card.correct + (input.correct ? 1 : 0);
  const incorrect = card.incorrect + (input.correct ? 0 : 1);
  const lastResult: ReviewResult = input.correct ? 'correct' : 'incorrect';

  let repetitions = card.repetitions;
  let intervalDays = card.intervalDays;
  let streak = card.streak;
  let lapses = card.lapses;

  if (quality < 3) {
    repetitions = 0;
    intervalDays = 1;
    streak = 0;
    lapses += 1;
  } else {
    repetitions = card.repetitions + 1;
    intervalDays = calculateIntervalDays(repetitions, card.intervalDays, nextEf);
    streak = card.streak + 1;
  }

  return {
    ...card,
    attempts,
    correct,
    incorrect,
    streak,
    lapses,
    lastResult,
    lastReviewedAt: input.now,
    lastQuality: quality,
    ef: nextEf,
    intervalDays,
    repetitions,
    dueAt: input.now + intervalDays * DAY_MS
  };
}

function clampQuality(value: number): number {
  if (value < 0) {
    return 0;
  }
  if (value > 5) {
    return 5;
  }
  return Math.round(value);
}

function updateEaseFactor(ef: number, quality: number): number {
  const adjusted = ef + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  return Math.max(MIN_EASE_FACTOR, Number(adjusted.toFixed(2)));
}

function calculateIntervalDays(repetitions: number, previousInterval: number, ef: number): number {
  if (repetitions <= 1) {
    return 1;
  }
  if (repetitions === 2) {
    return 6;
  }
  const base = previousInterval > 0 ? previousInterval : 1;
  return Math.round(base * ef);
}
