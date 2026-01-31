import './style.css';
import type { AnswerSpec, DrillDirection, LanguageCode, VocabPack, VerbPack } from './types.ts';
import { AVAILABLE_PHRASEPACKS, fetchPhrasePack } from './data/phrasepacks.ts';
import { AVAILABLE_VERBPACKS, fetchVerbPack } from './data/verbpacks.ts';
import {
  listAllReviewCards,
  listAllReviewEvents,
  listReviewCardsByPack,
  listReviewCardsByPackAndDirection,
  listReviewEventsByPackSince,
  overwriteReviewHistory,
  recordReviewResult
} from './data/reviewStore.ts';
import type { ReviewCard } from './logic/review.ts';
import {
  buildDailyAttemptCounts,
  startOfLocalDay,
  type DailyAttemptCount,
  type ReviewEvent
} from './logic/reviewEvents.ts';
import {
  buildHistorySummary,
  buildPackSummaries,
  createHistoryExport,
  parseHistoryExport,
  type HistorySnapshot,
  type HistorySummary,
  type PackHistorySummary
} from './logic/history.ts';
import { buildSrsOrder } from './logic/srs.ts';
import {
  createVerbSession,
  forceCompleteVerb,
  nextVerbStep,
  redoIncorrect as redoIncorrectVerbs,
  submitConjugationAnswer,
  submitInfinitiveAnswer,
  VERB_PERSONS,
  type VerbStepResult,
  type VerbSessionState
} from './logic/verbSession.ts';
import {
  DEFAULT_SESSION_SIZE,
  createSession,
  nextCard,
  redoIncorrect,
  submitAnswer,
  type SessionState
} from './logic/session.ts';

interface AppState {
  view: 'practice' | 'history';
  mode: 'vocab' | 'verbs';
  packId?: string;
  pack?: VocabPack;
  verbPackId?: string;
  verbPack?: VerbPack;
  loading: boolean;
  error?: string;
  showIncorrect: boolean;
  showStats: boolean;
  session?: SessionState;
  verbSession?: VerbSessionState;
  direction: DrillDirection;
  reviewCards: ReviewCard[];
  dailyAttempts: DailyAttemptCount[];
  statsDays: number;
  showItemStats: boolean;
  reviewStatsLoading: boolean;
  historyPackId: string;
  historyCards: ReviewCard[];
  historyEvents: ReviewEvent[];
  historyDailyAttempts: DailyAttemptCount[];
  historyStatsDays: number;
  historySummary?: HistorySummary;
  historyPackSummaries: PackHistorySummary[];
  historyLoading: boolean;
  historyError?: string;
  historyMessage?: string;
  historyImport?: {
    snapshot: HistorySnapshot;
    summary: HistorySummary;
    fileName: string;
  };
}

const LANGUAGE_LABELS: Record<LanguageCode, string> = {
  it: 'Italian',
  fi: 'Finnish',
  sv: 'Swedish'
};

const MODE_LABELS: Record<AppState['mode'], string> = {
  vocab: 'Vocabulary',
  verbs: 'Verb conjugation'
};

const VERB_PERSON_LABELS: Record<typeof VERB_PERSONS[number], string> = {
  io: 'io',
  tu: 'tu',
  luiLei: 'lui/lei',
  noi: 'noi',
  voi: 'voi',
  loro: 'loro'
};

const state: AppState = {
  view: 'practice',
  mode: 'vocab',
  packId: undefined,
  pack: undefined,
  verbPackId: undefined,
  verbPack: undefined,
  loading: false,
  error: undefined,
  showIncorrect: false,
  showStats: false,
  session: undefined,
  verbSession: undefined,
  direction: 'dst-to-src',
  reviewCards: [],
  dailyAttempts: [],
  statsDays: 7,
  showItemStats: false,
  reviewStatsLoading: false,
  historyPackId: 'all',
  historyCards: [],
  historyEvents: [],
  historyDailyAttempts: [],
  historyStatsDays: 30,
  historySummary: undefined,
  historyPackSummaries: [],
  historyLoading: false,
  historyError: undefined,
  historyMessage: undefined,
  historyImport: undefined
};

let loadToken = 0;
let verbLoadToken = 0;
let statsToken = 0;
let sessionToken = 0;
let verbSessionToken = 0;
let historyToken = 0;
let globalKeyListenerAttached = false;

const rootElement = document.querySelector<HTMLDivElement>('#app');

if (!rootElement) {
  throw new Error('Root element #app not found');
}

const root = rootElement;

function attachGlobalKeyListener(): void {
  if (globalKeyListenerAttached) {
    return;
  }
  globalKeyListenerAttached = true;
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') {
      return;
    }
    if (state.mode !== 'vocab') {
      return;
    }
    const vocabReady =
      state.session &&
      (state.session.lastResult === 'correct' || state.session.lastResult === 'incorrect') &&
      !state.session.sessionComplete;
    if (!vocabReady) {
      return;
    }
    event.preventDefault();
    goToNext();
  });
}

function setState(partial: Partial<AppState>): void {
  Object.assign(state, partial);
  render();
}

function focusInputElement(input: HTMLInputElement | null): void {
  if (!input || input.readOnly) {
    return;
  }
  try {
    input.focus({ preventScroll: true });
  } catch {
    input.focus();
  }
}

function queueFocusInput(selector: string): void {
  requestAnimationFrame(() => {
    const input = root.querySelector<HTMLInputElement>(selector);
    focusInputElement(input);
  });
}

function setMode(mode: AppState['mode']): void {
  if (state.mode === mode) {
    return;
  }
  setState({
    mode,
    packId: undefined,
    pack: undefined,
    verbPackId: undefined,
    verbPack: undefined,
    session: undefined,
    verbSession: undefined,
    loading: false,
    error: undefined,
    showIncorrect: false,
    showStats: false,
    reviewCards: [],
    dailyAttempts: [],
    statsDays: 7,
    showItemStats: false,
    reviewStatsLoading: false
  });
}

function setView(view: AppState['view']): void {
  if (state.view === view) {
    return;
  }
  setState({ view, historyError: undefined, historyMessage: undefined, historyImport: undefined });
  if (view === 'history') {
    void refreshHistoryData();
  }
}

function formatAnswerSpec(value: AnswerSpec): string {
  if (Array.isArray(value)) {
    return value[0] ?? '';
  }
  return value;
}

function formatVerbStepResult(result?: VerbStepResult): string {
  if (result === 'correct-first') {
    return 'correct (1st try)';
  }
  if (result === 'correct-second') {
    return 'correct (2nd try)';
  }
  if (result === 'revealed') {
    return 'revealed';
  }
  return 'unanswered';
}

