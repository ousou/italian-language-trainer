import type { AnswerSpec, VerbConjugationTable, VerbItem, VerbPack, VerbPerson } from '../types.ts';

export interface VerbPackMeta {
  id: string;
  title: string;
  path: string;
}

export const AVAILABLE_VERBPACKS: VerbPackMeta[] = [
  {
    id: 'core-it-fi-verbs-a1',
    title: 'Core Verbs A1 — Italian⇄Finnish',
    path: 'verbpacks/core-it-fi-verbs-a1.json'
  }
];

const PERSONS: VerbPerson[] = ['io', 'tu', 'luiLei', 'noi', 'voi', 'loro'];

type RawVerbPack = VerbPack & {
  items: Array<VerbItem & { conjugations?: { present?: Record<string, unknown> } }>;
};

function normalizeVerbPack(raw: RawVerbPack): VerbPack {
  if (raw.type !== 'verbs') {
    throw new Error('Invalid verb pack type.');
  }
  if (!raw.id || !raw.title) {
    throw new Error('Verb pack is missing id or title.');
  }
  if (!raw.src || !raw.dst) {
    throw new Error('Verb pack is missing language codes.');
  }

  const items = Array.isArray(raw.items) ? raw.items : [];
  const normalizedItems = items.map((item, index) => normalizeVerbItem(item, index, raw.title));

  return {
    type: 'verbs',
    id: raw.id,
    title: raw.title,
    src: raw.src,
    dst: raw.dst,
    items: normalizedItems
  };
}

function normalizeVerbItem(item: RawVerbPack['items'][number], index: number, title: string): VerbItem {
  if (!item || typeof item !== 'object') {
    throw new Error(`Invalid verb entry in ${title}.`);
  }
  if (!item.id || typeof item.id !== 'string') {
    throw new Error(`Verb entry ${index + 1} is missing an id in ${title}.`);
  }
  if (!item.dst || typeof item.dst !== 'string') {
    throw new Error(`Verb entry ${item.id} is missing a dst translation in ${title}.`);
  }

  const src = normalizeAnswerSpec(item.src, `Verb entry ${item.id} is missing a src infinitive in ${title}.`);

  const conjugations = item.conjugations?.present;
  if (!conjugations || typeof conjugations !== 'object') {
    throw new Error(`Verb entry ${item.id} is missing present tense conjugations in ${title}.`);
  }

  const present = PERSONS.reduce<VerbConjugationTable>((acc, person) => {
    const value = conjugations[person];
    acc[person] = normalizeAnswerSpec(
      value,
      `Verb entry ${item.id} is missing ${person} conjugation in ${title}.`
    );
    return acc;
  }, {} as VerbConjugationTable);

  return {
    id: item.id,
    src,
    dst: item.dst,
    conjugations: {
      present
    }
  };
}

function normalizeAnswerSpec(value: unknown, errorMessage: string): AnswerSpec {
  if (typeof value === 'string') {
    return value;
  }
  if (Array.isArray(value)) {
    const filtered = value.filter((entry): entry is string => typeof entry === 'string' && entry.trim() !== '');
    if (filtered.length > 0) {
      return filtered;
    }
  }
  throw new Error(errorMessage);
}

export async function fetchVerbPack(id: string): Promise<VerbPack> {
  const meta = AVAILABLE_VERBPACKS.find((pack) => pack.id === id);

  if (!meta) {
    throw new Error(`Unknown verb pack: ${id}`);
  }

  const response = await fetch(meta.path);

  if (!response.ok) {
    throw new Error(`Failed to load verb pack: ${meta.title}`);
  }

  const data = (await response.json()) as RawVerbPack;

  try {
    return normalizeVerbPack(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : `Unexpected verb pack format for ${meta.title}`;
    throw new Error(message);
  }
}

export function getVerbPackMeta(id: string): VerbPackMeta | undefined {
  return AVAILABLE_VERBPACKS.find((pack) => pack.id === id);
}
