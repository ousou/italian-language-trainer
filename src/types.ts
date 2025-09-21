export type LanguageCode = 'it' | 'fi' | 'sv';

export type UILanguage = Extract<LanguageCode, 'fi' | 'sv'>;

export type DrillDirection = 'src-to-dst' | 'dst-to-src';

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
