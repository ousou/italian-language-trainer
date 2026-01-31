import type { AnswerSpec, VerbItem, VerbPack, VerbPerson } from '../types.ts';
import { isAnswerAlmostSpec, isAnswerCorrectSpec, isAnswerAccentIssueSpec } from './answerCheck.ts';

export type VerbStepResult = 'correct-first' | 'correct-second' | 'revealed';

export type VerbStepFeedback = 'correct' | 'almost' | 'retry' | 'revealed';

export interface VerbAnswerStep {
  attempts: string[];
  result?: VerbStepResult;
  accentIssue?: boolean;
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
  infinitive: VerbAnswerStep;
  persons: VerbAnswerStep[];
  infinitiveInput: string;
  personInputs: string[];
  infinitiveFeedback?: VerbStepFeedback;
  personFeedback: Array<VerbStepFeedback | undefined>;
  sessionCorrect: number;
  sessionIncorrect: number;
  incorrectItems: VerbIncorrectEntry[];
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
    infinitive: { attempts: [] },
    persons: VERB_PERSONS.map(() => ({ attempts: [] })),
    infinitiveInput: '',
    personInputs: VERB_PERSONS.map(() => ''),
    infinitiveFeedback: undefined,
    personFeedback: VERB_PERSONS.map(() => undefined),
    sessionCorrect: 0,
    sessionIncorrect: 0,
    incorrectItems: [],
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
  const almost = !correct && isAnswerAlmostSpec(item.src, answer) && attempts.length === 1;
  const accentIssue = correct ? isAnswerAccentIssueSpec(item.src, answer) : false;
  const next: VerbSessionState = {
    ...state,
    infinitive: {
      attempts,
      result: state.infinitive.result,
      accentIssue
    },
    infinitiveInput: answer,
    infinitiveFeedback: state.infinitiveFeedback
  };

  if (correct) {
    next.infinitive.result = attempts.length === 1 ? 'correct-first' : 'correct-second';
    next.infinitiveFeedback = 'correct';
    next.phase = 'conjugation';
    return next;
  }

  if (!almost) {
    next.infinitive.result = 'revealed';
    next.infinitiveFeedback = 'revealed';
    next.phase = 'conjugation';
    return next;
  }

  next.infinitiveFeedback = 'almost';
  return next;
}

export function submitConjugationAnswer(
  pack: VerbPack,
  state: VerbSessionState,
  person: VerbPerson,
  answer: string
): VerbSessionState {
  if (state.sessionComplete || state.phase !== 'conjugation') {
    return state;
  }

  const personIndex = VERB_PERSONS.indexOf(person);
  if (personIndex < 0) {
    return state;
  }

  const step = state.persons[personIndex];
  if (!step || step.result) {
    return state;
  }

  const item = getCurrentItem(pack, state);
  if (!item) {
    return state;
  }

  const expected = item.conjugations.present[person];
  const attempts = [...step.attempts, answer];
  const correct = isAnswerCorrectSpec(expected, answer);
  const almost = !correct && isAnswerAlmostSpec(expected, answer) && attempts.length === 1;
  const accentIssue = correct ? isAnswerAccentIssueSpec(expected, answer) : false;

  const nextPersons = [...state.persons];
  const updatedStep: VerbAnswerStep = {
    attempts,
    result: step.result,
    accentIssue
  };

  const nextPersonInputs = [...state.personInputs];
  nextPersonInputs[personIndex] = answer;

  const nextPersonFeedback = [...state.personFeedback];

  const next: VerbSessionState = {
    ...state,
    persons: nextPersons,
    personInputs: nextPersonInputs,
    personFeedback: nextPersonFeedback
  };

  if (correct) {
    updatedStep.result = attempts.length === 1 ? 'correct-first' : 'correct-second';
    nextPersonFeedback[personIndex] = 'correct';
    nextPersons[personIndex] = updatedStep;
    return finalizeIfComplete(pack, next);
  }

  if (!almost) {
    updatedStep.result = 'revealed';
    nextPersonFeedback[personIndex] = 'revealed';
    nextPersons[personIndex] = updatedStep;
    return finalizeIfComplete(pack, next);
  }

  nextPersonFeedback[personIndex] = 'almost';
  nextPersons[personIndex] = updatedStep;
  return next;
}

export function nextVerbStep(state: VerbSessionState): VerbSessionState {
  if (state.sessionComplete) {
    return state;
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

export function forceCompleteVerb(pack: VerbPack, state: VerbSessionState): VerbSessionState {
  if (state.sessionComplete || state.phase === 'recap') {
    return state;
  }

  const nextInfinitive =
    state.infinitive.result
      ? state.infinitive
      : {
          ...state.infinitive,
          result: 'revealed' as const
        };

  const nextPersons = state.persons.map((step) =>
    step.result
      ? step
      : {
          ...step,
          result: 'revealed' as const
        }
  );

  const next: VerbSessionState = {
    ...state,
    infinitive: nextInfinitive,
    persons: nextPersons,
    infinitiveFeedback: state.infinitive.result ? state.infinitiveFeedback : 'revealed',
    personFeedback: nextPersons.map((step, index) =>
      step.result && state.persons[index]?.result ? state.personFeedback[index] : 'revealed'
    )
  };

  return finalizeVerb(pack, next);
}

function startNextVerb(state: VerbSessionState): VerbSessionState {
  return {
    ...state,
    currentIndex: state.currentIndex + 1,
    phase: 'infinitive',
    infinitive: { attempts: [] },
    persons: VERB_PERSONS.map(() => ({ attempts: [] })),
    infinitiveInput: '',
    personInputs: VERB_PERSONS.map(() => ''),
    infinitiveFeedback: undefined,
    personFeedback: VERB_PERSONS.map(() => undefined),
    lastScore: undefined,
    sessionComplete: false
  };
}

function finalizeIfComplete(pack: VerbPack, state: VerbSessionState): VerbSessionState {
  if (state.persons.every((step) => step.result)) {
    return finalizeVerb(pack, state);
  }
  return state;
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
    infinitiveFeedback: undefined,
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