function formatDateLabel(timestamp?: number): string {
  if (typeof timestamp !== 'number') {
    return '—';
  }
  return new Date(timestamp).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

function buildPackLabelMap(): Map<string, string> {
  const map = new Map<string, string>();
  for (const pack of AVAILABLE_PHRASEPACKS) {
    map.set(pack.id, `${pack.title} (Vocab)`);
  }
  for (const pack of AVAILABLE_VERBPACKS) {
    map.set(pack.id, `${pack.title} (Verbs)`);
  }
  return map;
}

function buildHistoryDerived(
  cards: ReviewCard[],
  events: ReviewEvent[],
  packId: string,
  statsDays: number
): { summary: HistorySummary; dailyAttempts: DailyAttemptCount[]; packSummaries: PackHistorySummary[] } {
  const selectedEvents = packId === 'all' ? events : events.filter((event) => event.packId === packId);
  const selectedCards = packId === 'all' ? cards : cards.filter((card) => card.packId === packId);
  const summary = buildHistorySummary(selectedEvents, selectedCards);
  const dailyAttempts = buildDailyAttemptCounts(selectedEvents, Date.now(), statsDays);
  const packSummaries = buildPackSummaries(events);
  return { summary, dailyAttempts, packSummaries };
}

function isInfinitiveResolved(session: VerbSessionState): boolean {
  return Boolean(session.infinitive.result);
}

function startNewSession(): void {
  if (state.mode === 'vocab') {
    if (!state.pack) {
      return;
    }
    void startSrsSession(state.pack, state.direction);
    return;
  }
  if (!state.verbPack) {
    return;
  }
  void startVerbSession(state.verbPack);
}

function redoIncorrectSession(): void {
  if (state.mode === 'vocab') {
    if (!state.pack || !state.session) {
      return;
    }

    const session = redoIncorrect(state.pack, state.session);
    if (session === state.session) {
      return;
    }
    setState({ session, showIncorrect: false });
    return;
  }

  if (!state.verbPack || !state.verbSession) {
    return;
  }

  const session = redoIncorrectVerbs(state.verbPack, state.verbSession);
  if (session === state.verbSession) {
    return;
  }
  setState({ verbSession: session, showIncorrect: false });
}

async function selectPack(id: string | undefined): Promise<void> {
  if (!id) {
    setState({
      packId: undefined,
      pack: undefined,
      error: undefined,
      showIncorrect: false,
      showStats: false,
      session: undefined,
      reviewCards: [],
      dailyAttempts: [],
      statsDays: 7,
      showItemStats: false,
      reviewStatsLoading: false
    });
    return;
  }

  const currentToken = ++loadToken;

  setState({
    packId: id,
    loading: true,
    error: undefined
  });

  try {
    const pack = await fetchPhrasePack(id);

    if (currentToken !== loadToken) {
      return;
    }

    setState({
      pack,
      loading: false,
      showIncorrect: false,
      showStats: false,
      session: undefined
    });
    void refreshReviewStats(pack);
    void startSrsSession(pack, state.direction);
  } catch (error) {
    if (currentToken !== loadToken) {
      return;
    }

    const message = error instanceof Error ? error.message : 'Unknown error while loading the phrase pack.';
    setState({ loading: false, error: message });
  }
}

async function selectVerbPack(id: string | undefined): Promise<void> {
  if (!id) {
    setState({
      verbPackId: undefined,
      verbPack: undefined,
      error: undefined,
      showIncorrect: false,
      showStats: false,
      verbSession: undefined,
      reviewCards: [],
      dailyAttempts: [],
      statsDays: 7,
      showItemStats: false,
      reviewStatsLoading: false
    });
    return;
  }

  const currentToken = ++verbLoadToken;

  setState({
    verbPackId: id,
    loading: true,
    error: undefined
  });

  try {
    const pack = await fetchVerbPack(id);

    if (currentToken !== verbLoadToken) {
      return;
    }

    setState({
      verbPack: pack,
      loading: false,
      showIncorrect: false,
      showStats: false,
      verbSession: undefined
    });
    void refreshReviewStats(pack);
    void startVerbSession(pack);
  } catch (error) {
    if (currentToken !== verbLoadToken) {
      return;
    }

    const message = error instanceof Error ? error.message : 'Unknown error while loading the verb pack.';
    setState({ loading: false, error: message });
  }
}

function goToNext(): void {
  if (state.mode === 'vocab') {
    if (!state.pack || !state.session) {
      return;
    }

    const session = nextCard(state.session);
    if (session !== state.session) {
      setState({ session });
      queueFocusInput('.answer-input');
    }
    return;
  }

  if (!state.verbPack || !state.verbSession) {
    return;
  }

  const verbPack = state.verbPack;
  const previous = state.verbSession;
  const itemIndex = previous.order[previous.currentIndex];
  const item = verbPack.items[itemIndex];

  if (previous.phase !== 'recap') {
    const completed = forceCompleteVerb(verbPack, previous);
    if (completed !== previous && completed.lastScore) {
      void recordReviewResult(
        {
          packId: verbPack.id,
          itemId: item.id,
          direction: 'dst-to-src'
        },
        {
          correct: completed.lastScore.correct,
          quality: completed.lastScore.quality,
          now: Date.now()
        }
      )
        .then(() => refreshReviewStats(verbPack))
        .catch((error) => {
          console.warn('Failed to record verb review result', error);
        });
    }
    const advanced = nextVerbStep(completed);
    if (advanced !== previous) {
      setState({ verbSession: advanced });
      if (!advanced.sessionComplete) {
        queueFocusInput('.answer-input');
      }
    }
    return;
  }

  const nextSession = nextVerbStep(previous);
  if (nextSession !== previous) {
    setState({ verbSession: nextSession });
    if (!nextSession.sessionComplete) {
      queueFocusInput('.answer-input');
    }
  }
}

async function startSrsSession(pack: VocabPack, direction: DrillDirection): Promise<void> {
  const token = ++sessionToken;
  const cards = await listReviewCardsByPackAndDirection(pack.id, direction);
  if (token !== sessionToken) {
    return;
  }
  const order = buildSrsOrder(pack.items, direction, cards, {
    now: Date.now(),
    sessionSize: DEFAULT_SESSION_SIZE,
    maxNew: 15,
    maxReview: 120,
    rng: Math.random
  });
  const session = createSession(pack, direction, order);
  setState({ session, showIncorrect: false });
}

async function startVerbSession(pack: VerbPack): Promise<void> {
  const token = ++verbSessionToken;
  const direction: DrillDirection = 'dst-to-src';
  const cards = await listReviewCardsByPackAndDirection(pack.id, direction);
  if (token !== verbSessionToken) {
    return;
  }
  const order = buildSrsOrder(pack.items, direction, cards, {
    now: Date.now(),
    sessionSize: DEFAULT_SESSION_SIZE,
    maxNew: 15,
    maxReview: 120,
    rng: Math.random
  });
  const session = createVerbSession(pack, order);
  setState({ verbSession: session, showIncorrect: false });
}

function renderModeSelector(container: HTMLElement): void {
  const section = document.createElement('section');
  section.className = 'panel direction-toggle';

  const label = document.createElement('span');
  label.className = 'panel-label';
  label.textContent = 'Drill mode';
  section.append(label);

  for (const mode of Object.keys(MODE_LABELS) as AppState['mode'][]) {
    const option = document.createElement('label');
    option.className = 'direction-option';

    const input = document.createElement('input');
    input.type = 'radio';
    input.name = 'drill-mode';
    input.value = mode;
    input.checked = state.mode === mode;
    input.addEventListener('change', () => {
      setMode(mode);
    });

    const text = document.createElement('span');
    text.textContent = MODE_LABELS[mode];

    option.append(input, text);
    section.append(option);
  }

  container.append(section);
}

function renderPrimaryNav(container: HTMLElement): void {
  const nav = document.createElement('nav');
  nav.className = 'panel primary-nav';

  const label = document.createElement('span');
  label.className = 'panel-label';
  label.textContent = 'Navigate';

  const buttonRow = document.createElement('div');
  buttonRow.className = 'primary-nav-actions';

  const practiceButton = document.createElement('button');
  practiceButton.type = 'button';
  practiceButton.textContent = 'Practice';
  practiceButton.className = state.view === 'practice' ? 'primary is-active' : '';
  practiceButton.setAttribute('aria-pressed', String(state.view === 'practice'));
  practiceButton.addEventListener('click', () => setView('practice'));

  const historyButton = document.createElement('button');
  historyButton.type = 'button';
  historyButton.textContent = 'History';
  historyButton.className = state.view === 'history' ? 'primary is-active' : '';
  historyButton.setAttribute('aria-pressed', String(state.view === 'history'));
  historyButton.addEventListener('click', () => setView('history'));

  buttonRow.append(practiceButton, historyButton);
  nav.append(label, buttonRow);
  container.append(nav);
}

function renderPackSelector(container: HTMLElement): void {
  const section = document.createElement('section');
  section.className = 'panel pack-picker';

  const label = document.createElement('label');
  label.className = 'panel-label';
  const isVerbMode = state.mode === 'verbs';
  label.textContent = isVerbMode ? 'Choose a verb pack' : 'Choose a phrase pack';
  label.setAttribute('for', isVerbMode ? 'verb-pack-select' : 'pack-select');

  const select = document.createElement('select');
  select.id = isVerbMode ? 'verb-pack-select' : 'pack-select';
  select.className = 'panel-control';

  const defaultOption = document.createElement('option');
  defaultOption.value = '';
  defaultOption.textContent = isVerbMode ? '— Select a verb pack —' : '— Select a pack —';
  select.append(defaultOption);

  if (isVerbMode) {
    for (const pack of AVAILABLE_VERBPACKS) {
      const option = document.createElement('option');
      option.value = pack.id;
      option.textContent = pack.title;
      if (pack.id === state.verbPackId) {
        option.selected = true;
      }
      select.append(option);
    }
  } else {
    for (const pack of AVAILABLE_PHRASEPACKS) {
      const option = document.createElement('option');
      option.value = pack.id;
      option.textContent = pack.title;
      if (pack.id === state.packId) {
        option.selected = true;
      }
      select.append(option);
    }
  }

  select.addEventListener('change', (event) => {
    const target = event.target as HTMLSelectElement;
    if (isVerbMode) {
      void selectVerbPack(target.value || undefined);
    } else {
      void selectPack(target.value || undefined);
    }
  });

  section.append(label, select);
  container.append(section);
}

function renderDrillCard(container: HTMLElement, pack: VocabPack): void {
  const { session, direction } = state;

  if (!session) {
    return;
  }

  const { order, currentIndex, lastResult, answerInput, sessionComplete } = session;

  if (order.length === 0) {
    const emptyNotice = document.createElement('p');
    emptyNotice.className = 'empty-pack';
    emptyNotice.textContent = 'This phrase pack has no items.';
    container.append(emptyNotice);
    return;
  }

  const itemIndex = order[currentIndex];
  const item = pack.items[itemIndex];

  const promptText = direction === 'src-to-dst' ? item.src : item.dst;
  const answerText = direction === 'src-to-dst' ? item.dst : item.src;
  const promptLabel = direction === 'src-to-dst' ? pack.src : pack.dst;
  const answerLabel = direction === 'src-to-dst' ? pack.dst : pack.src;
  const showAnswer = lastResult === 'correct' || lastResult === 'incorrect';

  const card = document.createElement('section');
  card.className = sessionComplete ? 'drill-card session-complete-card' : 'drill-card';

  const meta = document.createElement('div');
  meta.className = 'drill-meta';
  meta.textContent = `Word ${currentIndex + 1} of ${order.length}`;

  const prompt = document.createElement('div');
  prompt.className = 'drill-prompt';

  const promptBadge = document.createElement('span');
  promptBadge.className = 'badge';
  promptBadge.textContent = LANGUAGE_LABELS[promptLabel] ?? promptLabel.toUpperCase();

  const promptTextNode = document.createElement('span');
  promptTextNode.className = 'prompt-text';
  promptTextNode.textContent = promptText;

  prompt.append(promptBadge, promptTextNode);

  const answer = document.createElement('div');
  answer.className = showAnswer ? 'drill-answer revealed' : 'drill-answer hidden';

  const answerBadge = document.createElement('span');
  answerBadge.className = 'badge';
  answerBadge.textContent = LANGUAGE_LABELS[answerLabel] ?? answerLabel.toUpperCase();

  const answerTextNode = document.createElement('span');
  answerTextNode.className = 'answer-text';
  answerTextNode.textContent = showAnswer ? answerText : 'Translation hidden';

  answer.append(answerBadge, answerTextNode);

  if (sessionComplete) {
    const endNotice = document.createElement('p');
    endNotice.className = 'session-end-notice';
    endNotice.textContent = 'Session complete — review your results below or start a new round.';
    answer.append(endNotice);
  }

  const form = document.createElement('form');
  form.className = 'answer-form';

  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'answer-input panel-control';
  input.placeholder = `Type the ${LANGUAGE_LABELS[answerLabel] ?? answerLabel.toUpperCase()} answer`;
  input.value = answerInput;
  input.autocomplete = 'off';
  input.spellcheck = false;
  input.readOnly = showAnswer || sessionComplete;

  const checkButton = document.createElement('button');
  checkButton.type = 'submit';
  checkButton.className = 'primary';
  checkButton.textContent = 'Check answer';
  checkButton.disabled = showAnswer || sessionComplete || answerInput.trim() === '';

  input.addEventListener('input', (event) => {
    const target = event.target as HTMLInputElement;
    if (!state.session) {
      return;
    }
    state.session.answerInput = target.value;
    const answered =
      state.session.lastResult === 'correct' ||
      state.session.lastResult === 'incorrect' ||
      state.session.sessionComplete;
    checkButton.disabled = answered || target.value.trim() === '';
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!state.session) {
      return;
    }
    if (state.session.lastResult === 'correct' || state.session.lastResult === 'incorrect') {
      goToNext();
      return;
    }
    const currentSession = state.session;
    const nextSession = submitAnswer(pack, currentSession, currentSession.answerInput);
    if (nextSession.lastResult === 'correct' || nextSession.lastResult === 'incorrect') {
      const itemIndex = currentSession.order[currentSession.currentIndex];
      const item = pack.items[itemIndex];
      void recordReviewResult(
        {
          packId: pack.id,
          itemId: item.id,
          direction: currentSession.direction
        },
        {
          correct: nextSession.lastResult === 'correct',
          now: Date.now()
        }
      )
        .then(() => refreshReviewStats(pack))
        .catch((error) => {
          console.warn('Failed to record review result', error);
        });
    }
    setState({ session: nextSession });
  });

  form.append(input, checkButton);

  const feedback = document.createElement('p');
  feedback.className = `answer-feedback ${lastResult ?? ''}`.trim();
  if (lastResult === 'correct') {
    feedback.textContent = 'Correct!';
  } else if (lastResult === 'almost') {
    feedback.textContent = 'Almost!';
  } else if (lastResult === 'incorrect') {
    feedback.textContent = 'Not quite. Review the correct translation above.';
  } else {
    feedback.textContent = ' ';
  }

  const controls = document.createElement('div');
  controls.className = 'drill-controls';

  const nextButton = document.createElement('button');
  nextButton.type = 'button';
  nextButton.textContent = 'Next word';
  nextButton.disabled = !showAnswer || sessionComplete;
  nextButton.addEventListener('click', () => {
    if (
      !state.session ||
      (state.session.lastResult !== 'correct' && state.session.lastResult !== 'incorrect')
    ) {
      return;
    }
    goToNext();
  });

  controls.append(nextButton);

  card.append(meta, prompt, answer, form, feedback, controls);
  container.append(card);

  if (
    !sessionComplete &&
    state.session &&
    (state.session.lastResult === undefined || state.session.lastResult === 'almost')
  ) {
    focusInputElement(input);
  }
}

