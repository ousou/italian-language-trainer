import './style.css';
import type { DrillDirection, LanguageCode, VocabPack } from './types.ts';
import { AVAILABLE_PHRASEPACKS, fetchPhrasePack } from './data/phrasepacks.ts';

interface AppState {
  packId?: string;
  pack?: VocabPack;
  loading: boolean;
  error?: string;
  direction: DrillDirection;
  currentIndex: number;
  reveal: boolean;
  order: number[];
  round: number;
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
  reveal: false,
  order: [],
  round: 1
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
      reveal: false,
      error: undefined,
      round: 1
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
      reveal: false,
      round: 1
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
    setState({ currentIndex: currentIndex + 1, reveal: false });
    return;
  }

  // Completed one round; reshuffle for the next round.
  setState({ order: shuffle(order.length), currentIndex: 0, reveal: false, round: state.round + 1 });
}

function reshuffleDeck(): void {
  const { pack } = state;

  if (!pack) {
    return;
  }

  setState({ order: shuffle(pack.items.length), currentIndex: 0, reveal: false, round: 1 });
}

function toggleDirection(direction: DrillDirection): void {
  if (state.direction === direction) {
    return;
  }

  setState({ direction, reveal: false });
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
  const { order, currentIndex, direction, reveal } = state;

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
  answer.className = reveal ? 'drill-answer revealed' : 'drill-answer hidden';

  const answerBadge = document.createElement('span');
  answerBadge.className = 'badge';
  answerBadge.textContent = LANGUAGE_LABELS[answerLabel] ?? answerLabel.toUpperCase();

  const answerTextNode = document.createElement('span');
  answerTextNode.className = 'answer-text';
  answerTextNode.textContent = reveal ? answerText : 'Translation hidden';

  answer.append(answerBadge, answerTextNode);

  const controls = document.createElement('div');
  controls.className = 'drill-controls';

  const revealButton = document.createElement('button');
  revealButton.type = 'button';
  revealButton.className = 'primary';
  revealButton.textContent = reveal ? 'Hide translation' : 'Show translation';
  revealButton.addEventListener('click', () => {
    setState({ reveal: !state.reveal });
  });

  const nextButton = document.createElement('button');
  nextButton.type = 'button';
  nextButton.textContent = 'Next word';
  nextButton.addEventListener('click', () => {
    goToNext();
  });

  const reshuffleButton = document.createElement('button');
  reshuffleButton.type = 'button';
  reshuffleButton.textContent = 'Reset round';
  reshuffleButton.addEventListener('click', () => {
    reshuffleDeck();
  });

  controls.append(revealButton, nextButton, reshuffleButton);

  card.append(meta, prompt, answer, controls);
  container.append(card);
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
  } else if (!state.loading) {
    const hint = document.createElement('p');
    hint.className = 'status hint';
    hint.textContent = 'Select a phrase pack to start a drill.';
    container.append(hint);
  }

  root.append(container);
}

render();
