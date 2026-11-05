import type { LastSession } from '../parse/trainingSets';
import type { Plan, PlanDay, PlanExercise } from '../parse/plan';

/**
 * Sitzung des Logbuch Formulars: Eingaben, lokale Ablage und Sendeformat.
 *
 * Das Format entspricht dem Recomp Logbuch (ADR 0010): `id` aus Datum und Tag,
 * `data` mit den Saetzen je Uebung, `rows` mit einer Zeile je abgehaktem Satz.
 */

const SESSIONS_KEY = 'fitness_logbook_sessions_v1';

/** Gesendete Sitzungen bleiben so viele Tage lokal liegen, dann fallen sie weg. */
export const KEEP_SENT_DAYS = 7;
const MS_PER_DAY = 864e5;

export interface SetState {
  /** Mit Punkt als Dezimaltrenner, wie im Logbuch. */
  kg: string;
  reps: string;
  done: boolean;
}

export interface Session {
  /** `YYYY-MM-DD`. */
  date: string;
  /** `Tag 1` bis `Tag n`. */
  tag: string;
  sets: Record<string, SetState[]>;
  updated: number;
  /** Seit der letzten erfolgreichen Uebertragung geaendert. */
  pending: boolean;
}

/** Zeile fuer `TrainingSets`: Datum, Tag, Uebung, Muskel, Satz, kg, Wdh. */
export type SetRow = [string, string, string, string, number, number | '', number | ''];

export function todayIso(now: Date = new Date()): string {
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** `2026-11-03_Tag-1`, die Kennung einer Einheit im Script. */
export function sessionId(date: string, tag: string): string {
  return `${date}_${tag.replace(' ', '-')}`;
}

// ── Ablage ───────────────────────────────────────────────────────────────────

function readAll(): Record<string, Session> {
  try {
    const raw = localStorage.getItem(SESSIONS_KEY);
    return raw ? (JSON.parse(raw) as Record<string, Session>) : {};
  } catch {
    return {};
  }
}

function writeAll(all: Record<string, Session>): void {
  try {
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(all));
  } catch {
    // Ein voller localStorage darf die Eingabe nicht anhalten.
  }
}

export function loadSession(id: string): Session | null {
  return readAll()[id] ?? null;
}

export function loadSessions(): Record<string, Session> {
  return readAll();
}

/**
 * Speichert die Sitzung und markiert sie als noch nicht gesendet. Das Objekt
 * selbst traegt danach Zeitstempel und Markierung, die Oberflaeche behaelt es.
 */
export function saveSession(id: string, session: Session, now: number = Date.now()): void {
  session.updated = now;
  session.pending = true;
  const all = readAll();
  all[id] = session;
  writeAll(all);
}

/**
 * Markiert die Sitzung als gesendet, aber nur, wenn sie sich seit dem Senden
 * nicht geaendert hat. Sonst bleibt sie offen und geht im naechsten Lauf raus.
 */
export function markSent(id: string, sentUpdated: number): boolean {
  const all = readAll();
  const session = all[id];
  if (!session || session.updated !== sentUpdated) return false;
  session.pending = false;
  writeAll(all);
  return true;
}

/** Entfernt gesendete Sitzungen, die aelter als `KEEP_SENT_DAYS` sind. Offene bleiben. */
export function pruneSessions(now: number = Date.now()): void {
  const all = readAll();
  let changed = false;
  for (const [id, session] of Object.entries(all)) {
    if (!session.pending && now - session.updated > KEEP_SENT_DAYS * MS_PER_DAY) {
      delete all[id];
      changed = true;
    }
  }
  if (changed) writeAll(all);
}

export function newSession(date: string, tag: string): Session {
  return { date, tag, sets: {}, updated: 0, pending: false };
}

/** Saetze einer Uebung, aufgefuellt auf die Satzzahl des Plans. */
export function ensureSets(session: Session, exercise: PlanExercise): SetState[] {
  const sets = session.sets[exercise.id] ?? [];
  while (sets.length < exercise.sets) sets.push({ kg: '', reps: '', done: false });
  session.sets[exercise.id] = sets;
  return sets;
}

export function hasData(session: Session): boolean {
  return Object.values(session.sets).some((sets) => sets.some((s) => s.kg || s.reps || s.done));
}

