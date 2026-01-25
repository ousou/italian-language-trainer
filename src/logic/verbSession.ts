import type { AnswerSpec, VerbItem, VerbPack, VerbPerson } from '../types.ts';
import { isAnswerCorrectSpec } from './answerCheck.ts';

export type VerbStepResult = 'correct-first' | 'correct-second' | 'revealed';

export type VerbStepFeedback = 'correct' | 'retry' | 'revealed';

export interface VerbAnswerStep {
  attempts: string[];
  result?: VerbStepResult;
}

export interface VerbPersonResult extends VerbAnswerStep {
  person: VerbPerson;
  expected: string;
}

export interface VerbIncorrectEntry {
  key: string;
  itemIndex: number;
  prompt: string;
  infinitiveExpected: string;
  infinitiveAttempts: string[];
  infinitiveResult?: VerbStepResult;
  personResults: VerbPersonResult[];
  points: number;
  maxPoints: number;
  quality: number;
}

export interface VerbScoreSummary {
  points: number;
  maxPoints: number;
  quality: number;
  correct: boolean;
}

export interface VerbSessionState {
  packId: string;
  order: number[];
  currentIndex: number;
  phase: 'infinitive' | 'conjugation' | 'recap';
  currentPersonIndex: number;
  infinitive: VerbAnswerStep;
  persons: VerbAnswerStep[];
  sessionCorrect: number;
  sessionIncorrect: number;
  incorrectItems: VerbIncorrectEntry[];
  lastFeedback?: VerbStepFeedback;
  answerInput: string;
  sessionComplete: boolean;
  lastScore?: VerbScoreSummary;
}

export const VERB_PERSONS: VerbPerson[] = ['io', 'tu', 'luiLei', 'noi', 'voi', 'loro'];

export function createVerbSession(pack: VerbPack, order: number[]): VerbSessionState {
  return {
    packId: pack.id,
    order,
    currentIndex: 0,
    phase: 'infinitive',
    currentPersonIndex: 0,
    infinitive: { attempts: [] },
    persons: VERB_PERSONS.map(() => ({ attempts: [] })),
    sessionCorrect: 0,
    sessionIncorrect: 0,
    incorrectItems: [],
    lastFeedback: undefined,
    answerInput: '',
    sessionComplete: false,
    lastScore: undefined
  };
}

export function resetVerbSession(pack: VerbPack, order: number[]): VerbSessionState {
  return createVerbSession(pack, order);
}

export function submitInfinitiveAnswer(pack: VerbPack, state: VerbSessionState, answer: string): VerbSessionState {
  if (state.sessionComplete || state.phase !== 'infinitive') {
    return state;
  }
  if (state.infinitive.result) {
    return state;
  }

  const item = getCurrentItem(pack, state);
  if (!item) {
    return state;
  }

  const attempts = [...state.infinitive.attempts, answer];
  const correct = isAnswerCorrectSpec(item.src, answer);
  const next: VerbSessionState = {
    ...state,
    infinitive: {
      attempts,
      result: state.infinitive.result
    },
    answerInput: answer
  };

  if (correct) {
    next.infinitive.result = attempts.length === 1 ? 'correct-first' : 'correct-second';
    next.lastFeedback = 'correct';
    return next;
  }

  if (attempts.length >= 2) {
    next.infinitive.result = 'revealed';
    next.lastFeedback = 'revealed';
    return next;
  }

  next.lastFeedback = 'retry';
  return next;
}

export function submitConjugationAnswer(pack: VerbPack, state: VerbSessionState, answer: string): VerbSessionState {
  if (state.sessionComplete || state.phase !== 'conjugation') {
    return state;
  }

  const step = state.persons[state.currentPersonIndex];
  if (!step || step.result) {
    return state;
  }

  const item = getCurrentItem(pack, state);
  if (!item) {
    return state;
  }

  const person = VERB_PERSONS[state.currentPersonIndex];
  const expected = item.conjugations.present[person];
  const attempts = [...step.attempts, answer];
  const correct = isAnswerCorrectSpec(expected, answer);

  const nextPersons = [...state.persons];
  const updatedStep: VerbAnswerStep = {
    attempts,
    result: step.result
  };

  const next: VerbSessionState = {
    ...state,
    persons: nextPersons,
    answerInput: answer
  };

  if (correct) {
    updatedStep.result = attempts.length === 1 ? 'correct-first' : 'correct-second';
    next.lastFeedback = 'correct';
    nextPersons[state.currentPersonIndex] = updatedStep;
    return next;
  }

  if (attempts.length >= 2) {
    updatedStep.result = 'revealed';
    next.lastFeedback = 'revealed';
    nextPersons[state.currentPersonIndex] = updatedStep;
    return next;
  }

  next.lastFeedback = 'retry';
  nextPersons[state.currentPersonIndex] = updatedStep;
  return next;
}

