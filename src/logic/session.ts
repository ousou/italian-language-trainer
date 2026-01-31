import type { DrillDirection, VocabPack } from '../types.ts';
import { isAnswerAlmost, isAnswerCorrect, isAnswerAccentIssue } from './answerCheck.ts';

export interface IncorrectEntry {
  key: string;
  itemIndex: number;
  prompt: string;
  expected: string;
  answer: string;
}

export interface SessionState {
  packId: string;
  direction: DrillDirection;
  order: number[];
  currentIndex: number;
  sessionCorrect: number;
  sessionIncorrect: number;
  incorrectItems: IncorrectEntry[];
  lastResult?: 'correct' | 'incorrect' | 'almost';
  lastAccentIssue?: boolean;
  attempts: string[];
  answerInput: string;
  sessionComplete: boolean;
}

export const DEFAULT_SESSION_SIZE = 20;

export function shuffleIndices(length: number, rng: () => number = Math.random): number[] {
  const indices = Array.from({ length }, (_, index) => index);

  for (let i = indices.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }

  return indices;
}

export function buildSessionOrder(
  totalItems: number,
  sessionSize: number = DEFAULT_SESSION_SIZE,
  rng: () => number = Math.random
): number[] {
  return shuffleIndices(totalItems, rng).slice(0, Math.min(sessionSize, totalItems));
}

export function createSession(pack: VocabPack, direction: DrillDirection, order: number[]): SessionState {
  return {
    packId: pack.id,
    direction,
    order,
    currentIndex: 0,
    sessionCorrect: 0,
    sessionIncorrect: 0,
    incorrectItems: [],
    lastResult: undefined,
    lastAccentIssue: undefined,
    attempts: [],
    answerInput: '',
    sessionComplete: false
  };
}

export function resetSession(pack: VocabPack, direction: DrillDirection, order: number[]): SessionState {
  return createSession(pack, direction, order);
}

export function submitAnswer(pack: VocabPack, state: SessionState, answer: string): SessionState {
  if (state.sessionComplete || state.lastResult === 'correct' || state.lastResult === 'incorrect') {
    return state;
  }

  const itemIndex = state.order[state.currentIndex];
  const item = pack.items[itemIndex];
  const promptText = state.direction === 'src-to-dst' ? item.src : item.dst;
  const answerText = state.direction === 'src-to-dst' ? item.dst : item.src;
  const attempts = [...state.attempts, answer];
  const correct = isAnswerCorrect(answerText, answer);
  const almost = !correct && isAnswerAlmost(answerText, answer) && attempts.length === 1;
  const result: SessionState['lastResult'] = correct ? 'correct' : almost ? 'almost' : 'incorrect';
  const accentIssue = correct ? isAnswerAccentIssue(answerText, answer) : false;

  const updated: SessionState = {
    ...state,
    lastResult: result,
    lastAccentIssue: accentIssue,
    attempts,
    answerInput: answer
  };

  if (correct) {
    updated.sessionCorrect += 1;
  } else if (!almost) {
    updated.sessionIncorrect += 1;
    const key = `${item.id}:${state.direction}`;
    const entry: IncorrectEntry = {
      key,
      itemIndex,
      prompt: promptText,
      expected: answerText,
      answer
    };
    const existingIndex = updated.incorrectItems.findIndex((existing) => existing.key === key);
    if (existingIndex >= 0) {
      const nextIncorrect = [...updated.incorrectItems];
      nextIncorrect[existingIndex] = entry;
      updated.incorrectItems = nextIncorrect;
    } else {
      updated.incorrectItems = [...updated.incorrectItems, entry];
    }
  }

  if (!almost && state.currentIndex === state.order.length - 1) {
    updated.sessionComplete = true;
  }

  return updated;
}

export function nextCard(state: SessionState): SessionState {
  if (
    state.sessionComplete ||
    (state.lastResult !== 'correct' && state.lastResult !== 'incorrect')
  ) {
    return state;
  }

  if (state.currentIndex >= state.order.length - 1) {
    return state;
  }

  return {
    ...state,
    currentIndex: state.currentIndex + 1,
    answerInput: '',
    lastResult: undefined,
    lastAccentIssue: undefined,
    attempts: []
  };
}

export function startNewSession(pack: VocabPack, direction: DrillDirection, rng: () => number = Math.random): SessionState {
  const order = buildSessionOrder(pack.items.length, DEFAULT_SESSION_SIZE, rng);
  return createSession(pack, direction, order);
}

export function redoIncorrect(pack: VocabPack, state: SessionState): SessionState {
  if (state.incorrectItems.length === 0) {
    return state;
  }

  const order = state.incorrectItems.map((item) => item.itemIndex);
  return createSession(pack, state.direction, order);
}
