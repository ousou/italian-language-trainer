import type { LanguageCode, VocabItem, VocabPack } from '../types.ts';

export interface PhrasePackMeta {
  id: string;
  title: string;
  path: string;
}

export const AVAILABLE_PHRASEPACKS: PhrasePackMeta[] = [
  {
    id: 'core-it-fi-a1',
    title: 'Core A1 — Italian⇄Finnish',
    path: 'phrasepacks/core-it-fi-a1.json'
  },
  {
    id: 'core-it-sv-a1',
    title: 'Core A1 — Italienska⇄Svenska',
    path: 'phrasepacks/core-it-sv-a1.json'
  },
  {
    id: 'bella-vista-1-1',
    title: 'Bella Vista 1 ch 1',
    path: 'phrasepacks/bella-vista-1-ch-1.json'
  },
  {
    id: 'bella-vista-1-2',
    title: 'Bella Vista 1 ch 2',
    path: 'phrasepacks/bella-vista-1-ch-2.json'
  },
  {
    id: 'bella-vista-1-3',
    title: 'Bella Vista 1 ch 3',
    path: 'phrasepacks/bella-vista-1-ch-3.json'
  },
  {
    id: 'bella-vista-1-4',
    title: 'Bella Vista 1 ch 4',
    path: 'phrasepacks/bella-vista-1-ch-4.json'
  },
  {
    id: 'bella-vista-1-5',
    title: 'Bella Vista 1 ch 5',
    path: 'phrasepacks/bella-vista-1-ch-5.json'
  },
  {
    id: 'bella-vista-1-6',
    title: 'Bella Vista 1 ch 6',
    path: 'phrasepacks/bella-vista-1-ch-6.json'
  },
  {
    id: 'restaurant-it-fi',
    title: 'Restaurant — Italian⇄Finnish',
    path: 'phrasepacks/restaurant-it-fi.json'
  },
  {
    id: 'restaurant-it-sv',
    title: 'Restaurant — Italienska⇄Svenska',
    path: 'phrasepacks/restaurant-it-sv.json'
  }
];

type RawPhrasePack = PhrasePackJson | VocabPack;

interface PhrasePackJson {
  type: 'phrases';
  id: string;
  title: string;
  src: LanguageCode;
  dst: LanguageCode;
  sections?: PhrasePackSection[];
}

interface PhrasePackSection {
  title?: string;
  items?: PhrasePackEntry[];
}

type PhrasePackEntry = {
  id?: string;
} & Partial<Record<LanguageCode, string>>;

function normalizePack(raw: RawPhrasePack): VocabPack {
  if (raw.type === 'vocab') {
    return raw;
  }

  const srcKey = raw.src;
  const dstKey = raw.dst;

  const items: VocabItem[] = [];

  const sections = Array.isArray(raw.sections) ? raw.sections : [];

  sections.forEach((section, sectionIndex) => {
    const entries = Array.isArray(section.items) ? section.items : [];

    entries.forEach((entry, itemIndex) => {
      const srcText = entry[srcKey];
      const dstText = entry[dstKey];

      if (typeof srcText !== 'string' || typeof dstText !== 'string') {
        const sectionLabel = section.title ?? `Section ${sectionIndex + 1}`;
        const entryLabel = entry.id ?? `item-${itemIndex + 1}`;
        throw new Error(`Missing phrase data (${sectionLabel} → ${entryLabel}) for ${raw.title}`);
      }

      const id = entry.id ?? `${raw.id}-${sectionIndex}-${itemIndex}`;

      items.push({
        id,
        src: srcText,
        dst: dstText
      });
    });
  });

  return {
    type: 'vocab',
    id: raw.id,
    title: raw.title,
    src: raw.src,
    dst: raw.dst,
    items
  };
}

export async function fetchPhrasePack(id: string): Promise<VocabPack> {
  const meta = AVAILABLE_PHRASEPACKS.find((pack) => pack.id === id);

  if (!meta) {
    throw new Error(`Unknown phrase pack: ${id}`);
  }

  const response = await fetch(meta.path);

  if (!response.ok) {
    throw new Error(`Failed to load phrase pack: ${meta.title}`);
  }

  const data = (await response.json()) as RawPhrasePack;

  try {
    return normalizePack(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : `Unexpected phrase pack format for ${meta.title}`;
    throw new Error(message);
  }
}

export function getPhrasePackMeta(id: string): PhrasePackMeta | undefined {
  return AVAILABLE_PHRASEPACKS.find((pack) => pack.id === id);
}
