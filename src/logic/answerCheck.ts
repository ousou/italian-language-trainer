import type { AnswerSpec } from '../types.ts';

export function normalizeAnswer(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/['’‘`´]/g, ' ')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function isAnswerCorrect(expected: string, actual: string): boolean {
  return normalizeAnswer(expected) === normalizeAnswer(actual);
}

export function isAnswerCorrectSpec(expected: AnswerSpec, actual: string): boolean {
  if (Array.isArray(expected)) {
    return expected.some((option) => isAnswerCorrect(option, actual));
  }
  return isAnswerCorrect(expected, actual);
}