function renderVerbDrillCard(container: HTMLElement, pack: VerbPack): void {
  const session = state.verbSession;

  if (!session) {
    return;
  }

  const { order, currentIndex, phase, sessionComplete } = session;

  if (order.length === 0) {
    const emptyNotice = document.createElement('p');
    emptyNotice.className = 'empty-pack';
    emptyNotice.textContent = 'This verb pack has no items.';
    container.append(emptyNotice);
    return;
  }

  const itemIndex = order[currentIndex];
  const item = pack.items[itemIndex];
  const infinitiveResolved = isInfinitiveResolved(session);
  const conjugationReady = phase === 'conjugation' || phase === 'recap';

  const card = document.createElement('section');
  card.className = sessionComplete ? 'drill-card session-complete-card' : 'drill-card';

  const meta = document.createElement('div');
  meta.className = 'drill-meta';
  meta.textContent = `Verb ${currentIndex + 1} of ${order.length}`;

  const prompt = document.createElement('div');
  prompt.className = 'drill-prompt';

  const promptBadge = document.createElement('span');
  promptBadge.className = 'badge';
  promptBadge.textContent = LANGUAGE_LABELS[pack.dst] ?? pack.dst.toUpperCase();

  const promptTextNode = document.createElement('span');
  promptTextNode.className = 'prompt-text';
  promptTextNode.textContent = item.dst;

  prompt.append(promptBadge, promptTextNode);

  const infinitive = document.createElement('div');
  infinitive.className = infinitiveResolved ? 'drill-answer revealed' : 'drill-answer hidden';

  const infinitiveBadge = document.createElement('span');
  infinitiveBadge.className = 'badge';
  infinitiveBadge.textContent = 'Infinitive';

  const infinitiveText = document.createElement('span');
  infinitiveText.className = 'answer-text';
  infinitiveText.textContent = infinitiveResolved ? formatAnswerSpec(item.src) : 'Infinitive hidden';

  infinitive.append(infinitiveBadge, infinitiveText);

  const infinitiveForm = document.createElement('form');
  infinitiveForm.className = 'answer-form';

  const infinitiveInput = document.createElement('input');
  infinitiveInput.type = 'text';
  infinitiveInput.className = 'answer-input panel-control';
  infinitiveInput.placeholder = 'Type the Italian infinitive';
  infinitiveInput.value = session.infinitiveInput;
  infinitiveInput.autocomplete = 'off';
  infinitiveInput.spellcheck = false;
  infinitiveInput.enterKeyHint = 'next';
  infinitiveInput.readOnly = infinitiveResolved || sessionComplete;

  const infinitiveButton = document.createElement('button');
  infinitiveButton.type = 'submit';
  infinitiveButton.className = 'primary';
  infinitiveButton.textContent = 'Check infinitive';
  infinitiveButton.disabled = infinitiveResolved || sessionComplete || session.infinitiveInput.trim() === '';

  infinitiveInput.addEventListener('input', (event) => {
    const target = event.target as HTMLInputElement;
    if (!state.verbSession) {
      return;
    }
    state.verbSession.infinitiveInput = target.value;
    infinitiveButton.disabled = isInfinitiveResolved(state.verbSession) || target.value.trim() === '';
  });

  infinitiveForm.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!state.verbSession) {
      return;
    }
    if (isInfinitiveResolved(state.verbSession)) {
      return;
    }
    const currentSession = state.verbSession;
    const nextSession = submitInfinitiveAnswer(pack, currentSession, currentSession.infinitiveInput);
    setState({ verbSession: nextSession });

    if (isInfinitiveResolved(nextSession)) {
      queueFocusInput(`.verb-row input[data-verb-person="${VERB_PERSONS[0]}"]`);
    } else {
      queueFocusInput('.answer-input');
    }
  });

  infinitiveForm.append(infinitiveInput, infinitiveButton);

  const infinitiveFeedback = document.createElement('p');
  infinitiveFeedback.className = 'answer-feedback';
  if (session.infinitiveFeedback === 'correct') {
    infinitiveFeedback.textContent =
      session.infinitive.result === 'correct-second' ? 'Correct (second try).' : 'Correct!';
    infinitiveFeedback.classList.add('correct');
  } else if (session.infinitiveFeedback === 'almost') {
    infinitiveFeedback.textContent = 'Almost!';
    infinitiveFeedback.classList.add('almost');
  } else if (session.infinitiveFeedback === 'retry') {
    infinitiveFeedback.textContent = 'Not quite. Try again.';
    infinitiveFeedback.classList.add('incorrect');
  } else if (session.infinitiveFeedback === 'revealed') {
    infinitiveFeedback.textContent = 'Correct answer shown above.';
    infinitiveFeedback.classList.add('incorrect');
  } else {
    infinitiveFeedback.textContent = ' ';
  }

  const conjugationPanel = document.createElement('div');
  conjugationPanel.className = 'verb-table';

  const tableHeading = document.createElement('span');
  tableHeading.className = 'panel-label';
  tableHeading.textContent = 'Present tense';
  conjugationPanel.append(tableHeading);

  function queueFocusVerbRow(nextIndex: number): void {
    const nextPerson = VERB_PERSONS[nextIndex];
    queueFocusInput(`.verb-row input[data-verb-person="${nextPerson}"]`);
  }

  function queueFocusNextUnresolvedRow(fromIndex: number, nextSession: VerbSessionState): void {
    const scan = (start: number, end: number): number | undefined => {
      for (let i = start; i < end; i += 1) {
        if (!nextSession.persons[i]?.result) {
          return i;
        }
      }
      return undefined;
    };

    const forward = scan(fromIndex + 1, VERB_PERSONS.length);
    const wrapped = forward ?? scan(0, fromIndex + 1);
    if (wrapped !== undefined) {
      queueFocusVerbRow(wrapped);
      return;
    }

    queueMicrotask(() => {
      const button = root.querySelector<HTMLButtonElement>('#verb-next-button');
      if (button && !button.disabled) {
        try {
          button.focus({ preventScroll: true });
        } catch {
          button.focus();
        }
      }
    });
  }

  VERB_PERSONS.forEach((person, index) => {
    const row = document.createElement('form');
    row.className = 'verb-row';

    const label = document.createElement('span');
    label.className = 'verb-cell verb-person';
    label.textContent = VERB_PERSON_LABELS[person];

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'verb-cell verb-input panel-control';
    input.dataset.verbPerson = person;
    input.placeholder = 'Type form';
    input.value = session.personInputs[index] ?? '';
    input.autocomplete = 'off';
    input.spellcheck = false;
    input.enterKeyHint = 'next';
    input.readOnly = sessionComplete || !conjugationReady || Boolean(session.persons[index].result);

    const expected = document.createElement('span');
    expected.className = 'verb-cell verb-expected';
    expected.textContent = session.persons[index].result ? formatAnswerSpec(item.conjugations.present[person]) : '—';

    const feedback = document.createElement('span');
    feedback.className = 'verb-cell verb-feedback';
    const rowFeedback = session.personFeedback[index];
    if (rowFeedback === 'correct') {
      feedback.textContent =
        session.persons[index].result === 'correct-second' ? 'Correct (2nd try)' : 'Correct';
      feedback.classList.add('correct');
    } else if (rowFeedback === 'almost') {
      feedback.textContent = 'Almost!';
      feedback.classList.add('almost');
    } else if (rowFeedback === 'retry') {
      feedback.textContent = 'Try again';
      feedback.classList.add('incorrect');
    } else if (rowFeedback === 'revealed') {
      feedback.textContent = 'Answer shown';
      feedback.classList.add('incorrect');
    } else {
      feedback.textContent = '';
    }

    const checkButton = document.createElement('button');
    checkButton.type = 'submit';
    checkButton.className = 'verb-cell';
    checkButton.textContent = 'Check';
    checkButton.disabled =
      sessionComplete ||
      !conjugationReady ||
      Boolean(session.persons[index].result) ||
      (session.personInputs[index] ?? '').trim() === '';

    input.addEventListener('input', (event) => {
      const target = event.target as HTMLInputElement;
      if (!state.verbSession) {
        return;
      }
      state.verbSession.personInputs[index] = target.value;
      checkButton.disabled =
        sessionComplete ||
        !conjugationReady ||
        Boolean(state.verbSession.persons[index].result) ||
        target.value.trim() === '';
    });

    row.addEventListener('submit', (event) => {
      event.preventDefault();
      if (!state.verbSession) {
        return;
      }
      if (sessionComplete || !conjugationReady || state.verbSession.persons[index].result) {
        return;
      }
      const currentSession = state.verbSession;
      const nextSession = submitConjugationAnswer(
        pack,
        currentSession,
        person,
        currentSession.personInputs[index] ?? ''
      );
      if (currentSession.phase !== 'recap' && nextSession.phase === 'recap' && nextSession.lastScore) {
        void recordReviewResult(
          {
            packId: pack.id,
            itemId: item.id,
            direction: 'dst-to-src'
          },
          {
            correct: nextSession.lastScore.correct,
            quality: nextSession.lastScore.quality,
            now: Date.now()
          }
        )
          .then(() => refreshReviewStats(pack))
          .catch((error) => {
            console.warn('Failed to record verb review result', error);
          });
      }
      setState({ verbSession: nextSession });

      const result = nextSession.persons[index]?.result;
      if (result) {
        queueFocusNextUnresolvedRow(index, nextSession);
      } else {
        queueFocusVerbRow(index);
      }
    });

    row.append(label, input, feedback, expected, checkButton);
    conjugationPanel.append(row);
  });

  const controls = document.createElement('div');
  controls.className = 'drill-controls';

  const nextButton = document.createElement('button');
  nextButton.id = 'verb-next-button';
  nextButton.type = 'button';
  nextButton.textContent = 'Next verb';
    nextButton.disabled = sessionComplete;
    nextButton.addEventListener('click', () => {
      if (!state.verbSession) {
        return;
      }
      goToNext();
    });

  controls.append(nextButton);

  card.append(meta, prompt, infinitive, infinitiveForm, infinitiveFeedback, conjugationPanel, controls);

  if (phase === 'recap') {
    const recap = document.createElement('div');
    recap.className = 'panel';

    const recapTitle = document.createElement('span');
    recapTitle.className = 'panel-label';
    recapTitle.textContent = 'Recap';

    const score = session.lastScore;
    const scoreText = document.createElement('p');
    scoreText.className = 'session-summary';
    if (score) {
      const conjugationCorrect = session.persons.filter(
        (step) => step.result === 'correct-first' || step.result === 'correct-second'
      ).length;
      const conjugationSecond = session.persons.filter((step) => step.result === 'correct-second').length;
      scoreText.textContent = `Conjugation: ${conjugationCorrect}/6 correct · ${conjugationSecond} on 2nd try · Total: ${score.points}/7 points`;
    } else {
      scoreText.textContent = 'Recap unavailable.';
    }

    recap.append(recapTitle, scoreText);

    const mistakes = session.persons
      .map((step, index) => ({
        person: VERB_PERSONS[index],
        result: step.result,
        attempts: step.attempts,
        expected: formatAnswerSpec(item.conjugations.present[VERB_PERSONS[index]])
      }))
      .filter((entry) => entry.result !== 'correct-first');

    if (session.infinitive.result !== 'correct-first') {
      const info = document.createElement('p');
      info.className = 'session-summary';
      info.textContent = `Infinitive: ${formatAnswerSpec(item.src)} (${session.infinitive.result ?? 'missed'})`;
      recap.append(info);
    }

    if (mistakes.length > 0) {
      const list = document.createElement('ul');
      list.className = 'incorrect-list';

      for (const entry of mistakes) {
        const listItem = document.createElement('li');
        listItem.className = 'incorrect-item';
        const attemptText = entry.attempts.length > 0 ? entry.attempts.join(' / ') : '—';
        listItem.textContent = `${VERB_PERSON_LABELS[entry.person]}: ${entry.expected} (you answered: ${attemptText})`;
        list.append(listItem);
      }
      recap.append(list);
    }

    card.append(recap);
  }

  container.append(card);
  if (!sessionComplete && state.verbSession && !isInfinitiveResolved(state.verbSession)) {
    focusInputElement(infinitiveInput);
  }
}

