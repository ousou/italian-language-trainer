import './style.css';
import type { DrillDirection, LanguageCode, VocabPack } from './types.ts';
import { AVAILABLE_PHRASEPACKS, fetchPhrasePack } from './data/phrasepacks.ts';
import { isAnswerCorrect } from './logic/answerCheck.ts';

interface AppState {
  packId?: string;
  pack?: VocabPack;
  loading: boolean;
  error?: string;
  direction: DrillDirection;
  currentIndex: number;
  answerInput: string;
  lastResult?: 'correct' | 'incorrect';
  order: number[];
  round: number;
  sessionCorrect: number;
  sessionIncorrect: number;
  incorrectItems: Array<{
    key: string;
    prompt: string;
    expected: string;
    answer: string;
  }>;
  showIncorrect: boolean;
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
  direction: 'src-to-dst',
  currentIndex: 0,
  answerInput: '',
  lastResult: undefined,
  order: [],
  round: 1,
  sessionCorrect: 0,
  sessionIncorrect: 0,
  incorrectItems: [],
  showIncorrect: false
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

function shuffle(length: number): number[] {
  const indices = Array.from({ length }, (_, index) => index);

  for (let i = indices.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }

  return indices;
}

async function selectPack(id: string | undefined): Promise<void> {
  if (!id) {
    setState({
      packId: undefined,
      pack: undefined,
      order: [],
      currentIndex: 0,
      answerInput: '',
      lastResult: undefined,
      error: undefined,
      round: 1,
      sessionCorrect: 0,
      sessionIncorrect: 0,
      incorrectItems: [],
      showIncorrect: false
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
      order: shuffle(pack.items.length),
      currentIndex: 0,
      answerInput: '',
      lastResult: undefined,
      round: 1,
      sessionCorrect: 0,
      sessionIncorrect: 0,
      incorrectItems: [],
      showIncorrect: false
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
  const { pack, order, currentIndex } = state;

  if (!pack || order.length === 0) {
    return;
  }

  if (currentIndex < order.length - 1) {
    setState({ currentIndex: currentIndex + 1, answerInput: '', lastResult: undefined });
    return;
  }

  // Completed one round; reshuffle for the next round.
  setState({
    order: shuffle(order.length),
    currentIndex: 0,
    answerInput: '',
    lastResult: undefined,
    round: state.round + 1
  });
}

function reshuffleDeck(): void {
  const { pack } = state;

  if (!pack) {
    return;
  }

  setState({
    order: shuffle(pack.items.length),
    currentIndex: 0,
    answerInput: '',
    lastResult: undefined,
    round: 1,
    sessionCorrect: 0,
    sessionIncorrect: 0,
    incorrectItems: [],
    showIncorrect: false
  });
}

function toggleDirection(direction: DrillDirection): void {
  if (state.direction === direction) {
    return;
  }

  setState({
    direction,
    answerInput: '',
    lastResult: undefined,
    sessionCorrect: 0,
    sessionIncorrect: 0,
    incorrectItems: [],
    showIncorrect: false
  });
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
  const { order, currentIndex, direction, lastResult, answerInput } = state;

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
  meta.textContent = `Word ${currentIndex + 1} of ${order.length} · Round ${state.round}`;

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
  input.addEventListener('input', (event) => {
    const target = event.target as HTMLInputElement;
    setState({ answerInput: target.value });
  });

  const checkButton = document.createElement('button');
  checkButton.type = 'submit';
  checkButton.className = 'primary';
  checkButton.textContent = 'Check answer';
  checkButton.disabled = showAnswer || answerInput.trim() === '';

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (state.lastResult !== undefined) {
      return;
    }
    const correct = isAnswerCorrect(answerText, state.answerInput);
    const result = correct ? 'correct' : 'incorrect';
    const updates: Partial<AppState> = { lastResult: result };

    if (correct) {
      updates.sessionCorrect = state.sessionCorrect + 1;
    } else {
      updates.sessionIncorrect = state.sessionIncorrect + 1;
      const key = `${item.id}:${state.direction}`;
      const entry = { key, prompt: promptText, expected: answerText, answer: state.answerInput };
      const existingIndex = state.incorrectItems.findIndex((item) => item.key === key);
      if (existingIndex >= 0) {
        const updated = [...state.incorrectItems];
        updated[existingIndex] = entry;
        updates.incorrectItems = updated;
      } else {
        updates.incorrectItems = [...state.incorrectItems, entry];
      }
    }

    setState(updates);
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
  nextButton.disabled = !showAnswer;
  nextButton.addEventListener('click', () => {
    goToNext();
  });

  const reshuffleButton = document.createElement('button');
  reshuffleButton.type = 'button';
  reshuffleButton.textContent = 'Reset round';
  reshuffleButton.addEventListener('click', () => {
    reshuffleDeck();
  });

  controls.append(nextButton, reshuffleButton);

  card.append(meta, prompt, answer, form, feedback, controls);
  container.append(card);
}

function renderSessionPanel(container: HTMLElement): void {
  const panel = document.createElement('section');
  panel.className = 'panel session-panel';

  const heading = document.createElement('span');
  heading.className = 'panel-label';
  heading.textContent = 'Session stats';

  const summary = document.createElement('div');
  summary.className = 'session-summary';
  summary.textContent = `Correct: ${state.sessionCorrect} · Incorrect: ${state.sessionIncorrect}`;

  const toggleButton = document.createElement('button');
  toggleButton.type = 'button';
  toggleButton.textContent = state.showIncorrect ? 'Hide incorrect words' : 'Show incorrect words';
  toggleButton.disabled = state.incorrectItems.length === 0;
  toggleButton.addEventListener('click', () => {
    setState({ showIncorrect: !state.showIncorrect });
  });

  panel.append(heading, summary, toggleButton);

  if (state.showIncorrect && state.incorrectItems.length > 0) {
    const list = document.createElement('ul');
    list.className = 'incorrect-list';

    for (const item of state.incorrectItems) {
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
