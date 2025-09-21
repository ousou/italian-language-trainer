import type { UILanguage, VocabPack } from '../types.ts';

const italianFinnish: VocabPack = {
  type: 'vocab',
  id: 'core-it-fi-demo',
  title: 'Perus-sanasto — Italian⇄Finnish',
  src: 'it',
  dst: 'fi',
  items: [
    {
      id: 'ciao',
      src: 'ciao',
      dst: 'moi',
      ipa: 'ˈtʃa.o',
      examples: [
        { src: 'Ciao! Piacere di conoscerti.', dst: 'Moi! Hauska tutustua.' }
      ]
    },
    {
      id: 'grazie',
      src: 'grazie',
      dst: 'kiitos',
      ipa: 'ˈɡrat.tsje',
      examples: [
        { src: 'Grazie per l\'aiuto.', dst: 'Kiitos avusta.' }
      ]
    },
    {
      id: 'acqua',
      src: 'acqua',
      dst: 'vesi',
      examples: [
        { src: 'Vorrei dell\'acqua naturale.', dst: 'Haluaisin tavallista vettä.' }
      ]
    }
  ]
};

const italianSwedish: VocabPack = {
  type: 'vocab',
  id: 'core-it-sv-demo',
  title: 'Basordförråd — Italian⇄Swedish',
  src: 'it',
  dst: 'sv',
  items: [
    {
      id: 'ciao',
      src: 'ciao',
      dst: 'hej',
      ipa: 'ˈtʃa.o',
      examples: [
        { src: 'Ciao, come stai?', dst: 'Hej, hur mår du?' }
      ]
    },
    {
      id: 'per-favore',
      src: 'per favore',
      dst: 'snälla',
      examples: [
        { src: 'Un caffè, per favore.', dst: 'En kaffe, snälla.' }
      ]
    },
    {
      id: 'dove',
      src: 'dove',
      dst: 'var',
      examples: [
        { src: 'Dove è il bagno?', dst: 'Var ligger toaletten?' }
      ]
    }
  ]
};

export const demoPacks: Record<UILanguage, VocabPack> = {
  fi: italianFinnish,
  sv: italianSwedish
};

export function packForUILanguage(lang: UILanguage): VocabPack {
  return demoPacks[lang];
}
