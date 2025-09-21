import type { VocabPack } from '../types.ts';

export interface PhrasePackMeta {
  id: string;
  title: string;
  path: string;
}

export const AVAILABLE_PHRASEPACKS: PhrasePackMeta[] = [
  {
    id: 'core-it-fi-a1',
    title: 'Core A1 — Italian⇄Finnish',
    path: '/phrasepacks/core-it-fi-a1.json'
  },
  {
    id: 'core-it-sv-a1',
    title: 'Core A1 — Italienska⇄Svenska',
    path: '/phrasepacks/core-it-sv-a1.json'
  },
  {
    id: 'restaurant-it-fi',
    title: 'Restaurant — Italian⇄Finnish',
    path: '/phrasepacks/restaurant-it-fi.json'
  },
  {
    id: 'restaurant-it-sv',
    title: 'Restaurant — Italienska⇄Svenska',
    path: '/phrasepacks/restaurant-it-sv.json'
  }
];

export async function fetchPhrasePack(id: string): Promise<VocabPack> {
  const meta = AVAILABLE_PHRASEPACKS.find((pack) => pack.id === id);

  if (!meta) {
    throw new Error(`Unknown phrase pack: ${id}`);
  }

  const response = await fetch(meta.path);

  if (!response.ok) {
    throw new Error(`Failed to load phrase pack: ${meta.title}`);
  }

  const data = (await response.json()) as VocabPack;

  if (!data || data.type !== 'vocab') {
    throw new Error(`Unexpected phrase pack format for ${meta.title}`);
  }

  return data;
}

export function getPhrasePackMeta(id: string): PhrasePackMeta | undefined {
  return AVAILABLE_PHRASEPACKS.find((pack) => pack.id === id);
}
