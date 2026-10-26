import recipesJson from '../../data/recipes.json';
import type { PrepSessionResult } from '../nutrition/prep';
import type { Recipe } from '../nutrition/types';
import {
  attachRecipes,
  buildMiseEnPlace,
  clampPosition,
  dueEvents,
  formatRemaining,
  isFinished,
  parseCookState,
  remainingMs,
  serializeCookState,
  sessionState,
  startTimer,
  toggleChecked,
  withPosition,
  withReported,
  withSessionState,
  withTimer,
  withoutSession,
  withoutTimer,
} from '../nutrition/cook';
import type { CookSession, CookSessionState, CookState, CookStep, CookTimer, TimerEvent } from '../nutrition/cook';
import { readStorage, writeStorage } from '../nutrition/state';
import {
  COOK_STATE_KEY,
  END_TONE_COUNT,
  END_VIBRATION_PATTERN,
  HOLD_TONE_COUNT,
  HOLD_VIBRATION_PATTERN,
  MIN_CONTROL_PX,
  MISE_EN_PLACE_POSITION,
  MS_PER_SECOND,
  TIMER_TICK_MS,
  TONE_FREQUENCY_HZ,
  TONE_GAIN,
  TONE_GAP_MS,
  TONE_MS,
} from '../config/cook';
import { integer } from './format';
import { FOCUS_ATTR, checkRow, el, focusedKey, restoreFocus, span } from './build';

/**
 * Kochansicht einer Prep Session. Eigener Chunk, erst beim Knopf `Kochen`
 * geladen, damit `recipes.json` nicht im Haupt Bundle landet.
 *
 * Die Ansicht zeichnet sich selbst neu, ohne den Reiter Plan. Ein Takt prueft
 * die Timer, haelt den Wake Lock und raeumt auf, sobald die Ansicht nicht mehr
 * im Dokument haengt.
 */

const RECIPES = recipesJson as unknown as Recipe[];

export interface CookContext {
  session: PrepSessionResult;
  mealName: (mealId: string) => string;
  onClose: () => void;
}

interface Mounted {
  root: HTMLElement;
  ctx: CookContext;
  cook: CookSession;
  /** Restzeit je Timer, im Takt ohne Neuzeichnen aktualisiert. */
  timerTexts: Map<string, HTMLElement>;
  wakeStatus: HTMLElement;
}

let mounted: Mounted | null = null;
let state: CookState = {};
let ticker: number | null = null;

const grams = (value: number): string => `${integer(value)} g`;

// ── Zustand ──────────────────────────────────────────────────────────────────

function current(view: Mounted): CookSessionState {
  return sessionState(state, view.cook.id);
}

function save(): void {
  writeStorage(COOK_STATE_KEY, Object.keys(state).length > 0 ? serializeCookState(state) : null);
}

function update(view: Mounted, next: CookSessionState): void {
  state = withSessionState(state, view.cook.id, next);
  save();
  draw(view);
}

function resetSession(view: Mounted): void {
  state = withoutSession(state, view.cook.id);
  save();
  draw(view);
}

// ── Ton und Vibration ────────────────────────────────────────────────────────

let audio: AudioContext | null = null;

/** Browser erlauben Ton erst nach einer Beruehrung, jede Beruehrung der Ansicht schaltet ihn frei. */
function unlockAudio(): void {
  try {
    audio ??= new AudioContext();
    void audio.resume().catch(() => undefined);
  } catch {
    audio = null;
  }
}

function playTones(count: number): void {
  unlockAudio();
  if (!audio) return;
  const toneSeconds = TONE_MS / MS_PER_SECOND;
  const stepSeconds = (TONE_MS + TONE_GAP_MS) / MS_PER_SECOND;
  for (let i = 0; i < count; i++) {
    const start = audio.currentTime + i * stepSeconds;
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    oscillator.frequency.value = TONE_FREQUENCY_HZ;
    gain.gain.value = TONE_GAIN;
    oscillator.connect(gain).connect(audio.destination);
    oscillator.start(start);
    oscillator.stop(start + toneSeconds);
  }
}

