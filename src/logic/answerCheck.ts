export function normalizeAnswer(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function isAnswerCorrect(expected: string, actual: string): boolean {
  return normalizeAnswer(expected) === normalizeAnswer(actual);
}
