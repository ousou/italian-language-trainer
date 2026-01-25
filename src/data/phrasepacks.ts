import type { LanguageCode, VocabItem, VocabPack } from '../types.ts';

export interface PhrasePackMeta {
  id: string;
  title: string;
  path: string;
}

export const AVAILABLE_PHRASEPACKS: PhrasePackMeta[] = [
  {
    id: 'bella-vista-1-1',
    title: 'Bella Vista 1, kappale 1',
    path: 'phrasepacks/bella-vista-1-ch-1.json'
  },
  {
    id: 'bella-vista-1-2',
    title: 'Bella Vista 1, kappale 2',
    path: 'phrasepacks/bella-vista-1-ch-2.json'
  },
  {
    id: 'bella-vista-1-3',
    title: 'Bella Vista 1, kappale 3',
    path: 'phrasepacks/bella-vista-1-ch-3.json'
  },
  {
    id: 'bella-vista-1-4',
    title: 'Bella Vista 1, kappale 4',
    path: 'phrasepacks/bella-vista-1-ch-4.json'
  },
  {
    id: 'bella-vista-1-5',
    title: 'Bella Vista 1, kappale 5',
    path: 'phrasepacks/bella-vista-1-ch-5.json'
  },
  {
    id: 'bella-vista-1-6',
    title: 'Bella Vista 1, kappale 6',
    path: 'phrasepacks/bella-vista-1-ch-6.json'
  },
  {
    id: 'bella-vista-1-7',
    title: 'Bella Vista 1, kappale 7',
    path: 'phrasepacks/bella-vista-1-ch-7.json'
  },
  {
    id: 'bella-vista-1-8',
    title: 'Bella Vista 1, kappale 8',
    path: 'phrasepacks/bella-vista-1-ch-8.json'
  },
  {
    id: 'bella-vista-1-9',
    title: 'Bella Vista 1, kappale 9',
    path: 'phrasepacks/bella-vista-1-ch-9.json'
  },
  {
    id: 'bella-vista-1-10',
    title: 'Bella Vista 1, kappale 10',
    path: 'phrasepacks/bella-vista-1-ch-10.json'
  },
  {
    id: 'bella-vista-1-11',
    title: 'Bella Vista 1, kappale 11',
    path: 'phrasepacks/bella-vista-1-ch-11.json'
  },
  {
    id: 'bella-vista-1-12',
    title: 'Bella Vista 1, kappale 12',
    path: 'phrasepacks/bella-vista-1-ch-12.json'
  },
  {
    id: 'bella-vista-1-13',
    title: 'Bella Vista 1, kappale 13',
    path: 'phrasepacks/bella-vista-1-ch-13.json'
  },
  {
    id: 'bella-vista-1-14',
    title: 'Bella Vista 1, kappale 14',
    path: 'phrasepacks/bella-vista-1-ch-14.json'
  },
  {
    id: 'core-it-fi-a1',
    title: 'Perussanastoa — Italia⇄Suomi',
    path: 'phrasepacks/core-it-fi-a1.json'
  },
  {
    id: 'core-it-sv-a1',
    title: 'Vanliga ord — Italienska⇄Svenska',
    path: 'phrasepacks/core-it-sv-a1.json'
  },
  {
    id: 'nastan-samma-it-sv',
    title: '(Nästan) samma på italienska',
    path: 'phrasepacks/nastan-samma-it-sv.json'
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
