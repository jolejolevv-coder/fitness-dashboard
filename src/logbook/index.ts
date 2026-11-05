import { getLogbookAccess, type LogbookAccess } from '../config/logbookAccess';
import { MissingColumnsError } from '../parse/columns';
import { generalTextFor, parsePlan, parsePlanSettings, PlanError, type Plan, type PlanDay, type PlanExercise, type PlanSettings } from '../parse/plan';
import { exerciseKey } from '../parse/training';
import { readLoggedHistory, type LastSession, type LoggedHistory } from '../parse/trainingSets';
import type { SheetValues } from '../types';
import { el } from '../ui/build';
import { refusalCard } from '../ui/cards';
import { loadPlanCache, savePlanCache, type PlanRows } from './planCache';
import {
  defaultDay, doneCount, ensureSets, formatKg, hasData, isNumeric, isRangeFull, loadSession, loadSessions, newSession,
  pruneSessions, rangeFor, rangeTop, saveSession, sessionId, todayIso, type Session, type SetState,
} from './session';
import { flushPending, NETWORK_ERROR } from './sync';
import { createOverlay, formatClock, unlockAudio, type Overlay } from './timer';
import { warmupLine } from './warmup';

/**
 * Segment `Eintragen`, Logbuch Formular (Phase 20, ADR 0010), als Chunk `logbook`.
 *
 * Plan aus den Tabs `Plan` und `PlanSettings`, Eingaben sofort im localStorage,
 * Senden nach jeder Aenderung verzoegert ueber das Apps Script des Logbuchs.
 * Es gibt keinen Senden Knopf. Ohne Netz bleibt alles lokal und geht nach der
 * Rueckkehr raus.
 */

export interface LogbookContext {
  /** Schluessel der Quelle, trennt den Plan Cache. */
  source: string;
  loadPlan: () => Promise<PlanRows>;
  /** Rohzeilen von `TrainingSets`, null ohne Daten. */
  setRows: () => SheetValues | null;
}

/** Verzoegerung zwischen letzter Aenderung und Senden. */
const SEND_DELAY_MS = 700;

interface State {
  context: LogbookContext;
  plan: Plan | null;
  settings: PlanSettings;
  history: LoggedHistory;
  planError: string;
  tag: string | null;
  session: Session | null;
  sendError: string | null;
  sentAt: Date | null;
  sending: boolean;
  resend: boolean;
}

const state: State = {
  context: { source: '', loadPlan: () => Promise.reject(new Error('kein Kontext')), setRows: () => null },
  plan: null,
  settings: parsePlanSettings([]),
  history: { last: new Map(), latest: null },
  planError: '',
  tag: null,
  session: null,
  sendError: null,
  sentAt: null,
  sending: false,
  resend: false,
};

let shell: HTMLElement | null = null;
let view: HTMLElement | null = null;
let overlay: Overlay | null = null;
let sendTimer: number | undefined;
let refreshStatus: (() => void) | null = null;

window.addEventListener('online', () => void runFlush());
window.addEventListener('offline', () => refreshStatus?.());
document.addEventListener('visibilitychange', () => {
  if (document.hidden) void runFlush();
});

export function renderLogbook(container: HTMLElement, context: LogbookContext): void {
  state.context = context;
  if (shell && shell.parentElement === container && shell.contains(document.activeElement)) {
    // Mitten in der Eingabe wird nicht neu gezeichnet, die Daten gelten beim naechsten Mal.
    loadHistory();
    return;
  }
  ensureShell(container);
  pruneSessions();
  const cached = loadPlanCache(context.source);
  if (cached) applyRows(cached);
  else draw();
  void refreshPlan();
  void runFlush();
}

function ensureShell(container: HTMLElement): void {
  if (shell && shell.parentElement === container) return;
  view = el('div', { class: 'logbook' });
  overlay = createOverlay();
  shell = el('div', { class: 'logbook-shell' }, [view, overlay.element]);
  container.replaceChildren(shell);
}

async function refreshPlan(): Promise<void> {
  if (!navigator.onLine) return;
  const source = state.context.source;
  try {
    const rows = await state.context.loadPlan();
    const before = JSON.stringify(loadPlanCache(source));
    savePlanCache(source, rows);
    if (before === JSON.stringify(rows) && state.plan) return;
    if (shell?.contains(document.activeElement)) return;
    applyRows(rows);
  } catch (error) {
    if (!state.plan) {
      state.planError = `Plan nicht geladen: ${describe(error)}`;
      draw();
    }
  }
}

