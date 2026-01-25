import type { DrillDirection } from '../types.ts';
import type { ReviewCard } from './review.ts';

export interface SrsItem {
  id: string;
}

export interface SrsQueueOptions {
  now: number;
  sessionSize: number;
  maxNew: number;
  maxReview: number;
  rng?: () => number;
}

export function buildSrsOrder(
  items: SrsItem[],
  direction: DrillDirection,
  cards: ReviewCard[],
  options: SrsQueueOptions
): number[] {
  if (items.length === 0 || options.sessionSize <= 0) {
    return [];
  }

  const rng = options.rng ?? Math.random;
  const indexById = new Map(items.map((item, index) => [item.id, index]));

  const filteredCards = cards.filter((card) => card.direction === direction);
  const reviewedIds = new Set(filteredCards.map((card) => card.itemId));

  const dueCards: ReviewCard[] = [];
  const upcomingCards: ReviewCard[] = [];

  for (const card of filteredCards) {
    if (!indexById.has(card.itemId)) {
      continue;
    }
    if (card.dueAt === undefined || card.dueAt <= options.now) {
      dueCards.push(card);
    } else {
      upcomingCards.push(card);
    }
  }

  dueCards.sort((a, b) => compareDue(a, b));
  upcomingCards.sort((a, b) => compareDue(a, b));

  const order: number[] = [];
  const usedIds = new Set<string>();

  const maxReview = Math.max(0, options.maxReview);
  for (const card of dueCards.slice(0, maxReview)) {
    const index = indexById.get(card.itemId);
    if (index === undefined) {
      continue;
    }
    order.push(index);
    usedIds.add(card.itemId);
  }

  const newCandidates = items
    .filter((item) => !reviewedIds.has(item.id))
    .map((item) => item.id);

  const shuffledNew = shuffleIds(newCandidates, rng);
  const remainingAfterReviews = Math.max(0, options.sessionSize - order.length);
  const newLimit = Math.min(options.maxNew, remainingAfterReviews);

  for (const itemId of shuffledNew.slice(0, newLimit)) {
    const index = indexById.get(itemId);
    if (index === undefined || usedIds.has(itemId)) {
      continue;
    }
    order.push(index);
    usedIds.add(itemId);
  }

  if (order.length < options.sessionSize) {
    for (const card of upcomingCards) {
      if (order.length >= options.sessionSize) {
        break;
      }
      if (usedIds.has(card.itemId)) {
        continue;
      }
      const index = indexById.get(card.itemId);
      if (index === undefined) {
        continue;
      }
      order.push(index);
      usedIds.add(card.itemId);
    }
  }

  return order.slice(0, options.sessionSize);
}

function compareDue(a: ReviewCard, b: ReviewCard): number {
  const aDue = a.dueAt ?? 0;
  const bDue = b.dueAt ?? 0;
  if (aDue !== bDue) {
    return aDue - bDue;
  }
  return a.itemId.localeCompare(b.itemId);
}

function shuffleIds(ids: string[], rng: () => number): string[] {
  const result = [...ids];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