function renderSessionPanel(container: HTMLElement): void {
  const panel = document.createElement('section');
  panel.className = 'panel session-panel';

  if (!state.session) {
    return;
  }

  const heading = document.createElement('span');
  heading.className = 'panel-label';
  heading.textContent = 'Session stats';

  const summary = document.createElement('div');
  summary.className = 'session-summary';
  summary.textContent = `Correct: ${state.session.sessionCorrect} · Incorrect: ${state.session.sessionIncorrect}`;

  panel.append(heading, summary);

  const actions = document.createElement('div');
  actions.className = 'session-actions';

  if (state.session.sessionComplete) {
    const doneMessage = document.createElement('p');
    doneMessage.className = 'session-complete';
    doneMessage.textContent = 'Session complete! Want to try the misses again or start fresh?';
    panel.append(doneMessage);
  }

  const toggleButton = document.createElement('button');
  toggleButton.type = 'button';
  toggleButton.textContent = state.showIncorrect ? 'Hide incorrect words' : 'Show incorrect words';
  toggleButton.disabled = state.session.incorrectItems.length === 0;
  toggleButton.addEventListener('click', () => {
    setState({ showIncorrect: !state.showIncorrect });
  });

  const statsButton = document.createElement('button');
  statsButton.type = 'button';
  statsButton.textContent = state.showStats ? 'Hide progress stats' : 'Show progress stats';
  statsButton.addEventListener('click', () => {
    setState({ showStats: !state.showStats });
  });

  const redoButton = document.createElement('button');
  redoButton.type = 'button';
  redoButton.textContent = 'Redo incorrect';
  redoButton.disabled = state.session.incorrectItems.length === 0;
  redoButton.addEventListener('click', () => {
    redoIncorrectSession();
  });

  const newSessionButton = document.createElement('button');
  newSessionButton.type = 'button';
  newSessionButton.textContent = 'Start new session';
  newSessionButton.addEventListener('click', () => {
    startNewSession();
  });

  actions.append(toggleButton, statsButton);
  if (state.session.sessionComplete) {
    actions.append(redoButton, newSessionButton);
  } else {
    actions.append(newSessionButton);
  }

  panel.append(actions);

  if (state.showIncorrect && state.session.incorrectItems.length > 0) {
    const list = document.createElement('ul');
    list.className = 'incorrect-list';

    for (const item of state.session.incorrectItems) {
      const listItem = document.createElement('li');
      listItem.className = 'incorrect-item';
      listItem.textContent = `${item.prompt} → ${item.expected} (you answered: ${item.answer || '—'})`;
      list.append(listItem);
    }

    panel.append(list);
  }

  container.append(panel);
}