function vibrate(pattern: readonly number[]): void {
  try {
    if ('vibrate' in navigator) navigator.vibrate([...pattern]);
  } catch {
    // iOS Safari kennt keine Vibration, dann bleibt nur der Ton.
  }
}

function signal(events: readonly TimerEvent[]): void {
  if (events.includes('end')) {
    playTones(END_TONE_COUNT);
    vibrate(END_VIBRATION_PATTERN);
  } else {
    playTones(HOLD_TONE_COUNT);
    vibrate(HOLD_VIBRATION_PATTERN);
  }
}

// ── Wake Lock ────────────────────────────────────────────────────────────────

let wakeLock: WakeLockSentinel | null = null;
let wakeLockPending = false;
let wakeLockFailed = false;

/** Nur solange die Ansicht sichtbar ist: nicht bei verstecktem Reiter oder Tab im Hintergrund. */
function wakeLockWanted(): boolean {
  return mounted !== null
    && mounted.root.isConnected
    && mounted.root.getClientRects().length > 0
    && document.visibilityState === 'visible';
}

function showWakeStatus(): void {
  if (mounted) mounted.wakeStatus.hidden = !wakeLockFailed;
}

function markWakeLockFailed(): void {
  wakeLockFailed = true;
  showWakeStatus();
}

function releaseWakeLock(): void {
  const lock = wakeLock;
  wakeLock = null;
  if (lock) void lock.release().catch(() => undefined);
}

function syncWakeLock(): void {
  if (!wakeLockWanted()) {
    releaseWakeLock();
    return;
  }
  if (wakeLock || wakeLockPending || wakeLockFailed) return;
  if (!('wakeLock' in navigator)) {
    markWakeLockFailed();
    return;
  }
  wakeLockPending = true;
  navigator.wakeLock.request('screen')
    .then((lock) => {
      wakeLockPending = false;
      wakeLock = lock;
      // Das System gibt die Sperre beim Wechsel in den Hintergrund selbst frei.
      lock.addEventListener('release', () => {
        if (wakeLock === lock) wakeLock = null;
      });
      if (!wakeLockWanted()) releaseWakeLock();
    })
    .catch(() => {
      wakeLockPending = false;
      markWakeLockFailed();
    });
}

/** Nach Rueckkehr aus dem Hintergrund wird die Sperre neu angefordert, auch nach einem Fehlschlag. */
function onVisibilityChange(): void {
  if (document.visibilityState !== 'visible') return;
  wakeLockFailed = false;
  showWakeStatus();
  tick();
}

// ── Takt ─────────────────────────────────────────────────────────────────────

function teardown(): void {
  if (ticker !== null) window.clearInterval(ticker);
  ticker = null;
  mounted = null;
  releaseWakeLock();
  document.removeEventListener('visibilitychange', onVisibilityChange);
}

/** Meldet faellige Ereignisse genau einmal und merkt sie im Zustand, damit Neuladen nicht doppelt klingelt. */
function reportDue(view: Mounted, now: number): boolean {
  const session = current(view);
  const fired: TimerEvent[] = [];
  const timers = session.timers.map((timer) => {
    const due = dueEvents(timer, now);
    fired.push(...due);
    return due.length > 0 ? withReported(timer, due) : timer;
  });
  if (fired.length === 0) return false;
  signal(fired);
  update(view, { ...session, timers });
  return true;
}

function tick(): void {
  const view = mounted;
  if (!view || !view.root.isConnected) {
    teardown();
    return;
  }
  syncWakeLock();
  const now = Date.now();
  if (reportDue(view, now)) return;
  for (const timer of current(view).timers) {
    const text = view.timerTexts.get(timer.stepId);
    if (text) text.textContent = formatRemaining(remainingMs(timer, now));
  }
}