function describe(error: unknown): string {
  if (error instanceof MissingColumnsError) return `${error.message}. Die Kopfzeile im Sheet hat sich geändert.`;
  return error instanceof Error ? error.message : String(error);
}

function applyRows(rows: PlanRows): void {
  try {
    state.plan = parsePlan(rows.plan);
    state.settings = parsePlanSettings(rows.settings);
    state.planError = '';
  } catch (error) {
    state.plan = null;
    state.planError = error instanceof MissingColumnsError || error instanceof PlanError ? describe(error) : `Plan: ${describe(error)}`;
  }
  loadHistory();
  if (state.plan && (!state.tag || !state.plan.days.some((d) => d.tag === state.tag))) {
    const lastTag = latestTag();
    state.tag = defaultDay(state.plan, new Date(), lastTag)?.tag ?? null;
    state.session = null;
  }
  draw();
}

/** Letzte Einheit aus dem Sheet und den lokalen Sitzungen. */
function latestTag(): string | null {
  let best = state.history.latest;
  for (const session of Object.values(loadSessions())) {
    if (hasData(session) && (!best || session.date > best.date)) best = { date: session.date, tag: session.tag };
  }
  return best?.tag ?? null;
}

function loadHistory(): void {
  const rows = state.context.setRows();
  try {
    state.history = rows ? readLoggedHistory(rows, todayIso()) : { last: new Map(), latest: null };
  } catch {
    // Eine kaputte TrainingSets Tabelle meldet der Abschnitt Training, hier fehlt nur "Letztes Mal".
    state.history = { last: new Map(), latest: null };
  }
}

function currentDay(): PlanDay | null {
  return state.plan?.days.find((d) => d.tag === state.tag) ?? null;
}

function currentSession(day: PlanDay): Session {
  const id = sessionId(todayIso(), day.tag);
  state.session ??= loadSession(id) ?? newSession(todayIso(), day.tag);
  return state.session;
}

// ── Senden ───────────────────────────────────────────────────────────────────

function commit(day: PlanDay): void {
  const session = currentSession(day);
  const id = sessionId(session.date, session.tag);
  saveSession(id, session);
  window.clearTimeout(sendTimer);
  sendTimer = window.setTimeout(() => void runFlush(), SEND_DELAY_MS);
  refreshStatus?.();
}

async function runFlush(): Promise<void> {
  const access = getLogbookAccess();
  const plan = state.plan;
  if (!access || !plan || !navigator.onLine) {
    refreshStatus?.();
    return;
  }
  if (state.sending) {
    state.resend = true;
    return;
  }
  state.sending = true;
  refreshStatus?.();
  const outcome = await flushPending(access, new Map(plan.days.map((d) => [d.tag, d])));
  state.sending = false;
  state.sendError = outcome.error;
  if (outcome.sent > 0 && !outcome.error) state.sentAt = new Date();
  refreshStatus?.();
  if (state.resend) {
    state.resend = false;
    void runFlush();
  }
}

function statusText(day: PlanDay): string {
  const { done, total } = doneCount(currentSession(day), day);
  const parts = [`${done} von ${total} Sätzen`];
  const pending = Object.values(loadSessions()).filter((s) => s.pending && hasData(s)).length;
  if (!getLogbookAccess()) parts.push('kein Zugang');
  else if (!navigator.onLine) parts.push(pending ? 'offline, lokal gesichert' : 'offline');
  else if (state.sending) parts.push('sendet');
  else if (state.sendError && state.sendError !== NETWORK_ERROR) parts.push(`Fehler ${state.sendError}`);
  else if (state.sendError) parts.push('kein Netz, lokal gesichert');
  else if (pending) parts.push('wartet auf Senden');
  else if (state.sentAt) parts.push(`gesendet ${state.sentAt.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}`);
  return parts.join(' · ');
}

// ── Zeichnen ─────────────────────────────────────────────────────────────────

