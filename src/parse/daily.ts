import type { DailyEntry, ParsedDaily, SheetRow, SheetValues, WeekBlock } from '../types';
import { num, parseDate } from './num';
import { cell, findHeaderRow, resolveColumns, type ColumnMap, type ColumnSpec } from './columns';

/**
 * Spalten des Tabs `Daily Tracking`.
 *
 * Notizen stehen an zwei Stellen. Die Spalte `L` traegt keine Kopfzeile und wird
 * ueber ihren Index gefunden, die Spalte `AC` ist als `Comments` beschriftet.
 * Beide werden gelesen, vorher nur `L`.
 */
export const DAILY_COLUMNS: readonly ColumnSpec[] = [
  { key: 'date', header: 'Date', required: true },
  { key: 'weight', header: 'Weight', required: true },
  { key: 'time', header: 'Time' },
  { key: 'protein', header: 'Protein' },
  { key: 'carbs', header: 'Carbs' },
  { key: 'fat', header: 'Fat' },
  { key: 'fiber', header: 'Fiber' },
  { key: 'fv', header: 'Fruits & Vegetables' },
  { key: 'calories', header: 'Calories' },
  { key: 'note', fallbackIndex: 11 },
  { key: 'comments', header: 'Comments' },
  { key: 'sleep', header: 'Sleep' },
  { key: 'sleepQ', fallbackIndex: 13 },
  { key: 'digestion', header: 'Verdauung' },
  { key: 'stress', header: 'Stress' },
  { key: 'energy', header: 'Energylevel' },
  { key: 'steps', header: 'Steps' },
  { key: 'training', header: 'Trainingday' },
];

const HEADER_MARKERS = ['Date', 'Weight', 'Calories'] as const;

const WEEK_AVERAGE_LABEL = 'durchschnitt';
const WEEK_DELTA_PREFIX = 'gewicht';

/** Spalten, von denen mindestens eine befuellt sein muss, damit eine Zeile ein Tag ist. */
const CONTENT_KEYS = [
  'weight', 'protein', 'carbs', 'fat', 'fiber', 'fv', 'calories',
  'sleep', 'sleepQ', 'digestion', 'stress', 'energy', 'steps', 'training',
  'note', 'comments',
] as const;

/** Trennzeichen, wenn ein Tag Notizen in beiden Spalten traegt. */
const NOTE_SEPARATOR = ' · ';

export function resolveDailyColumns(rows: SheetValues): ColumnMap {
  const headerIndex = findHeaderRow(rows, HEADER_MARKERS);
  if (headerIndex < 0) {
    throw new Error('Kopfzeile im Daily Tracking nicht gefunden. Erwartet: Date, Weight, Calories.');
  }
  return resolveColumns(rows[headerIndex]!, DAILY_COLUMNS);
}

/**
 * Eine Zeile ist ein Tag, wenn sie ein gueltiges Datum und mindestens einen
 * befuellten Wert traegt.
 *
 * PHASE 2: das Gewicht ist keine Bedingung mehr. Vorher verwarf ein `?` in der
 * Gewichtsspalte die gesamte Zeile. Am 25. und 26.06.2026 gingen dadurch je 13
 * befuellte Felder verloren.
 *
 * Zeilen mit einem Datum in der Zukunft sind Planung, keine Daten, und bleiben
 * aussen vor.
 */
function isDataRow(row: SheetRow, columns: ColumnMap, now: Date): boolean {
  const date = parseDate(cell(row, columns, 'date'));
  if (!date) return false;
  if (date > now) return false;
  return CONTENT_KEYS.some((key) => {
    const value = cell(row, columns, key);
    return value !== undefined && value.trim() !== '';
  });
}

function combineNotes(row: SheetRow, columns: ColumnMap): string {
  const parts = [cell(row, columns, 'note'), cell(row, columns, 'comments')]
    .map((v) => (v ?? '').trim())
    .filter((v) => v !== '' && v !== '-');
  return parts.join(NOTE_SEPARATOR);
}

function toEntry(row: SheetRow, columns: ColumnMap): DailyEntry {
  const read = (key: string): string | undefined => cell(row, columns, key);
  return {
    date: read('date') ?? '',
    dateObj: parseDate(read('date')),
    weight: num(read('weight')),
    time: read('time') ?? '',
    protein: num(read('protein')),
    carbs: num(read('carbs')),
    fat: num(read('fat')),
    fiber: num(read('fiber')),
    fv: num(read('fv')),
    calories: num(read('calories')),
    comment: combineNotes(row, columns),
    sleep: num(read('sleep')),
    sleepQ: num(read('sleepQ')),
    digestion: num(read('digestion')),
    stress: num(read('stress')),
    energy: num(read('energy')),
    steps: num(read('steps')),
    training: read('training') ?? '',
  };
}

/**
 * Zerlegt den Tab in Tageseintraege und Wochenbloecke.
 *
 * Wochenbloecke werden durch die Zeile `Durchschnitt` abgeschlossen. Die darauf
 * folgende Zeile `Gewichtsveraenderung` traegt das Delta zur Vorwoche. Im ersten
 * Block steht dort das Wochenmittel selbst, nicht ein Delta, deshalb wird das
 * Delta des ersten Blocks verworfen.
 */
export function parseDaily(rows: SheetValues, columns?: ColumnMap, now: Date = new Date()): ParsedDaily {
  const cols = columns ?? resolveDailyColumns(rows);
  const daily: DailyEntry[] = [];
  const weekBlocks: WeekBlock[] = [];
  let currentWeek: DailyEntry[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;

    if (isDataRow(row, cols, now)) {
      const entry = toEntry(row, cols);
      daily.push(entry);
      currentWeek.push(entry);
      continue;
    }

    const label = (cell(row, cols, 'date') ?? '').toLowerCase();
    if (label === WEEK_AVERAGE_LABEL && currentWeek.length > 0) {
      const next = rows[i + 1];
      const nextLabel = (next ? (cell(next, cols, 'date') ?? '') : '').toLowerCase();
      const isFirstBlock = weekBlocks.length === 0;
      const delta = !isFirstBlock && nextLabel.startsWith(WEEK_DELTA_PREFIX)
        ? num(cell(next!, cols, 'weight'))
        : null;
      weekBlocks.push({ rows: [...currentWeek], avgWeight: num(cell(row, cols, 'weight')), delta });
      currentWeek = [];
    }
  }

  if (currentWeek.length > 0) weekBlocks.push({ rows: [...currentWeek], avgWeight: null, delta: null });
  return { daily, weekBlocks };
}