// ── Bausteine ────────────────────────────────────────────────────────────────

function button(text: string, key: string, onClick: () => void, extraClass = ''): HTMLButtonElement {
  const element = el('button', {
    class: `btn btn-tap ck-btn ${extraClass}`.trim(),
    text,
    attrs: { type: 'button', [FOCUS_ATTR]: key },
  });
  element.addEventListener('click', onClick);
  return element;
}

function findStep(view: Mounted, stepId: string): CookStep | undefined {
  return view.cook.steps.find((s) => s.step.id === stepId);
}

function header(view: Mounted): HTMLElement {
  const { cook } = view;
  const head = el('div', { class: 'ck-head' }, [
    el('h3', { text: cook.title }),
    el('div', { class: 'ck-actions' }, [
      button('Zurücksetzen', 'ck-reset', () => resetSession(view)),
      button('Schließen', 'ck-close', () => {
        teardown();
        view.ctx.onClose();
      }),
    ]),
  ]);
  const box = el('div', {}, [head]);
  if (cook.instructed < cook.steps.length) {
    box.appendChild(span('ck-status num', `Anweisungen ${cook.instructed} von ${cook.steps.length} Schritten`));
  }
  box.appendChild(view.wakeStatus);
  return box;
}

function timerStatus(view: Mounted, timer: CookTimer, now: number): string {
  if (isFinished(timer, now)) return 'Fertig';
  const hold = findStep(view, timer.stepId)?.recipe?.hold;
  if (hold && timer.holdAt !== null && now >= timer.holdAt) return hold.action;
  return '';
}

function timerBar(view: Mounted, timers: readonly CookTimer[]): HTMLElement | null {
  view.timerTexts.clear();
  if (timers.length === 0) return null;
  const now = Date.now();
  const bar = el('div', { class: 'ck-timers', attrs: { role: 'timer' } });
  for (const timer of timers) {
    const title = findStep(view, timer.stepId)?.step.title ?? timer.stepId;
    const status = timerStatus(view, timer, now);
    const time = span('ck-time num', formatRemaining(remainingMs(timer, now)));
    view.timerTexts.set(timer.stepId, time);
    const stateClass = isFinished(timer, now) ? ' is-done' : status ? ' is-hold' : '';
    bar.appendChild(el('div', { class: `ck-timer${stateClass}` }, [
      el('span', { class: 'ck-timer-body' }, [span('ck-timer-name', title), status ? span('ck-timer-status', status) : null]),
      time,
      button('Stopp', `ck-stop-${timer.stepId}`, () => update(view, withoutTimer(current(view), timer.stepId))),
    ]));
  }
  return bar;
}

function miseView(view: Mounted, session: CookSessionState): HTMLElement {
  const lines = buildMiseEnPlace(view.ctx.session);
  const done = lines.filter((line) => session.checked.includes(line.foodId)).length;
  const box = el('section', { class: 'ck-screen' }, [
    span('card-label num', `Zutaten ${done} von ${lines.length}`),
    el('h4', { class: 'ck-title', text: 'Mise en place' }),
  ]);
  if (lines.length === 0) box.appendChild(el('div', { class: 'pl-season', text: 'Keine Mengen in dieser Rotation' }));
  for (const line of lines) {
    box.appendChild(checkRow({
      key: `ck-mise-${line.foodId}`,
      label: line.name,
      quantity: line.grams === null ? '' : grams(line.grams),
      checked: session.checked.includes(line.foodId),
      onChange: () => update(view, toggleChecked(current(view), line.foodId)),
    }));
  }
  return box;
}

function factLine(cookStep: CookStep): string {
  const { step, recipe } = cookStep;
  const facts: string[] = [step.device];
  if (recipe?.temperatureC !== undefined) facts.push(`${integer(recipe.temperatureC)} °C`);
  if (recipe) facts.push(`${integer(recipe.minutes)} min`);
  if (recipe?.hold) facts.push(`${recipe.hold.action} nach ${integer(recipe.hold.afterMinutes)} min`);
  return facts.join(', ');
}

