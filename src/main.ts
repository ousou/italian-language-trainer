import './style.css';
import type { DrillDirection, LanguageCode, VocabPack } from './types.ts';
import { AVAILABLE_PHRASEPACKS, fetchPhrasePack } from './data/phrasepacks.ts';
import { nextCard, redoIncorrect, startNewSession as createNewSession, submitAnswer, type SessionState } from './logic/session.ts';

interface AppState {
  packId?: string;
  pack?: VocabPack;
  loading: boolean;
  error?: string;
  showIncorrect: boolean;
  session?: SessionState;
  direction: DrillDirection;
}

const LANGUAGE_LABELS: Record<LanguageCode, string> = {
  it: 'Italian',
  fi: 'Finnish',
  sv: 'Swedish'
};

const state: AppState = {
  packId: undefined,
  pack: undefined,
  loading: false,
  error: undefined,
  showIncorrect: false,
  session: undefined,
  direction: 'src-to-dst'
};

let loadToken = 0;

const rootElement = document.querySelector<HTMLDivElement>('#app');

if (!rootElement) {
  throw new Error('Root element #app not found');
}

const root = rootElement;

function setState(partial: Partial<AppState>): void {
  Object.assign(state, partial);
  render();
}

function startNewSession(): void {
  if (!state.pack) {
    return;
  }

  const session = startNewSessionLogic(state.pack, state.direction);
  setState({ session, showIncorrect: false });
}

function redoIncorrectSession(): void {
  if (!state.pack || !state.session) {
    return;
  }

  const session = redoIncorrect(state.pack, state.session);
  if (session === state.session) {
    return;
  }
  setState({ session, showIncorrect: false });
}

async function selectPack(id: string | undefined): Promise<void> {
  if (!id) {
    setState({
      packId: undefined,
      pack: undefined,
      error: undefined,
      showIncorrect: false,
      session: undefined
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
      session: {
        ...startNewSessionLogic(pack, state.direction)
      }
    });
  } catch (error) {
    if (currentToken !== loadToken) {
      return;
    }

    const message = error instanceof Error ? error.message : 'Unknown error while loading the phrase pack.';
    setState({ loading: false, error: message });
  }
}

function goToNext(): void {
  if (!state.pack || !state.session) {
    return;
  }

  const session = nextCard(state.session);
  if (session !== state.session) {
    setState({ session });
  }
}

function toggleDirection(direction: DrillDirection): void {
  if (state.direction === direction) {
    return;
  }

  setState({
    direction,
    showIncorrect: false,
    session: state.pack ? startNewSessionLogic(state.pack, direction) : undefined
  });
}

function startNewSessionLogic(pack: VocabPack, direction: DrillDirection): SessionState {
  return createNewSession(pack, direction);
}

function renderPackSelector(container: HTMLElement): void {
  const section = document.createElement('section');
  section.className = 'panel pack-picker';

  const label = document.createElement('label');
  label.className = 'panel-label';
  label.textContent = 'Choose a phrase pack';
  label.setAttribute('for', 'pack-select');

  const select = document.createElement('select');
  select.id = 'pack-select';
  select.className = 'panel-control';

  const defaultOption = document.createElement('option');
  defaultOption.value = '';
  defaultOption.textContent = '— Select a pack —';
  select.append(defaultOption);

  for (const pack of AVAILABLE_PHRASEPACKS) {
    const option = document.createElement('option');
    option.value = pack.id;
    option.textContent = pack.title;
    if (pack.id === state.packId) {
      option.selected = true;
    }
    select.append(option);
  }

  select.addEventListener('change', (event) => {
    const target = event.target as HTMLSelectElement;
    void selectPack(target.value || undefined);
  });

  section.append(label, select);
  container.append(section);
}

function renderDirectionToggle(container: HTMLElement, pack: VocabPack): void {
  const section = document.createElement('section');
  section.className = 'panel direction-toggle';

  const heading = document.createElement('span');
  heading.className = 'panel-label';
  heading.textContent = 'Drill direction';
  section.append(heading);

  const options: Array<{ value: DrillDirection; label: string }> = [
    { value: 'src-to-dst', label: `${LANGUAGE_LABELS[pack.src]} → ${LANGUAGE_LABELS[pack.dst]}` },
    { value: 'dst-to-src', label: `${LANGUAGE_LABELS[pack.dst]} → ${LANGUAGE_LABELS[pack.src]}` }
  ];

  for (const option of options) {
    const wrapper = document.createElement('label');
    wrapper.className = 'direction-option';

    const input = document.createElement('input');
    input.type = 'radio';
    input.name = 'direction';
    input.value = option.value;
    input.checked = state.direction === option.value;

    input.addEventListener('change', () => {
      toggleDirection(option.value);
    });

    const text = document.createElement('span');
    text.textContent = option.label;

    wrapper.append(input, text);
    section.append(wrapper);
  }

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
  const showAnswer = lastResult !== undefined;

  const card = document.createElement('section');
  card.className = 'drill-card';

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

  const form = document.createElement('form');
  form.className = 'answer-form';

  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'answer-input panel-control';
  input.placeholder = `Type the ${LANGUAGE_LABELS[answerLabel] ?? answerLabel.toUpperCase()} answer`;
  input.value = answerInput;
  input.autocomplete = 'off';
  input.spellcheck = false;
  input.disabled = showAnswer || sessionComplete;

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
    checkButton.disabled = showAnswer || target.value.trim() === '';
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!state.session || state.session.lastResult !== undefined) {
      return;
    }
    const nextSession = submitAnswer(pack, state.session, state.session.answerInput);
    setState({ session: nextSession });
  });

  form.append(input, checkButton);

  const feedback = document.createElement('p');
  feedback.className = `answer-feedback ${lastResult ?? ''}`.trim();
  if (lastResult === 'correct') {
    feedback.textContent = 'Correct!';
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
    goToNext();
  });

  controls.append(nextButton);

  card.append(meta, prompt, answer, form, feedback, controls);
  container.append(card);
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

  actions.append(toggleButton);
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

function render(): void {
  root.innerHTML = '';

  const container = document.createElement('main');
  container.className = 'app';

  const header = document.createElement('header');
  header.className = 'app-header';

  const title = document.createElement('h1');
  title.textContent = 'Italian Language Trainer';

  const subtitle = document.createElement('p');
  subtitle.className = 'app-subtitle';
  subtitle.textContent = 'Pick a phrase pack and practice going between Italian and your target language.';

  header.append(title, subtitle);
  container.append(header);

  renderPackSelector(container);

  if (state.loading) {
    const loading = document.createElement('p');
    loading.className = 'status loading';
    loading.textContent = 'Loading phrase pack…';
    container.append(loading);
  }

  if (state.error) {
    const error = document.createElement('p');
    error.className = 'status error';
    error.textContent = state.error;
    container.append(error);
  }

  if (state.pack && !state.loading) {
    renderDirectionToggle(container, state.pack);
    renderDrillCard(container, state.pack);
    renderSessionPanel(container);
  } else if (!state.loading) {
    const hint = document.createElement('p');
    hint.className = 'status hint';
    hint.textContent = 'Select a phrase pack to start a drill.';
    container.append(hint);
  }

  root.append(container);
}

render();
