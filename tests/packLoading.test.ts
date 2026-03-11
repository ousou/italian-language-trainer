import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchPhrasePack } from '../src/data/phrasepacks.ts';
import { fetchVerbPack } from '../src/data/verbpacks.ts';

class MemoryStorage {
  private data = new Map<string, string>();

  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.data.set(key, value);
  }

  removeItem(key: string): void {
    this.data.delete(key);
  }

  clear(): void {
    this.data.clear();
  }
}

describe('pack loading cache', () => {
  const storage = new MemoryStorage();

  beforeEach(() => {
    vi.stubGlobal('localStorage', storage);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    storage.clear();
  });

  it('loads phrase pack from cache when offline', async () => {
    const onlineFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        type: 'phrases',
        id: 'core-it-fi-a1',
        title: 'Core A1 — Italian⇄Finnish',
        src: 'it',
        dst: 'fi',
        sections: [{ items: [{ id: 'ciao', it: 'ciao', fi: 'moi' }] }]
      })
    });
    vi.stubGlobal('fetch', onlineFetch);

    const first = await fetchPhrasePack('core-it-fi-a1');
    expect(first.items).toHaveLength(1);

    const offlineFetch = vi.fn().mockRejectedValue(new Error('offline'));
    vi.stubGlobal('fetch', offlineFetch);

    const cached = await fetchPhrasePack('core-it-fi-a1');
    expect(cached.items[0]?.dst).toBe('moi');
  });

  it('loads verb pack from cache when offline', async () => {
    const onlineFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        type: 'verbs',
        id: 'core-it-fi-verbs-a1',
        title: 'Core Verbs A1 — Italian⇄Finnish',
        src: 'it',
        dst: 'fi',
        items: [
          {
            id: 'essere',
            src: 'essere',
            dst: 'olla',
            conjugations: {
              present: {
                io: 'sono',
                tu: 'sei',
                luiLei: 'è',
                noi: 'siamo',
                voi: 'siete',
                loro: 'sono'
              }
            }
          }
        ]
      })
    });
    vi.stubGlobal('fetch', onlineFetch);

    const first = await fetchVerbPack('core-it-fi-verbs-a1');
    expect(first.items).toHaveLength(1);

    const offlineFetch = vi.fn().mockRejectedValue(new Error('offline'));
    vi.stubGlobal('fetch', offlineFetch);

    const cached = await fetchVerbPack('core-it-fi-verbs-a1');
    expect(cached.items[0]?.id).toBe('essere');
  });
});