function ingredientList(view: Mounted, cookStep: CookStep): HTMLElement {
  const list = el('ul', { class: 'ck-ing' });
  if (cookStep.step.lines.length === 0) return el('div', { class: 'pl-season', text: 'Keine Mengen in dieser Rotation' });
  for (const line of cookStep.step.lines) {
    const uses = line.uses
      .map((u) => (u.grams === null ? view.ctx.mealName(u.mealId) : `${view.ctx.mealName(u.mealId)} ${grams(u.grams)}`))
      .join(', ');
    list.appendChild(el('li', {}, [
      el('div', { class: 'ck-ing-row' }, [span('ck-ing-name', line.name), span('ck-ing-qty num', line.grams === null ? '' : grams(line.grams))]),
      span('check-sub', uses),
    ]));
  }
  return list;
}

function stepView(view: Mounted, session: CookSessionState, position: number): HTMLElement {
  const cookStep = view.cook.steps[position - 1]!;
  const { step, recipe } = cookStep;
  const box = el('section', { class: 'ck-screen' }, [
    span('card-label num', `Schritt ${position} von ${view.cook.steps.length}`),
    el('h4', { class: 'ck-title', text: step.title }),
    el('div', { class: 'ck-facts num', text: factLine(cookStep) }),
  ]);
  if (recipe) {
    box.appendChild(el('p', { class: 'ck-instruction', text: recipe.instruction }));
    const running = session.timers.some((t) => t.stepId === recipe.stepId);
    box.appendChild(button(running ? 'Timer neu starten' : `Timer ${integer(recipe.minutes)} min`, `ck-start-${recipe.stepId}`, () => {
      unlockAudio();
      update(view, withTimer(current(view), startTimer(recipe, Date.now())));
    }, 'ck-primary'));
  }
  box.appendChild(ingredientList(view, cookStep));
  return box;
}

function navigation(view: Mounted, position: number): HTMLElement {
  const count = view.cook.steps.length;
  const go = (next: number): void => update(view, withPosition(current(view), next, count));
  const back = button('Zurück', 'ck-back', () => go(position - 1));
  const next = button('Weiter', 'ck-next', () => go(position + 1));
  back.disabled = position <= MISE_EN_PLACE_POSITION;
  next.disabled = position >= count;
  return el('div', { class: 'ck-nav' }, [back, next]);
}

function draw(view: Mounted): void {
  const focus = focusedKey();
  const session = current(view);
  const position = clampPosition(session.position, view.cook.steps.length);
  view.root.replaceChildren(...[
    header(view),
    timerBar(view, session.timers),
    position === MISE_EN_PLACE_POSITION ? miseView(view, session) : stepView(view, session, position),
    navigation(view, position),
  ].filter((node): node is HTMLElement => node !== null));
  restoreFocus(view.root, focus);
}

// ── Einstieg ─────────────────────────────────────────────────────────────────

/** Baut die Kochansicht. Ein erneuter Aufruf, etwa nach einem Tausch im Plan, ersetzt die alte Ansicht. */
export function cookView(ctx: CookContext): HTMLElement {
  const root = el('div', { class: 'ck' });
  root.style.setProperty('--ck-control', `${MIN_CONTROL_PX}px`);
  root.addEventListener('pointerdown', unlockAudio);
  const wakeStatus = span('ck-status', 'Wake Lock nicht verfügbar');
  state = parseCookState(readStorage(COOK_STATE_KEY));
  const view: Mounted = { root, ctx, cook: attachRecipes(ctx.session, RECIPES), timerTexts: new Map(), wakeStatus };
  mounted = view;
  showWakeStatus();
  draw(view);
  if (ticker === null) {
    ticker = window.setInterval(tick, TIMER_TICK_MS);
    document.addEventListener('visibilitychange', onVisibilityChange);
  }
  return root;
}
