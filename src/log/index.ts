import type { LogAccess } from '../config/logAccess';
import type { SheetValues } from '../types';
import { el } from '../ui/build';
import { refusalCard } from '../ui/cards';
import { clearDraft, draftKey, entryKey, loadDraft, LOG_FIELDS, saveField, type LogField } from './draft';
import { buildEntries, isLocked, MAX_LENGTH, sendLog, type EntryResult } from './send';
import { firstOpenWeek, readLogTab, type LogExercise, type LogTab } from './tab';

/**
 * Segment `Eintragen` unter Training, als nachgeladener Chunk `log`.
 *
 * Oben Woche und Tag als Chips, je Uebung eine Karte mit Soll und den Feldern
 * `Load`, `Reps Ist`, `Notes`. Belegte Zellen sind gesperrt. Eingaben liegen
 * sofort im Entwurf, `Senden` schickt alle gefuellten Felder des Tags.
 */

export interface LogContext {
  rows: SheetValues;
  sheet: string;
  access: LogAccess;
  /** Laedt die Sheet Daten neu, danach zeichnet die App das Segment neu. */
  reload: () => Promise<void>;
}

const FIELD_LABELS: Readonly<Record<LogField, string>> = { load: 'Load', repsActual: 'Reps Ist', notes: 'Notes' };

/** Rueckmeldung des Scripts je Feld, als Kapsel neben dem Feld. */
const STATUS_TEXT: Readonly<Record<string, string>> = { written: 'geschrieben', occupied: 'belegt' };

interface Selection { day: number; week: number }

/** Bleibt ueber das Neuzeichnen nach dem Senden erhalten, je Tab. */
const selections = new Map<string, Selection>();
const results = new Map<string, EntryResult[]>();
let message = '';
let sending = false;
let refreshStatus: (() => void) | null = null;

window.addEventListener('online', () => refreshStatus?.());
window.addEventListener('offline', () => refreshStatus?.());

export function renderLog(container: HTMLElement, context: LogContext): void {
  const tab = readLogTab(context.rows);
  if (!tab || !tab.days.length) {
    container.replaceChildren(refusalCard('Eintragen', `Keine Wochenblöcke in ${context.sheet}`));
    return;
  }

  const selection = selections.get(context.sheet) ?? { day: 0, week: firstOpenWeek(tab.days[0]!) };
  selections.set(context.sheet, selection);
  draw(container, context, tab, selection);
}

function draw(container: HTMLElement, context: LogContext, tab: LogTab, selection: Selection): void {
  const day = tab.days[selection.day]!;
  const exercises = day.weeks[selection.week];
  const key = draftKey(context.sheet, selection.week + 1, day.label);
  const redraw = () => draw(container, context, tab, selection);

  const weekChips = chips('Woche', Array.from({ length: day.weeks.length }, (_, i) => `W${i + 1}`), selection.week, (index) => {
    selection.week = index;
    message = '';
    redraw();
  });
  const dayChips = chips('Trainingstag', tab.days.map((d) => d.label), selection.day, (index) => {
    selection.day = index;
    selection.week = firstOpenWeek(tab.days[index]!);
    message = '';
    redraw();
  });

  if (!exercises || !exercises.length) {
    container.replaceChildren(weekChips, dayChips, refusalCard(`W${selection.week + 1}`, 'Keine Spalten Load und Reps'));
    return;
  }

  const status = el('div', { class: 'card-basis log-status' });
  const button = el('button', { class: 'btn-primary', text: 'Senden', attrs: { type: 'button' } });
  const updateStatus = () => {
    const pending = buildEntries(exercises, loadDraft(key));
    const fields = pending.reduce((sum, entry) => sum + LOG_FIELDS.filter((f) => entry[f] !== undefined).length, 0);
    const offline = !navigator.onLine;
    button.disabled = offline || sending || fields === 0;
    status.textContent = offline ? 'offline' : message || `${fields} ${fields === 1 ? 'Feld' : 'Felder'} im Entwurf`;
  };
  refreshStatus = updateStatus;

  button.addEventListener('click', () => {
    void submit(context, key, exercises, selection.week + 1, day.label, updateStatus);
  });

  const cards = exercises.map((exercise) => exerciseCard(exercise, key, results.get(key), updateStatus));
  container.replaceChildren(weekChips, dayChips, el('div', { class: 'stack' }, cards), button, status);
  updateStatus();
}

function chips(label: string, names: readonly string[], active: number, onPick: (index: number) => void): HTMLElement {
  return el('div', { class: 'chips', attrs: { role: 'group', 'aria-label': label } }, names.map((name, index) => {
    const chip = el('button', { class: 'chip', text: name, attrs: { type: 'button', 'aria-pressed': String(index === active) } });
    chip.addEventListener('click', () => onPick(index));
    return chip;
  }));
}

