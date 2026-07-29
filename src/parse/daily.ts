import type { DailyEntry, ParsedDaily, SheetRow, SheetValues, WeekBlock } from '../types';
import { num, parseDate } from './num';
import { cell, findHeaderRow, resolveColumns, type ColumnMap, type ColumnSpec } from './columns';

/**
 * Spalten des Tabs `Daily Tracking`.
 *
 * Die Notizspalte traegt keine Kopfzeile, sie wird ueber ihren Index gefunden.
 * Die beschriftete Spalte `Comments` wird in Phase 1 bewusst noch nicht gelesen,
 * weil das eine Verhaltensaenderung waere. Siehe Phase 2 der Roadmap.
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

/** Ermittelt die Spaltenzuordnung des Tabs. Wirft bei fehlender Pflichtspalte. */
export function resolveDailyColumns(rows: SheetValues): ColumnMap {
  const headerIndex = findHeaderRow(rows, HEADER_MARKERS);
  if (headerIndex < 0) {
    throw new Error('Kopfzeile im Daily Tracking nicht gefunden. Erwartet: Date, Weight, Calories.');
  }
  return resolveColumns(rows[headerIndex]!, DAILY_COLUMNS);
}

/**
 * Eine Datenzeile braucht ein gueltiges Datum und ein gueltiges Gewicht.
 *
 * PHASE 1: Verhalten unveraendert. Dass ein fehlendes Gewicht die gesamte Zeile
 * verwirft, kostet heute zwei Tage mit je 13 befuellten Feldern. Behebung in Phase 2.
 */
function isDataRow(row: SheetRow, columns: ColumnMap): boolean {
  const date = cell(row, columns, 'date');
  if (!date) return false;
  if (!parseDate(date)) return false;
  const weight = num(cell(row, columns, 'weight'));
  return weight !== null && !isNaN(weight);
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
    comment: read('note') ?? '',
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
 * Block steht dort das Wochenmittel selbst, nicht ein Delta.
 */
export function parseDaily(rows: SheetValues, columns?: ColumnMap): ParsedDaily {
  const cols = columns ?? resolveDailyColumns(rows);
  const daily: DailyEntry[] = [];
  const weekBlocks: WeekBlock[] = [];
  let currentWeek: DailyEntry[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;

    if (isDataRow(row, cols)) {
      const entry = toEntry(row, cols);
      daily.push(entry);
      currentWeek.push(entry);
      continue;
    }

    const label = (cell(row, cols, 'date') ?? '').toLowerCase();
    if (label === WEEK_AVERAGE_LABEL && currentWeek.length > 0) {
      const next = rows[i + 1];
      const nextLabel = (next ? (cell(next, cols, 'date') ?? '') : '').toLowerCase();
      const delta = nextLabel.startsWith(WEEK_DELTA_PREFIX) ? num(cell(next!, cols, 'weight')) : null;
      weekBlocks.push({ rows: [...currentWeek], avgWeight: num(cell(row, cols, 'weight')), delta });
      currentWeek = [];
    }
  }

  if (currentWeek.length > 0) weekBlocks.push({ rows: [...currentWeek], avgWeight: null, delta: null });
  return { daily, weekBlocks };
}