function chips(label: string, names: readonly string[], active: number, onPick: (index: number) => void): HTMLElement {
  return el('div', { class: 'chips', attrs: { role: 'group', 'aria-label': label } }, names.map((name, index) => {
    const chip = el('button', { class: 'chip', text: name, attrs: { type: 'button', 'aria-pressed': String(index === active) } });
    chip.addEventListener('click', () => onPick(index));
    return chip;
  }));
}

function draw(): void {
  if (!view) return;
  refreshStatus = null;
  if (state.planError) {
    view.replaceChildren(refusalCard('Plan', state.planError));
    return;
  }
  const plan = state.plan;
  if (!plan) {
    view.replaceChildren(el('div', { class: 'card-basis log-status', text: 'lädt' }));
    return;
  }
  const day = currentDay();
  if (!day) {
    view.replaceChildren(refusalCard('Plan', 'Keine Trainingstage im Tab Plan'));
    return;
  }

  const session = currentSession(day);
  const dayChips = chips('Trainingstag', plan.days.map((d) => d.tag), plan.days.indexOf(day), (index) => {
    state.tag = plan.days[index]!.tag;
    state.session = null;
    draw();
  });
  const status = el('div', { class: 'card-basis log-status', attrs: { role: 'status' } });
  refreshStatus = () => {
    status.textContent = statusText(day);
  };

  const cards = day.exercises.map((exercise, index) => exerciseCard(day, exercise, index, session));
  const general = generalTextFor(state.settings, day.label);
  const generalBox = general
    ? el('details', { class: 'lb-note', attrs: { ...(doneCount(session, day).done === 0 ? { open: '' } : {}) } }, [
      el('summary', { text: 'Aufwärmen allgemein' }),
      el('p', { text: general }),
    ])
    : null;
  view.replaceChildren(
    dayChips,
    el('div', { class: 'card-label logbook-day', text: day.label }),
    ...(generalBox ? [generalBox] : []),
    el('div', { class: 'stack' }, cards),
    status,
  );
  refreshStatus();
}

function lastFor(day: PlanDay, exercise: PlanExercise): LastSession | null {
  return state.history.last.get(exerciseKey(day.tag, exercise.name)) ?? null;
}

function lastText(exercise: PlanExercise, last: LastSession | null): string {
  if (last) {
    const [year, month, dayOfMonth] = last.date.split('-');
    void year;
    return `Letztes Mal ${dayOfMonth}.${month}.: ${last.sets.map((s) => `${formatKg(s.kg)} × ${s.reps}`).join(', ')}`;
  }
  if (exercise.lastLoad) return `Aus dem Plan: ${formatKg(exercise.lastLoad)} kg × ${exercise.lastReps || '–'}`;
  return 'Keine Daten';
}

function exerciseCard(day: PlanDay, exercise: PlanExercise, index: number, session: Session): HTMLElement {
  const sets = ensureSets(session, exercise);
  const last = lastFor(day, exercise);
  const doneSets = sets.filter((s) => s.done).length;

  const tags = [
    exercise.ss ? el('span', { class: 'mark is-ok', text: `Supersatz ${exercise.ss}` }) : null,
    el('span', { class: 'mark', text: exercise.muscle }),
    exercise.rest ? el('span', { class: 'mark', text: `Pause ${formatClock(exercise.rest)}` }) : null,
  ];
  const warmup = warmupLine(state.settings, day, index, last);
  const rangeFull = state.settings.rangeFullText && isRangeFull(exercise, last) ? state.settings.rangeFullText : '';
  const specs = [exercise.rir && `RIR ${exercise.rir}`, exercise.tempo && `Tempo ${exercise.tempo}`].filter(Boolean).join(', ');

  return el('div', { class: doneSets >= exercise.sets ? 'card log-card is-done' : 'card log-card', attrs: { id: `ex-${exercise.id}` } }, [
    el('div', { class: 'card-label', text: exercise.name }),
    el('div', { class: 'lb-tags' }, [...tags, el('span', { class: 'card-basis', text: `${doneSets}/${exercise.sets}` })]),
    specs ? el('div', { class: 'card-basis', text: specs }) : null,
    el('div', { class: 'card-basis', text: lastText(exercise, last) }),
    rangeFull ? el('div', { class: 'card-basis is-ok', text: rangeFull }) : null,
    warmup ? el('div', { class: 'card-basis', text: `Aufwärmen: ${warmup}` }) : null,
    el('div', { class: 'lb-sets' }, sets.map((set, k) => setRow(day, exercise, set, k, last))),
    exercise.tip ? el('details', { class: 'lb-note' }, [el('summary', { text: 'Hinweis' }), el('p', { text: exercise.tip })]) : null,
  ]);
}

