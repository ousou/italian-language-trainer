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

export function normalizeAnswerWithAccents(value: string): string {
  return value
    .normalize('NFC')
    .toLowerCase()
    .replace(/['’‘`´]/g, ' ')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
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

export function isAnswerAccentIssue(expected: string, actual: string): boolean {
  if (!isAnswerCorrect(expected, actual)) {
    return false;
  }
  return normalizeAnswerWithAccents(expected) !== normalizeAnswerWithAccents(actual);
}

export function isAnswerAccentIssueSpec(expected: AnswerSpec, actual: string): boolean {
  if (!isAnswerCorrectSpec(expected, actual)) {
    return false;
  }
  if (Array.isArray(expected)) {
    const normalizedActual = normalizeAnswerWithAccents(actual);
    return !expected.some(
      (option) => normalizeAnswerWithAccents(option) === normalizedActual
    );
  }
  return isAnswerAccentIssue(expected, actual);
}

export function damerauLevenshteinDistance(a: string, b: string): number {
  if (a === b) {
    return 0;
  }
  const aLength = a.length;
  const bLength = b.length;
  if (aLength === 0) {
    return bLength;
  }
  if (bLength === 0) {
    return aLength;
  }

  const matrix: number[][] = Array.from({ length: aLength + 1 }, () => Array(bLength + 1).fill(0));
  for (let i = 0; i <= aLength; i += 1) {
    matrix[i][0] = i;
  }
  for (let j = 0; j <= bLength; j += 1) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= aLength; i += 1) {
    for (let j = 1; j <= bLength; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let value = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        value = Math.min(value, matrix[i - 2][j - 2] + 1);
      }
      matrix[i][j] = value;
    }
  }

  return matrix[aLength][bLength];
}

export function isAnswerAlmost(expected: string, actual: string): boolean {
  const normalizedExpected = normalizeAnswer(expected);
  const normalizedActual = normalizeAnswer(actual);
  if (normalizedExpected === normalizedActual) {
    return false;
  }
  return damerauLevenshteinDistance(normalizedExpected, normalizedActual) === 1;
}

export function isAnswerAlmostSpec(expected: AnswerSpec, actual: string): boolean {
  if (Array.isArray(expected)) {
    return expected.some((option) => isAnswerAlmost(option, actual));
  }
  return isAnswerAlmost(expected, actual);
}