export function doneCount(session: Session, day: PlanDay): { done: number; total: number } {
  let done = 0;
  let total = 0;
  for (const exercise of day.exercises) {
    total += exercise.sets;
    done += (session.sets[exercise.id] ?? []).filter((s) => s.done).length;
  }
  return { done, total };
}

// ── Sendeformat ──────────────────────────────────────────────────────────────

function toNumber(raw: string, parse: (s: string) => number): number | '' {
  const value = parse(raw.replace(',', '.'));
  return Number.isFinite(value) && value !== 0 ? value : '';
}

/** Zeilen fuer `TrainingSets`, nur abgehakte Saetze, in Reihenfolge des Plans. */
export function buildRows(session: Session, day: PlanDay): SetRow[] {
  const rows: SetRow[] = [];
  for (const exercise of day.exercises) {
    (session.sets[exercise.id] ?? []).forEach((set, index) => {
      if (!set.done) return;
      rows.push([
        session.date, session.tag, exercise.name, exercise.muscle, index + 1,
        toNumber(set.kg, parseFloat), toNumber(set.reps, (s) => parseInt(s, 10)),
      ]);
    });
  }
  return rows;
}

// ── Tageswahl, Platzhalter, Range ────────────────────────────────────────────

/**
 * Vorgewaehlter Tag: der, dessen Label mit dem heutigen Wochentag beginnt
 * (`Montag · Upper A`). Sonst der Tag nach der letzten Einheit, ohne Einheit
 * der erste.
 */
export function defaultDay(plan: Plan, now: Date, lastTag: string | null): PlanDay | null {
  if (!plan.days.length) return null;
  const weekday = new Intl.DateTimeFormat('de-DE', { weekday: 'long' }).format(now);
  const byWeekday = plan.days.find((d) => d.label.startsWith(weekday));
  if (byWeekday) return byWeekday;
  const lastIndex = plan.days.findIndex((d) => d.tag === lastTag);
  return plan.days[(lastIndex + 1) % plan.days.length]!;
}

/** Ziel Range des Satzes `index`: Satz 1 nutzt `r1`, die weiteren `r2`, ohne `r2` auch `r1`. */
export function rangeFor(exercise: PlanExercise, index: number): string {
  return index === 0 || !exercise.r2 ? exercise.r1 : exercise.r2;
}

/** Obergrenze einer Range wie `6-9` oder `12`. */
export function rangeTop(range: string): number | null {
  const match = /(\d+)\s*$/.exec(range);
  return match ? Number(match[1]) : null;
}

/** Alle Saetze der letzten Einheit am oberen Ende der Range. */
export function isRangeFull(exercise: PlanExercise, last: LastSession | null): boolean {
  if (!last) return false;
  const first = rangeTop(exercise.r1);
  const further = rangeTop(exercise.r2) ?? first;
  if (first === null || last.sets.length < exercise.sets) return false;
  return last.sets.every((set, index) => set.reps >= (index === 0 ? first : further!));
}

/** Zahl fuer Anzeige mit Komma. */
export function formatKg(value: number | string): string {
  return String(value).replace('.', ',');
}

export function isNumeric(value: string): boolean {
  return /^\d+([.,]\d+)?$/.test(value.trim());
}

/** Teil `index` eines Planwerts wie `70 / 60` oder `10-9-9`, sonst der letzte Teil. */
function planPart(value: string, index: number, separator: RegExp): string {
  const parts = value.split(separator).map((part) => part.trim()).filter(Boolean);
  return parts[index] ?? parts[parts.length - 1] ?? '';
}

/**
 * Vorschlag fuer kg und Wdh eines Satzes. Erst das letzte Mal, dann der Plan
 * (`lastLoad`, `lastReps` je Satz), fuer Wdh zuletzt die Obergrenze der Range.
 */
export function setPlaceholders(
  exercise: PlanExercise,
  index: number,
  last: LastSession | null,
): { kg: string; reps: string } {
  const previous = last ? (last.sets[index] ?? last.sets[last.sets.length - 1]) : null;
  const fallbackReps = String(rangeTop(rangeFor(exercise, index)) ?? '');
  if (previous) {
    return { kg: formatKg(previous.kg), reps: String(previous.reps || fallbackReps) };
  }
  const planKg = planPart(exercise.lastLoad, index, /\//);
  const planReps = planPart(exercise.lastReps, index, /[/-]/);
  return {
    kg: isNumeric(planKg) ? formatKg(planKg) : '',
    reps: isNumeric(planReps) ? planReps : fallbackReps,
  };
}
