import {
  applyReviewResult,
  buildReviewCardId,
  createReviewCard,
  type ReviewCard,
  type ReviewCardSeed,
  type ReviewInput
} from '../logic/review.ts';
import type { ReviewEvent } from '../logic/reviewEvents.ts';

const DB_NAME = 'italian-language-trainer';
const DB_VERSION = 2;
const STORE_REVIEW_CARDS = 'reviewCards';
const STORE_REVIEW_EVENTS = 'reviewEvents';

let dbPromise: Promise<IDBDatabase> | undefined;

function getDb(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = openDb();
  }
  return dbPromise;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_REVIEW_CARDS)) {
        const store = db.createObjectStore(STORE_REVIEW_CARDS, { keyPath: 'id' });
        store.createIndex('by-pack', 'packId', { unique: false });
        store.createIndex('by-item', ['packId', 'itemId', 'direction'], { unique: true });
      }
      if (!db.objectStoreNames.contains(STORE_REVIEW_EVENTS)) {
        const events = db.createObjectStore(STORE_REVIEW_EVENTS, { keyPath: 'id' });
        events.createIndex('by-pack', 'packId', { unique: false });
        events.createIndex('by-pack-timestamp', ['packId', 'timestamp'], { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Failed to open IndexedDB'));
  });
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'));
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB transaction failed'));
    transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB transaction aborted'));
  });
}

export async function getReviewCard(id: string): Promise<ReviewCard | undefined> {
  const db = await getDb();
  const transaction = db.transaction(STORE_REVIEW_CARDS, 'readonly');
  const store = transaction.objectStore(STORE_REVIEW_CARDS);
  const result = await requestToPromise(store.get(id));
  await transactionDone(transaction);
  return result;
}

export async function putReviewCard(card: ReviewCard): Promise<void> {
  const db = await getDb();
  const transaction = db.transaction(STORE_REVIEW_CARDS, 'readwrite');
  const store = transaction.objectStore(STORE_REVIEW_CARDS);
  store.put(card);
  await transactionDone(transaction);
}

export async function recordReviewResult(seed: ReviewCardSeed, input: ReviewInput): Promise<ReviewCard> {
  const id = buildReviewCardId(seed.packId, seed.itemId, seed.direction);
  const existing = await getReviewCard(id);
  const base = existing ?? createReviewCard(seed);
  const updated = applyReviewResult(base, input);
  await putReviewCard(updated);
  await addReviewEvent({
    id: buildReviewEventId(input.now),
    packId: seed.packId,
    itemId: seed.itemId,
    direction: seed.direction,
    result: input.correct ? 'correct' : 'incorrect',
    timestamp: input.now
  });
  return updated;
}

export async function listReviewCardsByPack(packId: string): Promise<ReviewCard[]> {
  const db = await getDb();
  const transaction = db.transaction(STORE_REVIEW_CARDS, 'readonly');
  const store = transaction.objectStore(STORE_REVIEW_CARDS);
  const index = store.index('by-pack');
  const result = await requestToPromise(index.getAll(packId));
  await transactionDone(transaction);
  return result;
}

export async function listAllReviewCards(): Promise<ReviewCard[]> {
  const db = await getDb();
  const transaction = db.transaction(STORE_REVIEW_CARDS, 'readonly');
  const store = transaction.objectStore(STORE_REVIEW_CARDS);
  const result = await requestToPromise(store.getAll());
  await transactionDone(transaction);
  return result;
}

export async function listReviewCardsByPackAndDirection(
  packId: string,
  direction: ReviewCard['direction']
): Promise<ReviewCard[]> {
  const cards = await listReviewCardsByPack(packId);
  return cards.filter((card) => card.direction === direction);
}

export async function listReviewEventsByPackSince(packId: string, since: number): Promise<ReviewEvent[]> {
  const db = await getDb();
  const transaction = db.transaction(STORE_REVIEW_EVENTS, 'readonly');
  const store = transaction.objectStore(STORE_REVIEW_EVENTS);
  const index = store.index('by-pack-timestamp');
  const range = IDBKeyRange.bound([packId, since], [packId, Number.MAX_SAFE_INTEGER]);
  const result = await requestToPromise(index.getAll(range));
  await transactionDone(transaction);
  return result;
}

export async function listAllReviewEvents(): Promise<ReviewEvent[]> {
  const db = await getDb();
  const transaction = db.transaction(STORE_REVIEW_EVENTS, 'readonly');
  const store = transaction.objectStore(STORE_REVIEW_EVENTS);
  const result = await requestToPromise(store.getAll());
  await transactionDone(transaction);
  return result;
}

async function addReviewEvent(event: ReviewEvent): Promise<void> {
  const db = await getDb();
  const transaction = db.transaction(STORE_REVIEW_EVENTS, 'readwrite');
  const store = transaction.objectStore(STORE_REVIEW_EVENTS);
  store.put(event);
  await transactionDone(transaction);
}

function buildReviewEventId(now: number): string {
  const random = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Math.random()}`;
  return `${now}-${random}`;
}