function renderVerbSessionPanel(container: HTMLElement): void {
  const panel = document.createElement('section');
  panel.className = 'panel session-panel';

  if (!state.verbSession) {
    return;
  }

  const heading = document.createElement('span');
  heading.className = 'panel-label';
  heading.textContent = 'Session stats';

  const summary = document.createElement('div');
  summary.className = 'session-summary';
  summary.textContent = `Correct: ${state.verbSession.sessionCorrect} · Incorrect: ${state.verbSession.sessionIncorrect}`;

  panel.append(heading, summary);

  const actions = document.createElement('div');
  actions.className = 'session-actions';

  if (state.verbSession.sessionComplete) {
    const doneMessage = document.createElement('p');
    doneMessage.className = 'session-complete';
    doneMessage.textContent = 'Session complete! Want to try the misses again or start fresh?';
    panel.append(doneMessage);
  }

  const toggleButton = document.createElement('button');
  toggleButton.type = 'button';
  toggleButton.textContent = state.showIncorrect ? 'Hide incorrect verbs' : 'Show incorrect verbs';
  toggleButton.disabled = state.verbSession.incorrectItems.length === 0;
  toggleButton.addEventListener('click', () => {
    setState({ showIncorrect: !state.showIncorrect });
  });

  const statsButton = document.createElement('button');
  statsButton.type = 'button';
  statsButton.textContent = state.showStats ? 'Hide progress stats' : 'Show progress stats';
  statsButton.addEventListener('click', () => {
    setState({ showStats: !state.showStats });
  });

  const redoButton = document.createElement('button');
  redoButton.type = 'button';
  redoButton.textContent = 'Redo incorrect';
  redoButton.disabled = state.verbSession.incorrectItems.length === 0;
  redoButton.addEventListener('click', () => {
    redoIncorrectSession();
  });

  const newSessionButton = document.createElement('button');
  newSessionButton.type = 'button';
  newSessionButton.textContent = 'Start new session';
  newSessionButton.addEventListener('click', () => {
    startNewSession();
  });

  actions.append(toggleButton, statsButton);
  if (state.verbSession.sessionComplete) {
    actions.append(redoButton, newSessionButton);
  } else {
    actions.append(newSessionButton);
  }

  panel.append(actions);

  if (state.showIncorrect && state.verbSession.incorrectItems.length > 0) {
    const list = document.createElement('ul');
    list.className = 'incorrect-list';

    for (const item of state.verbSession.incorrectItems) {
      const revealed = item.personResults
        .filter((entry) => entry.result === 'revealed')
        .map((entry) => `${VERB_PERSON_LABELS[entry.person]}=${entry.expected}`);
      const secondTry = item.personResults
        .filter((entry) => entry.result === 'correct-second')
        .map((entry) => `${VERB_PERSON_LABELS[entry.person]}=${entry.expected}`);

      const listItem = document.createElement('li');
      listItem.className = 'incorrect-item';
      const parts = [
        `${item.prompt} → ${item.infinitiveExpected}`,
        `score: ${item.points}/${item.maxPoints}`,
        `infinitive: ${formatVerbStepResult(item.infinitiveResult)}`
      ];
      if (revealed.length > 0) {
        parts.push(`revealed: ${revealed.join(', ')}`);
      }
      if (secondTry.length > 0) {
        parts.push(`2nd try: ${secondTry.join(', ')}`);
      }
      listItem.textContent = parts.join(' · ');
      list.append(listItem);
    }

    panel.append(list);
  }

  container.append(panel);
}

