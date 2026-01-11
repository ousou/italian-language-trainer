import {
  applyReviewResult,
  buildReviewCardId,
  createReviewCard,
  type ReviewCard,
  type ReviewCardSeed,
  type ReviewInput
} from '../logic/review.ts';

const DB_NAME = 'italian-language-trainer';
const DB_VERSION = 1;
const STORE_REVIEW_CARDS = 'reviewCards';

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
  return updated;
}