/** Platzhalter aus dem letzten Mal, ohne Verlauf aus `lastLoad` des Plans. */
function placeholders(exercise: PlanExercise, index: number, last: LastSession | null): { kg: string; reps: string } {
  const previous = last ? (last.sets[index] ?? last.sets[last.sets.length - 1]) : null;
  if (previous) return { kg: formatKg(previous.kg), reps: String(previous.reps) };
  return { kg: isNumeric(exercise.lastLoad) ? formatKg(exercise.lastLoad) : '', reps: '' };
}

function setRow(day: PlanDay, exercise: PlanExercise, set: SetState, index: number, last: LastSession | null): HTMLElement {
  const range = rangeFor(exercise, index);
  const placeholder = placeholders(exercise, index, last);

  const kg = el('input', {
    class: 'lb-input',
    attrs: { type: 'text', inputmode: 'decimal', enterkeyhint: 'next', autocomplete: 'off', placeholder: placeholder.kg, 'aria-label': `Gewicht Satz ${index + 1}` },
  });
  kg.value = formatKg(set.kg);
  kg.addEventListener('input', () => {
    set.kg = kg.value.replace(',', '.');
    commit(day);
  });
  const reps = el('input', {
    class: 'lb-input',
    attrs: { type: 'text', inputmode: 'numeric', enterkeyhint: 'done', autocomplete: 'off', placeholder: placeholder.reps, 'aria-label': `Wiederholungen Satz ${index + 1}, Ziel ${range}` },
  });
  reps.value = set.reps;
  reps.addEventListener('input', () => {
    set.reps = reps.value;
    commit(day);
  });

  const check = el('button', {
    class: set.done ? 'lb-check is-on' : 'lb-check',
    text: set.done ? '✓' : '',
    attrs: { type: 'button', 'aria-pressed': String(set.done), 'aria-label': `Satz ${index + 1} erledigt` },
  });
  check.addEventListener('click', () => {
    unlockAudio();
    const wasDone = set.done;
    if (wasDone) set.done = false;
    else {
      // Ein leeres Feld nimmt den Platzhalter, wie im Logbuch.
      if (!set.kg && isNumeric(placeholder.kg)) set.kg = placeholder.kg.replace(',', '.');
      const suggestion = placeholder.reps || String(rangeTop(range) ?? '');
      if (!set.reps && suggestion) set.reps = suggestion;
      set.done = true;
    }
    commit(day);
    draw();
    if (!wasDone) afterCheck(day, exercise);
  });

  return el('div', { class: set.done ? 'lb-set is-on' : 'lb-set' }, [
    el('div', { class: 'lb-n', text: String(index + 1) }),
    el('label', { class: 'lb-field' }, [kg, el('span', { text: 'kg' })]),
    el('label', { class: 'lb-field' }, [reps, el('span', { class: 'lb-range', text: `Ziel ${range}` })]),
    check,
  ]);
}

export type { LogbookAccess };

/** Nach einem Haken: Supersatz Hinweis statt Pause, sonst Pausentimer. Dann zur naechsten offenen Uebung. */
function afterCheck(day: PlanDay, exercise: PlanExercise): void {
  const session = currentSession(day);
  if ((session.sets[exercise.id] ?? []).every((s) => s.done)) scrollToNextOpen(day, exercise);
  if (exercise.ss.startsWith('A')) {
    const partner = day.exercises.find((e) => e.ss === `B${exercise.ss.slice(1)}`);
    overlay?.stopTimer();
    overlay?.toast(`Weiter ohne Pause: ${partner?.name ?? 'B Übung'}`);
  } else if (exercise.rest) overlay?.startTimer(exercise.rest, exercise.name);
}

function scrollToNextOpen(day: PlanDay, exercise: PlanExercise): void {
  const session = currentSession(day);
  const from = day.exercises.indexOf(exercise);
  const next = day.exercises.slice(from + 1).find((e) => !(session.sets[e.id] ?? []).every((s) => s.done) || !session.sets[e.id]);
  if (!next) return;
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  document.getElementById(`ex-${next.id}`)?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
}
