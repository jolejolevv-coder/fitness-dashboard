import type { Exercise, ExerciseWeek, ParsedTraining, SheetRow, SheetValues } from '../types';
import { cell, findHeaderRow, resolveColumns, type ColumnMap, type ColumnSpec } from './columns';
import { num, parseDate } from './num';
import { markImplausible, type ParsedLoad } from './load';
import { exerciseKey } from './training';

/**
 * Zerlegt den Tab `TrainingSets` der Logbuch Tabelle (Phase 18, ADR 0008).
 *
 * Eine Zeile je abgehaktem Satz: `id`, `date`, `tag`, `exercise`, `muscle`,
 * `set`, `kg`, `reps`. Das Ergebnis ist dasselbe Modell wie beim Mesocycle Tab,
 * damit Oberflaeche und Analytik unveraendert bleiben.
 *
 * * Woche: Kalenderwoche ab Montag, gezaehlt ab der Woche der ersten Einheit
 * * Schluessel: `tag||exercise`, derselbe Name an zwei Tagen bleibt getrennt
 * * Last: schwerster Satz der Woche
 * * Saetze und `repsActual` (`10-9-9`): aus der Einheit mit dem schwersten Satz
 * * Ein Satz zaehlt nur mit Zahl in `kg` und Wiederholungen ueber null
 */

const COLUMNS: readonly ColumnSpec[] = [
  { key: 'date', header: 'date', required: true },
  { key: 'tag', header: 'tag', required: true },
  { key: 'exercise', header: 'exercise', required: true },
  { key: 'kg', header: 'kg', required: true },
  { key: 'reps', header: 'reps', required: true },
  { key: 'muscle', header: 'muscle' },
  { key: 'set', header: 'set' },
];

const REQUIRED_HEADERS = COLUMNS.filter((c) => c.required).map((c) => c.header!);

/** Trennzeichen zwischen den Wiederholungen der Saetze, wie im Mesocycle Tab. */
const REPS_SEPARATOR = '-';

const DAYS_PER_WEEK = 7;
const MS_PER_DAY = 864e5;
/** `getDay()` liefert 0 fuer Sonntag, die Woche beginnt am Montag. */
const MONDAY_OFFSET = 6;

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

interface LoggedSet {
  date: Date;
  /** Datum als Text, trennt die Einheiten einer Woche. */
  session: string;
  day: string;
  name: string;
  muscle: string;
  order: number;
  kg: number;
  reps: number;
}

/**
 * Datum aus `date`. Das Script schreibt `YYYY-MM-DD`, das Sheet kann es je
 * nach Gebietsschema als `d.m.yyyy` anzeigen, beides wird gelesen.
 */
export function parseSetDate(raw: string | undefined): Date | null {
  const text = (raw ?? '').trim();
  const iso = ISO_DATE.exec(text);
  if (iso) {
    const date = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
    return Number.isNaN(date.getTime()) ? null : date;
  }
  return parseDate(text);
}

function mondayOf(date: Date): Date {
  const monday = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  monday.setDate(monday.getDate() - ((monday.getDay() + MONDAY_OFFSET) % DAYS_PER_WEEK));
  return monday;
}

/** Wochenindex ab der Woche der ersten Einheit. Gerundet wegen der Zeitumstellung. */
function weekIndex(date: Date, firstMonday: Date): number {
  const days = Math.round((mondayOf(date).getTime() - firstMonday.getTime()) / MS_PER_DAY);
  return Math.floor(days / DAYS_PER_WEEK);
}

function readSet(row: SheetRow, columns: ColumnMap, rowIndex: number): LoggedSet | null {
  const date = parseSetDate(cell(row, columns, 'date'));
  const day = (cell(row, columns, 'tag') ?? '').trim();
  const name = (cell(row, columns, 'exercise') ?? '').trim();
  const kg = num(cell(row, columns, 'kg'));
  const reps = num(cell(row, columns, 'reps'));
  if (!date || !day || !name || kg === null || reps === null || reps <= 0) return null;
  return {
    date,
    session: (cell(row, columns, 'date') ?? '').trim(),
    day,
    name,
    muscle: (cell(row, columns, 'muscle') ?? '').trim(),
    order: num(cell(row, columns, 'set')) ?? rowIndex,
    kg,
    reps,
  };
}

function emptyWeek(): ExerciseWeek {
  return { load: null, sets: 0, repsActual: '', loadRaw: '', uncertain: false, implausible: false };
}