export function nextVerbStep(pack: VerbPack, state: VerbSessionState): VerbSessionState {
  if (state.sessionComplete) {
    return state;
  }

  if (state.phase === 'infinitive') {
    if (!state.infinitive.result) {
      return state;
    }
    return {
      ...state,
      phase: 'conjugation',
      currentPersonIndex: 0,
      lastFeedback: undefined,
      answerInput: '',
      lastScore: undefined
    };
  }

  if (state.phase === 'conjugation') {
    const step = state.persons[state.currentPersonIndex];
    if (!step || !step.result) {
      return state;
    }
    if (state.currentPersonIndex < VERB_PERSONS.length - 1) {
      return {
        ...state,
        currentPersonIndex: state.currentPersonIndex + 1,
        lastFeedback: undefined,
        answerInput: ''
      };
    }
    return finalizeVerb(pack, state);
  }

  if (state.phase === 'recap') {
    if (state.currentIndex >= state.order.length - 1) {
      return {
        ...state,
        sessionComplete: true
      };
    }
    return startNextVerb(state);
  }

  return state;
}

export function redoIncorrect(pack: VerbPack, state: VerbSessionState): VerbSessionState {
  if (state.incorrectItems.length === 0) {
    return state;
  }
  const order = state.incorrectItems.map((item) => item.itemIndex);
  return createVerbSession(pack, order);
}

function startNextVerb(state: VerbSessionState): VerbSessionState {
  return {
    ...state,
    currentIndex: state.currentIndex + 1,
    phase: 'infinitive',
    currentPersonIndex: 0,
    infinitive: { attempts: [] },
    persons: VERB_PERSONS.map(() => ({ attempts: [] })),
    lastFeedback: undefined,
    answerInput: '',
    lastScore: undefined
  };
}

function finalizeVerb(pack: VerbPack, state: VerbSessionState): VerbSessionState {
  const item = getCurrentItem(pack, state);
  if (!item) {
    return state;
  }

  const summary = buildScoreSummary(state);
  const updated: VerbSessionState = {
    ...state,
    phase: 'recap',
    lastFeedback: undefined,
    answerInput: '',
    lastScore: summary,
    sessionCorrect: state.sessionCorrect + (summary.correct ? 1 : 0),
    sessionIncorrect: state.sessionIncorrect + (summary.correct ? 0 : 1)
  };

  if (!summary.correct) {
    const entry = buildIncorrectEntry(item, state, summary);
    const existingIndex = updated.incorrectItems.findIndex((existing) => existing.key === entry.key);
    if (existingIndex >= 0) {
      const nextIncorrect = [...updated.incorrectItems];
      nextIncorrect[existingIndex] = entry;
      updated.incorrectItems = nextIncorrect;
    } else {
      updated.incorrectItems = [...updated.incorrectItems, entry];
    }
  }

  return updated;
}

function buildScoreSummary(state: VerbSessionState): VerbScoreSummary {
  const points = [state.infinitive.result, ...state.persons.map((step) => step.result)]
    .map(pointsForResult)
    .reduce((total, value) => total + value, 0);
  const maxPoints = 7;
  const ratio = maxPoints > 0 ? points / maxPoints : 0;
  const quality = Math.round(ratio * 5);
  return {
    points,
    maxPoints,
    quality,
    correct: quality >= 3
  };
}

function pointsForResult(result?: VerbStepResult): number {
  if (result === 'correct-first') {
    return 1;
  }
  if (result === 'correct-second') {
    return 0.5;
  }
  return 0;
}

function buildIncorrectEntry(
  item: VerbItem,
  state: VerbSessionState,
  summary: VerbScoreSummary
): VerbIncorrectEntry {
  return {
    key: `${item.id}:verbs`,
    itemIndex: state.order[state.currentIndex],
    prompt: item.dst,
    infinitiveExpected: displayAnswer(item.src),
    infinitiveAttempts: [...state.infinitive.attempts],
    infinitiveResult: state.infinitive.result,
    personResults: VERB_PERSONS.map((person, index) => ({
      person,
      expected: displayAnswer(item.conjugations.present[person]),
      attempts: [...state.persons[index].attempts],
      result: state.persons[index].result
    })),
    points: summary.points,
    maxPoints: summary.maxPoints,
    quality: summary.quality
  };
}

function displayAnswer(answer: AnswerSpec): string {
  if (Array.isArray(answer)) {
    return answer[0] ?? '';
  }
  return answer;
}

function getCurrentItem(pack: VerbPack, state: VerbSessionState): VerbItem | undefined {
  const itemIndex = state.order[state.currentIndex];
  return pack.items[itemIndex];
}
