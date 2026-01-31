import { describe, expect, it } from 'vitest';
import { damerauLevenshteinDistance, isAnswerAlmost, isAnswerCorrect, normalizeAnswer } from '../src/logic/answerCheck.ts';

describe('normalizeAnswer', () => {
  it('trims and collapses whitespace', () => {
    expect(normalizeAnswer('  Buon   giorno  ')).toBe('buon giorno');
  });

  it('removes diacritics', () => {
    expect(normalizeAnswer('Città')).toBe('citta');
    expect(normalizeAnswer('perché')).toBe('perche');
  });

  it('strips punctuation', () => {
    expect(normalizeAnswer('Ciao! Come va?')).toBe('ciao come va');
  });

  it('treats apostrophes as ignorable punctuation', () => {
    expect(normalizeAnswer("Prendi l'autobus?")).toBe('prendi l autobus');
    expect(normalizeAnswer('Prendi l’autobus?')).toBe('prendi l autobus');
  });
});

describe('isAnswerCorrect', () => {
  it('accepts answers regardless of case', () => {
    expect(isAnswerCorrect('Ciao', 'ciao')).toBe(true);
  });

  it('accepts answers without accents', () => {
    expect(isAnswerCorrect('Città', 'citta')).toBe(true);
  });

  it('returns false for different answers', () => {
    expect(isAnswerCorrect('grazie', 'prego')).toBe(false);
  });
});

describe('damerauLevenshteinDistance', () => {
  it('returns 1 for a single substitution', () => {
    expect(damerauLevenshteinDistance('ciao', 'cibo')).toBe(1);
  });

  it('returns 1 for a transposition', () => {
    expect(damerauLevenshteinDistance('ciao', 'ciao')).toBe(0);
    expect(damerauLevenshteinDistance('ciao', 'caio')).toBe(1);
  });
});

describe('isAnswerAlmost', () => {
  it('matches answers that are one edit away after normalization', () => {
    expect(isAnswerAlmost('Città', 'citta')).toBe(false);
    expect(isAnswerAlmost('Città', 'citt')).toBe(true);
  });
});