async function refreshReviewStats(pack: VocabPack | VerbPack): Promise<void> {
  const token = ++statsToken;
  setState({ reviewStatsLoading: true });
  try {
    const now = Date.now();
    const cards = await listReviewCardsByPack(pack.id);
    const statsDays = state.statsDays;
    const windowStart = startOfLocalDay(now);
    const since = new Date(windowStart);
    since.setDate(since.getDate() - (statsDays - 1));
    const events = await listReviewEventsByPackSince(pack.id, since.getTime());
    const dailyAttempts = buildDailyAttemptCounts(events, now, statsDays);
    if (token !== statsToken) {
      return;
    }
    setState({ reviewCards: cards, dailyAttempts, reviewStatsLoading: false });
  } catch (error) {
    if (token !== statsToken) {
      return;
    }
    console.warn('Failed to load review stats', error);
    setState({ reviewStatsLoading: false });
  }
}

async function refreshHistoryData(): Promise<void> {
  const token = ++historyToken;
  setState({ historyLoading: true, historyError: undefined });
  try {
    const [cards, events] = await Promise.all([listAllReviewCards(), listAllReviewEvents()]);
    if (token !== historyToken) {
      return;
    }
    const derived = buildHistoryDerived(cards, events, state.historyPackId, state.historyStatsDays);
    setState({
      historyCards: cards,
      historyEvents: events,
      historySummary: derived.summary,
      historyDailyAttempts: derived.dailyAttempts,
      historyPackSummaries: derived.packSummaries,
      historyLoading: false
    });
  } catch (error) {
    if (token !== historyToken) {
      return;
    }
    const message = error instanceof Error ? error.message : 'Unable to load history.';
    setState({ historyLoading: false, historyError: message });
  }
}

function applyHistoryFilters(nextPackId?: string, nextStatsDays?: number): void {
  const packId = nextPackId ?? state.historyPackId;
  const statsDays = nextStatsDays ?? state.historyStatsDays;
  const derived = buildHistoryDerived(state.historyCards, state.historyEvents, packId, statsDays);
  setState({
    historyPackId: packId,
    historyStatsDays: statsDays,
    historySummary: derived.summary,
    historyDailyAttempts: derived.dailyAttempts,
    historyPackSummaries: derived.packSummaries
  });
}