/** Woche aus den Saetzen einer Uebung, Last aus dem schwersten Satz. */
function summarizeWeek(sets: readonly LoggedSet[]): ExerciseWeek {
  const heaviest = sets.reduce((top, set) => (set.kg > top.kg ? set : top));
  const session = sets
    .filter((set) => set.session === heaviest.session)
    .sort((a, b) => a.order - b.order);
  return {
    load: heaviest.kg,
    sets: session.length,
    repsActual: session.map((set) => String(set.reps)).join(REPS_SEPARATOR),
    loadRaw: String(heaviest.kg),
    uncertain: false,
    implausible: false,
  };
}

function loadOf(week: ExerciseWeek): ParsedLoad {
  return { kg: week.load, raw: week.loadRaw, kind: week.load === null ? 'empty' : 'plain', uncertain: false };
}

/**
 * Wirft `MissingColumnsError`, wenn eine Pflichtspalte fehlt. Ohne einen
 * einzigen gueltigen Satz kommt `null`, wie beim Mesocycle Tab ohne Daten.
 */
export function parseTrainingSets(rows: SheetValues): ParsedTraining | null {
  if (!rows.length) return null;
  const headerIndex = findHeaderRow(rows, REQUIRED_HEADERS);
  // Ohne passende Kopfzeile meldet resolveColumns die fehlenden Spalten der ersten Zeile.
  const columns = resolveColumns(rows[Math.max(headerIndex, 0)] ?? [], COLUMNS);

  const sets: LoggedSet[] = [];
  for (let i = headerIndex + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;
    const set = readSet(row, columns, i);
    if (set) sets.push(set);
  }
  if (!sets.length) return null;

  const firstMonday = mondayOf(sets.reduce((first, set) => (set.date < first ? set.date : first), sets[0]!.date));
  const weekCount = Math.max(...sets.map((set) => weekIndex(set.date, firstMonday))) + 1;

  const grouped = new Map<string, LoggedSet[][]>();
  for (const set of sets) {
    const key = exerciseKey(set.day, set.name);
    const weeks = grouped.get(key) ?? Array.from({ length: weekCount }, () => []);
    weeks[weekIndex(set.date, firstMonday)]!.push(set);
    grouped.set(key, weeks);
  }

  const exercises: Record<string, Exercise> = {};
  let currentWeek = 0;
  for (const [key, setsByWeek] of grouped) {
    const first = setsByWeek.find((week) => week.length)![0]!;
    const weeks = setsByWeek.map((week) => (week.length ? summarizeWeek(week) : emptyWeek()));
    const implausible = markImplausible(weeks.map(loadOf));
    weeks.forEach((week, index) => {
      week.implausible = implausible[index]!;
      if (week.load !== null) currentWeek = Math.max(currentWeek, index + 1);
    });
    exercises[key] = { key, name: first.name, day: first.day, muscleGroup: first.muscle, weeks };
  }

  return { exercises, weekCount, currentWeek, unparsableLoads: [] };
}

// ── Letztes Mal (Phase 20) ───────────────────────────────────────────────────

export interface LastSet {
  kg: number;
  reps: number;
}

/** Letzte Einheit einer Uebung an einem Trainingstag. */
export interface LastSession {
  /** `YYYY-MM-DD`. */
  date: string;
  sets: LastSet[];
}

export interface LoggedHistory {
  /** Schluessel `tag||exercise`, wie `exerciseKey`. */
  last: Map<string, LastSession>;
  /** Jüngste Einheit insgesamt, null ohne gueltigen Satz. */
  latest: { date: string; tag: string } | null;
}

function isoDate(date: Date): string {
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * Je Uebung und Tag die Saetze der juengsten Einheit, ohne die Einheit vom
 * Tag `exceptDate` (die laufende Einheit). Wirft `MissingColumnsError` wie
 * `parseTrainingSets`.
 */
export function readLoggedHistory(rows: SheetValues, exceptDate: string | null = null): LoggedHistory {
  const history: LoggedHistory = { last: new Map(), latest: null };
  if (!rows.length) return history;
  const headerIndex = findHeaderRow(rows, REQUIRED_HEADERS);
  const columns = resolveColumns(rows[Math.max(headerIndex, 0)] ?? [], COLUMNS);

  const byKey = new Map<string, { date: string; sets: LoggedSet[] }>();
  for (let i = headerIndex + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;
    const set = readSet(row, columns, i);
    if (!set) continue;
    const date = isoDate(set.date);
    if (date === exceptDate) continue;
    if (!history.latest || date > history.latest.date) history.latest = { date, tag: set.day };
    const key = exerciseKey(set.day, set.name);
    const entry = byKey.get(key);
    if (!entry || date > entry.date) byKey.set(key, { date, sets: [set] });
    else if (date === entry.date) entry.sets.push(set);
  }
  for (const [key, entry] of byKey) {
    const sets = [...entry.sets].sort((a, b) => a.order - b.order).map((s) => ({ kg: s.kg, reps: s.reps }));
    history.last.set(key, { date: entry.date, sets });
  }
  return history;
}