/** Soll in zwei Zeilen, leere Teile fallen weg. */
function targetLines(exercise: LogExercise): string[] {
  const volume = [exercise.sets && `${exercise.sets} Sätze`, exercise.repsTarget && `${exercise.repsTarget} Reps`].filter(Boolean);
  const effort = [exercise.rir && `RIR ${exercise.rir}`, exercise.tempo && `Tempo ${exercise.tempo}`].filter(Boolean);
  return [volume.join(', '), effort.join(', ')].filter(Boolean);
}

function exerciseCard(exercise: LogExercise, key: string, sent: EntryResult[] | undefined, onChange: () => void): HTMLElement {
  const entry = entryKey(exercise.name, exercise.occurrence);
  const draft = loadDraft(key)[entry] ?? {};
  const result = sent?.find((r) => r.exercise === exercise.name && r.occurrence === exercise.occurrence);

  const lines = targetLines(exercise);
  if (exercise.occurrence > 1) lines.push(`Zeile ${exercise.occurrence}`);

  const fields = LOG_FIELDS.filter((field) => exercise[field] !== null).map((field) => {
    const locked = isLocked(exercise, field);
    const input = el('input', {
      attrs: { type: 'text', maxlength: String(MAX_LENGTH[field]), autocomplete: 'off', enterkeyhint: 'next' },
    });
    if (field !== 'notes') input.setAttribute('inputmode', field === 'load' ? 'decimal' : 'text');
    input.value = locked ? (exercise[field] ?? '') : (draft[field] ?? '');
    input.disabled = locked;
    input.addEventListener('input', () => {
      saveField(key, entry, field, input.value);
      onChange();
    });

    const feedback = result?.status?.[field] ?? (result?.error && !locked ? result.error : undefined);
    return el('label', { class: field === 'notes' ? 'log-field is-wide' : 'log-field' }, [
      el('span', { class: 'log-field-name', text: FIELD_LABELS[field] }),
      input,
      feedback ? el('span', { class: `mark ${feedback === 'written' ? 'is-ok' : 'is-off'}`, text: STATUS_TEXT[feedback] ?? feedback }) : null,
    ]);
  });

  return el('div', { class: 'card log-card' }, [
    el('div', { class: 'card-label', text: exercise.name }),
    ...lines.map((text) => el('div', { class: 'card-basis', text })),
    el('div', { class: 'log-fields' }, fields),
  ]);
}

async function submit(
  context: LogContext,
  key: string,
  exercises: readonly LogExercise[],
  week: number,
  day: string,
  updateStatus: () => void,
): Promise<void> {
  const entries = buildEntries(exercises, loadDraft(key));
  if (!entries.length || sending) return;
  sending = true;
  message = 'sendet';
  updateStatus();

  try {
    const response = await sendLog(context.access, {
      token: context.access.token, action: 'training', sheet: context.sheet, week, day, entries,
    });
    if (!response.readable) {
      // Antwort nicht lesbar: nach dem Neuladen zeigt der Tab selbst, was steht.
      // Der Entwurf bleibt, belegte Felder werden ohnehin nicht mehr gesendet.
      message = 'gesendet, Antwort nicht lesbar';
    } else if (!response.ok) {
      message = response.error;
    } else {
      results.set(key, response.results);
      forgetSent(key, response.results);
      const counts = countStatus(response.results);
      message = `${counts.written} geschrieben, ${counts.occupied} belegt`;
    }
  } catch {
    message = 'Senden fehlgeschlagen';
  } finally {
    sending = false;
  }

  updateStatus();
  if (message !== 'Senden fehlgeschlagen') await context.reload();
}

/** Geschriebene und belegte Felder verlassen den Entwurf, Fehler bleiben drin. */
function forgetSent(key: string, sent: readonly EntryResult[]): void {
  for (const result of sent) {
    for (const field of LOG_FIELDS) {
      const status = result.status?.[field];
      if (status === 'written' || status === 'occupied') saveField(key, entryKey(result.exercise, result.occurrence), field, '');
    }
  }
  if (sent.every((r) => !r.error)) clearDraft(key);
}

function countStatus(sent: readonly EntryResult[]): { written: number; occupied: number } {
  let written = 0;
  let occupied = 0;
  for (const result of sent) {
    for (const status of Object.values(result.status ?? {})) {
      if (status === 'written') written++;
      if (status === 'occupied') occupied++;
    }
  }
  return { written, occupied };
}
