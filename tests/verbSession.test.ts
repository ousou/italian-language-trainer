import { describe, expect, it } from 'vitest';
import type { VerbPack } from '../src/types.ts';
import {
  createVerbSession,
  nextVerbStep,
  redoIncorrect,
  submitConjugationAnswer,
  submitInfinitiveAnswer,
  VERB_PERSONS
} from '../src/logic/verbSession.ts';

const SAMPLE_PACK: VerbPack = {
  type: 'verbs',
  id: 'verb-sample',
  title: 'Verb Sample',
  src: 'it',
  dst: 'fi',
  items: [
    {
      id: 'essere',
      src: ['essere', 'esser'],
      dst: 'olla',
      conjugations: {
        present: {
          io: ['sono', 'io sono'],
          tu: 'sei',
          luiLei: 'è',
          noi: 'siamo',
          voi: 'siete',
          loro: 'sono'
        }
      }
    }
  ]
};

describe('verb session flow', () => {
  it('allows two infinitive attempts and reveals after the second miss', () => {
    const session = createVerbSession(SAMPLE_PACK, [0]);
    const first = submitInfinitiveAnswer(SAMPLE_PACK, session, 'fare');
    expect(first.infinitive.result).toBeUndefined();
    expect(first.infinitiveFeedback).toBe('retry');

    const second = submitInfinitiveAnswer(SAMPLE_PACK, first, 'avere');
    expect(second.infinitive.result).toBe('revealed');
    expect(second.infinitiveFeedback).toBe('revealed');
    expect(second.phase).toBe('conjugation');
  });

  it('accepts answer variants for infinitive and conjugations', () => {
    let session = createVerbSession(SAMPLE_PACK, [0]);
    session = submitInfinitiveAnswer(SAMPLE_PACK, session, 'esser');
    expect(session.infinitive.result).toBe('correct-first');
    expect(session.phase).toBe('conjugation');

    session = submitConjugationAnswer(SAMPLE_PACK, session, 'io', 'io sono');
    expect(session.persons[0].result).toBe('correct-first');
  });

  it('computes partial credit, marks incorrect verbs, and supports redo', () => {
    let session = createVerbSession(SAMPLE_PACK, [0]);
    session = submitInfinitiveAnswer(SAMPLE_PACK, session, 'essere');
    expect(session.phase).toBe('conjugation');

    session = submitConjugationAnswer(SAMPLE_PACK, session, 'io', 'x');
    session = submitConjugationAnswer(SAMPLE_PACK, session, 'io', 'sono');

    for (let index = 1; index < VERB_PERSONS.length; index += 1) {
      const person = VERB_PERSONS[index];
      session = submitConjugationAnswer(SAMPLE_PACK, session, person, 'x');
      session = submitConjugationAnswer(SAMPLE_PACK, session, person, 'y');
    }

    expect(session.phase).toBe('recap');
    expect(session.lastScore?.points).toBe(1.5);
    expect(session.lastScore?.quality).toBe(1);
    expect(session.sessionCorrect).toBe(0);
    expect(session.sessionIncorrect).toBe(1);
    expect(session.incorrectItems).toHaveLength(1);

    const redo = redoIncorrect(SAMPLE_PACK, session);
    expect(redo.order).toEqual([0]);
    expect(redo.sessionCorrect).toBe(0);
  });
});