async function downloadHistoryFile(): Promise<void> {
  setState({ historyMessage: undefined, historyError: undefined });
  try {
    const [cards, events] = await Promise.all([listAllReviewCards(), listAllReviewEvents()]);
    const payload = createHistoryExport({ cards, events }, Date.now());
    const content = JSON.stringify(payload, null, 2);
    const filenameDate = formatFilenameDate(payload.createdAt);
    const filename = `italian-language-trainer-history-${filenameDate}.json`;
    triggerDownload(filename, content);
    setState({ historyMessage: 'History download ready.' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to download history.';
    setState({ historyError: message });
  }
}

async function handleHistoryUpload(file: File): Promise<void> {
  setState({ historyImport: undefined, historyMessage: undefined, historyError: undefined });
  try {
    const text = await file.text();
    const snapshot = parseHistoryExport(text);
    const summary = buildHistorySummary(snapshot.events, snapshot.cards);
    setState({
      historyImport: {
        snapshot,
        summary,
        fileName: file.name
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to read history file.';
    setState({ historyError: message });
  }
}

async function applyHistoryImport(): Promise<void> {
  if (!state.historyImport) {
    return;
  }
  setState({ historyLoading: true, historyError: undefined, historyMessage: undefined });
  try {
    await overwriteReviewHistory(state.historyImport.snapshot);
    const [cards, events] = await Promise.all([listAllReviewCards(), listAllReviewEvents()]);
    const derived = buildHistoryDerived(cards, events, state.historyPackId, state.historyStatsDays);
    setState({
      historyCards: cards,
      historyEvents: events,
      historySummary: derived.summary,
      historyDailyAttempts: derived.dailyAttempts,
      historyPackSummaries: derived.packSummaries,
      historyLoading: false,
      historyImport: undefined,
      historyMessage: 'History overwritten successfully.'
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to import history.';
    setState({ historyLoading: false, historyError: message });
  }
}

function triggerDownload(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function formatFilenameDate(timestamp: number): string {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function renderDailyAttemptsChart(
  container: HTMLElement,
  dailyAttempts: DailyAttemptCount[],
  headingText: string
): void {
  if (dailyAttempts.length === 0) {
    return;
  }

  const dailyHeading = document.createElement('p');
  dailyHeading.className = 'session-summary';
  dailyHeading.textContent = headingText;
  container.append(dailyHeading);

  const maxCount = Math.max(1, ...dailyAttempts.map((entry) => entry.count));
  const chartGrid = document.createElement('div');
  chartGrid.className = 'stats-chart-grid';

  const yAxis = document.createElement('div');
  yAxis.className = 'stats-y-axis';
  const yTop = document.createElement('span');
  yTop.textContent = `${maxCount}`;
  const yMid = document.createElement('span');
  yMid.textContent = `${Math.round(maxCount / 2)}`;
  const yBottom = document.createElement('span');
  yBottom.textContent = '0';
  yAxis.append(yTop, yMid, yBottom);

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  const width = 100;
  const height = 60;
  const paddingTop = 4;
  const paddingBottom = 6;
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.classList.add('stats-line-svg');

  const baseline = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  const baselineY = height - paddingBottom;
  baseline.setAttribute('x1', '0');
  baseline.setAttribute('x2', `${width}`);
  baseline.setAttribute('y1', `${baselineY}`);
  baseline.setAttribute('y2', `${baselineY}`);
  baseline.setAttribute('class', 'stats-line-axis');
  svg.append(baseline);

  const points: { x: number; y: number; title: string }[] = [];
  const usableHeight = height - paddingTop - paddingBottom;
  const count = dailyAttempts.length;
  const step = count > 0 ? width / count : 0;
  dailyAttempts.forEach((entry, index) => {
    const x = count > 0 ? step * (index + 0.5) : width / 2;
    const ratio = entry.count / maxCount;
    const y = paddingTop + (1 - ratio) * usableHeight;
    points.push({
      x,
      y,
      title: `${entry.dayKey}: ${entry.count} ${entry.count === 1 ? 'attempt' : 'attempts'}`
    });
  });

  if (points.length > 0) {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    const d = points
      .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
      .join(' ');
    path.setAttribute('d', d);
    path.setAttribute('class', 'stats-line-path');
    svg.append(path);

    for (const point of points) {
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', point.x.toFixed(2));
      circle.setAttribute('cy', point.y.toFixed(2));
      circle.setAttribute('r', '1.8');
      circle.setAttribute('class', 'stats-line-point');
      circle.appendChild(createSvgTitle(point.title));
      svg.append(circle);
    }
  }

  const chartCanvas = document.createElement('div');
  chartCanvas.className = 'stats-chart-canvas';
  chartCanvas.append(svg);

  chartGrid.append(yAxis, chartCanvas);
  container.append(chartGrid);

  const xAxis = document.createElement('div');
  xAxis.className = 'stats-x-axis';
  const spacer = document.createElement('span');
  spacer.className = 'stats-x-spacer';
  const labels = document.createElement('div');
  labels.className = 'stats-x-labels';
  labels.style.setProperty('--stats-days', String(dailyAttempts.length));
  for (const entry of dailyAttempts) {
    const label = document.createElement('span');
    label.className = 'stats-x-label';
    label.textContent = entry.dayKey;
    labels.append(label);
  }
  xAxis.append(spacer, labels);
  container.append(xAxis);
}

function renderStatsPanel(container: HTMLElement, pack: VocabPack | VerbPack): void {
  const panel = document.createElement('section');
  panel.className = 'panel stats-panel';

  const heading = document.createElement('span');
  heading.className = 'panel-label';
  heading.textContent = 'Progress stats';
  panel.append(heading);

  if (state.reviewStatsLoading) {
    const loading = document.createElement('p');
    loading.className = 'status loading';
    loading.textContent = 'Loading stats…';
    panel.append(loading);
    container.append(panel);
    return;
  }

  const cards = state.reviewCards.filter((card) => card.attempts > 0);
  if (cards.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'status hint';
    empty.textContent = 'No review stats yet. Answer a few prompts to see progress.';
    panel.append(empty);
    container.append(panel);
    return;
  }

  const totals = cards.reduce(
    (acc, card) => {
      acc.attempts += card.attempts;
      acc.correct += card.correct;
      acc.incorrect += card.incorrect;
      if (typeof card.dueAt === 'number' && card.dueAt <= Date.now()) {
        acc.due += 1;
      }
      return acc;
    },
    { attempts: 0, correct: 0, incorrect: 0, due: 0 }
  );

  const accuracy = totals.attempts > 0 ? Math.round((totals.correct / totals.attempts) * 100) : 0;
  const summary = document.createElement('p');
  summary.className = 'session-summary';
  summary.textContent = `Attempts: ${totals.attempts} · Correct: ${totals.correct} · Accuracy: ${accuracy}% · Due now: ${totals.due}`;
  panel.append(summary);

  const controls = document.createElement('div');
  controls.className = 'session-actions';

  const statsLabel = document.createElement('label');
  statsLabel.className = 'panel-label';
  statsLabel.textContent = 'History window';
  statsLabel.setAttribute('for', 'stats-days');

  const statsSelect = document.createElement('select');
  statsSelect.id = 'stats-days';
  statsSelect.className = 'panel-control';
  const options = [7, 14, 30];
  for (const value of options) {
    const option = document.createElement('option');
    option.value = String(value);
    option.textContent = `${value} days`;
    if (value === state.statsDays) {
      option.selected = true;
    }
    statsSelect.append(option);
  }

  statsSelect.addEventListener('change', () => {
    const nextDays = Number(statsSelect.value);
    if (!Number.isFinite(nextDays) || nextDays <= 0) {
      return;
    }
    setState({ statsDays: nextDays });
    void refreshReviewStats(pack);
  });

  controls.append(statsLabel, statsSelect);
  panel.append(controls);

  renderDailyAttemptsChart(
    panel,
    state.dailyAttempts,
    `Daily attempts (last ${state.dailyAttempts.length} days)`
  );

  const itemStats = new Map<string, { attempts: number; correct: number }>();
  for (const card of cards) {
    const existing = itemStats.get(card.itemId) ?? { attempts: 0, correct: 0 };
    existing.attempts += card.attempts;
    existing.correct += card.correct;
    itemStats.set(card.itemId, existing);
  }

  const entries = pack.items
    .map((item) => {
      const stats = itemStats.get(item.id);
      if (!stats) {
        return undefined;
      }
      const itemAccuracy = stats.attempts > 0 ? Math.round((stats.correct / stats.attempts) * 100) : 0;
      return {
        label: `${formatAnswerSpec(item.src)} ↔ ${item.dst}`,
        attempts: stats.attempts,
        accuracy: itemAccuracy
      };
    })
    .filter((entry): entry is { label: string; attempts: number; accuracy: number } => Boolean(entry))
    .sort((a, b) => b.attempts - a.attempts);

  if (entries.length > 0) {
    const itemToggle = document.createElement('button');
    itemToggle.type = 'button';
    itemToggle.className = 'secondary';
    itemToggle.textContent = state.showItemStats ? 'Hide word details' : 'Show word details';
    itemToggle.addEventListener('click', () => {
      setState({ showItemStats: !state.showItemStats });
    });
    panel.append(itemToggle);
  }

  if (entries.length > 0 && state.showItemStats) {
    const list = document.createElement('ul');
    list.className = 'stats-list';
    for (const entry of entries) {
      const listItem = document.createElement('li');
      listItem.className = 'stats-item';
      listItem.textContent = `${entry.label} — ${entry.accuracy}% over ${entry.attempts} attempts`;
      list.append(listItem);
    }
    panel.append(list);
  }

  container.append(panel);
}

function renderHistoryPage(container: HTMLElement): void {
  const packLabelMap = buildPackLabelMap();

  const controlPanel = document.createElement('section');
  controlPanel.className = 'panel history-controls';

  const controlLabel = document.createElement('span');
  controlLabel.className = 'panel-label';
  controlLabel.textContent = 'History scope';

  const controlRow = document.createElement('div');
  controlRow.className = 'history-controls-row';

  const packSelect = document.createElement('select');
  packSelect.className = 'panel-control';

  const allOption = document.createElement('option');
  allOption.value = 'all';
  allOption.textContent = 'All packs (vocab + verbs)';
  packSelect.append(allOption);

  const packOptions: { id: string; label: string }[] = [];
  for (const pack of AVAILABLE_PHRASEPACKS) {
    packOptions.push({ id: pack.id, label: packLabelMap.get(pack.id) ?? pack.title });
  }
  for (const pack of AVAILABLE_VERBPACKS) {
    packOptions.push({ id: pack.id, label: packLabelMap.get(pack.id) ?? pack.title });
  }
  packOptions.forEach((optionData) => {
    const option = document.createElement('option');
    option.value = optionData.id;
    option.textContent = optionData.label;
    packSelect.append(option);
  });

  if (state.historyPackId && state.historyPackId !== 'all' && !packLabelMap.has(state.historyPackId)) {
    const option = document.createElement('option');
    option.value = state.historyPackId;
    option.textContent = `Unknown pack (${state.historyPackId})`;
    packSelect.append(option);
  }

  packSelect.value = state.historyPackId;
  packSelect.addEventListener('change', () => {
    applyHistoryFilters(packSelect.value);
  });

  const daysSelect = document.createElement('select');
  daysSelect.className = 'panel-control';
  for (const value of [7, 14, 30, 90]) {
    const option = document.createElement('option');
    option.value = String(value);
    option.textContent = `${value} days`;
    if (value === state.historyStatsDays) {
      option.selected = true;
    }
    daysSelect.append(option);
  }
  daysSelect.addEventListener('change', () => {
    const nextDays = Number(daysSelect.value);
    if (!Number.isFinite(nextDays) || nextDays <= 0) {
      return;
    }
    applyHistoryFilters(undefined, nextDays);
  });

  const refreshButton = document.createElement('button');
  refreshButton.type = 'button';
  refreshButton.textContent = 'Refresh history';
  refreshButton.addEventListener('click', () => {
    void refreshHistoryData();
  });

  controlRow.append(packSelect, daysSelect, refreshButton);
  controlPanel.append(controlLabel, controlRow);
  container.append(controlPanel);

  const summaryPanel = document.createElement('section');
  summaryPanel.className = 'panel history-summary';

  const summaryLabel = document.createElement('span');
  summaryLabel.className = 'panel-label';
  summaryLabel.textContent = 'Training history';
  summaryPanel.append(summaryLabel);

  if (state.historyMessage) {
    const message = document.createElement('p');
    message.className = 'status success';
    message.textContent = state.historyMessage;
    summaryPanel.append(message);
  }

  if (state.historyLoading) {
    const loading = document.createElement('p');
    loading.className = 'status loading';
    loading.textContent = 'Loading history…';
    summaryPanel.append(loading);
    container.append(summaryPanel);
  } else if (state.historyError) {
    const error = document.createElement('p');
    error.className = 'status error';
    error.textContent = state.historyError;
    summaryPanel.append(error);
    container.append(summaryPanel);
  } else if (!state.historySummary) {
    const empty = document.createElement('p');
    empty.className = 'status hint';
    empty.textContent = 'History is ready when you answer prompts.';
    summaryPanel.append(empty);
    container.append(summaryPanel);
  } else if (state.historySummary.totalAttempts === 0) {
    const empty = document.createElement('p');
    empty.className = 'status hint';
    empty.textContent = 'No history yet. Complete a session to see your timeline.';
    summaryPanel.append(empty);
    container.append(summaryPanel);
  } else {
    const summary = state.historySummary;
    const summaryText = document.createElement('p');
    summaryText.className = 'session-summary';
    summaryText.textContent = `Attempts: ${summary.totalAttempts} · Correct: ${summary.correct} · Accuracy: ${summary.accuracy}% · Items: ${summary.uniqueItems}`;
    summaryPanel.append(summaryText);

    const range = document.createElement('p');
    range.className = 'session-summary';
    range.textContent = `First activity: ${formatDateLabel(summary.firstReviewedAt)} · Last activity: ${formatDateLabel(
      summary.lastReviewedAt
    )}`;
    summaryPanel.append(range);

    renderDailyAttemptsChart(
      summaryPanel,
      state.historyDailyAttempts,
      `Daily attempts (last ${state.historyDailyAttempts.length} days)`
    );

    if (state.historyPackId === 'all' && state.historyPackSummaries.length > 0) {
      const packHeading = document.createElement('p');
      packHeading.className = 'session-summary';
      packHeading.textContent = 'Pack breakdown';
      summaryPanel.append(packHeading);

      const list = document.createElement('ul');
      list.className = 'stats-list';
      for (const packSummary of state.historyPackSummaries) {
        const listItem = document.createElement('li');
        listItem.className = 'stats-item';
        const label = packLabelMap.get(packSummary.packId) ?? packSummary.packId;
        const lastSeen = formatDateLabel(packSummary.lastReviewedAt);
        listItem.textContent = `${label} — ${packSummary.attempts} attempts · ${packSummary.accuracy}% accuracy · last ${lastSeen}`;
        list.append(listItem);
      }
      summaryPanel.append(list);
    }

    container.append(summaryPanel);
  }

  const downloadPanel = document.createElement('section');
  downloadPanel.className = 'panel history-transfer';

  const downloadLabel = document.createElement('span');
  downloadLabel.className = 'panel-label';
  downloadLabel.textContent = 'Download or import history';

  const downloadIntro = document.createElement('p');
  downloadIntro.className = 'session-summary';
  downloadIntro.textContent =
    'Save your complete training history as a JSON file, or import a history file from another device.';

  const downloadActions = document.createElement('div');
  downloadActions.className = 'history-transfer-actions';

  const downloadButton = document.createElement('button');
  downloadButton.type = 'button';
  downloadButton.className = 'primary';
  downloadButton.textContent = 'Download history';
  downloadButton.disabled = state.historyLoading;
  downloadButton.addEventListener('click', () => {
    void downloadHistoryFile();
  });

  downloadActions.append(downloadButton);
  const uploadInput = document.createElement('input');
  uploadInput.type = 'file';
  uploadInput.accept = 'application/json';
  uploadInput.className = 'panel-control';
  uploadInput.addEventListener('change', () => {
    const file = uploadInput.files?.[0];
    if (!file) {
      return;
    }
    void handleHistoryUpload(file);
  });

  downloadPanel.append(downloadLabel, downloadIntro, downloadActions, uploadInput);

  if (state.historyImport) {
    const importSummary = state.historyImport.summary;
    const importInfo = document.createElement('p');
    importInfo.className = 'session-summary';
    importInfo.textContent = `Ready to import ${state.historyImport.fileName}: ${importSummary.totalAttempts} attempts · ${importSummary.accuracy}% accuracy · ${importSummary.uniqueItems} items`;
    downloadPanel.append(importInfo);

    const hasExistingHistory = state.historyEvents.length > 0 || state.historyCards.length > 0;
    if (hasExistingHistory) {
      const warn = document.createElement('p');
      warn.className = 'status hint';
      warn.textContent = 'Existing history detected. Choose whether to overwrite it.';
      downloadPanel.append(warn);
    }

    const importActions = document.createElement('div');
    importActions.className = 'history-transfer-actions';

    const importButton = document.createElement('button');
    importButton.type = 'button';
    importButton.textContent = hasExistingHistory ? 'Overwrite history' : 'Import history';
    importButton.disabled = state.historyLoading;
    importButton.addEventListener('click', () => {
      void applyHistoryImport();
    });
    importActions.append(importButton);

    const clearButton = document.createElement('button');
    clearButton.type = 'button';
    clearButton.textContent = 'Clear file';
    clearButton.disabled = state.historyLoading;
    clearButton.addEventListener('click', () => {
      uploadInput.value = '';
      setState({ historyImport: undefined });
    });

    importActions.append(clearButton);
    downloadPanel.append(importActions);
  }
  container.append(downloadPanel);
}

function render(): void {
  attachGlobalKeyListener();
  root.innerHTML = '';

  const container = document.createElement('main');
  container.className = 'app';

  const header = document.createElement('header');
  header.className = 'app-header';

  const title = document.createElement('h1');
  title.textContent = 'Italian Language Trainer';

  const subtitle = document.createElement('p');
  subtitle.className = 'app-subtitle';
  subtitle.textContent = 'Practice vocabulary and verb conjugations with focused daily drills.';

  header.append(title, subtitle);
  container.append(header);

  renderPrimaryNav(container);

  if (state.view === 'practice') {
    renderModeSelector(container);
    renderPackSelector(container);

    if (state.loading) {
      const loading = document.createElement('p');
      loading.className = 'status loading';
      loading.textContent = state.mode === 'verbs' ? 'Loading verb pack…' : 'Loading phrase pack…';
      container.append(loading);
    }

    if (state.error) {
      const error = document.createElement('p');
      error.className = 'status error';
      error.textContent = state.error;
      container.append(error);
    }

    if (!state.loading) {
      if (state.mode === 'vocab') {
        if (state.pack) {
          renderDrillCard(container, state.pack);
          renderSessionPanel(container);
          if (state.showStats) {
            renderStatsPanel(container, state.pack);
          }
        } else {
          const hint = document.createElement('p');
          hint.className = 'status hint';
          hint.textContent = 'Select a phrase pack to start a drill.';
          container.append(hint);
        }
      } else if (state.mode === 'verbs') {
        if (state.verbPack) {
          renderVerbDrillCard(container, state.verbPack);
          renderVerbSessionPanel(container);
          if (state.showStats) {
            renderStatsPanel(container, state.verbPack);
          }
        } else {
          const hint = document.createElement('p');
          hint.className = 'status hint';
          hint.textContent = 'Select a verb pack to start a drill.';
          container.append(hint);
        }
      }
    }
  } else {
    renderHistoryPage(container);
  }

  root.append(container);
}

function createSvgTitle(value: string): SVGTitleElement {
  const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
  title.textContent = value;
  return title;
}

render();
