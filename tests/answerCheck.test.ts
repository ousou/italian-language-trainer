import { describe, expect, it } from 'vitest';
import { isAnswerCorrect, normalizeAnswer } from '../src/logic/answerCheck.ts';

describe('normalizeAnswer', () => {
  it('trims and collapses whitespace', () => {
    expect(normalizeAnswer('  Buon   giorno  ')).toBe('buon giorno');
  });

  it('removes diacritics', () => {
    expect(normalizeAnswer('Città')).toBe('citta');
    expect(normalizeAnswer('perché')).toBe('perche');
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
