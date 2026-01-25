export type LanguageCode = 'it' | 'fi' | 'sv';

export type UILanguage = Extract<LanguageCode, 'fi' | 'sv'>;

export type DrillDirection = 'src-to-dst' | 'dst-to-src';

export type AnswerSpec = string | string[];

export interface VocabExample {
  src: string;
  dst?: string;
}

export interface VocabItem {
  id: string;
  src: string;
  dst: string;
  ipa?: string;
  examples?: VocabExample[];
}

export interface VocabPack {
  type: 'vocab';
  id: string;
  title: string;
  src: LanguageCode;
  dst: LanguageCode;
  items: VocabItem[];
}

export type VerbPerson = 'io' | 'tu' | 'luiLei' | 'noi' | 'voi' | 'loro';

export type VerbConjugationTable = Record<VerbPerson, AnswerSpec>;

export interface VerbItem {
  id: string;
  src: AnswerSpec;
  dst: string;
  conjugations: {
    present: VerbConjugationTable;
  };
}

export interface VerbPack {
  type: 'verbs';
  id: string;
  title: string;
  src: LanguageCode;
  dst: LanguageCode;
  items: VerbItem[];
}
