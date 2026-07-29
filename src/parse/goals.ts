import type { SheetRow, SheetValues } from '../types';
import { num } from './num';

/**
 * Liest die Zielwerte aus dem Sheet.
 *
 * Die Vorgaben des Trainers stehen bereits dort, im Kopfbereich des Tabs
 * `Daily Tracking`: eine Beschriftungszeile mit `Day`, `Protein`, `Carbs`,
 * `Fat`, `Fiber`, `Calories`, `Proteinfeedings` und `Steps`, darunter je eine
 * Zeile fuer `High Day`, `Low Day` und `Average`.
 *
 * Die angestrebte Abnahmerate steht im Mesocycle Tab als `ROL - 0,25%`, also in
 * Prozent des Koerpergewichts pro Woche.
 *
 * Es wird nie stillschweigend mit einem Rueckfallwert gerechnet. Was nicht
 * gelesen werden konnte, steht in `missing` und wird in der Oberflaeche genannt.
 */

export interface DayGoals {
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  fiberG: number | null;
  caloriesKcal: number | null;
  proteinFeedings: number | null;
  steps: number | null;
}

export interface Goals {
  /** Wochenmittel, Grundlage aller Referenzlinien. */
  average: DayGoals;
  /** Trainingstag, kann von `average` abweichen. */
  highDay: DayGoals | null;
  /** Ruhetag, kann von `average` abweichen. */
  lowDay: DayGoals | null;
  /** Angestrebte Abnahme in Prozent des Koerpergewichts pro Woche. */
  rateOfLossPct: number | null;
  startWeightKg: number | null;
  heightCm: number | null;
  /** Was nicht aus dem Sheet gelesen werden konnte. */
  missing: string[];
}

/**
 * Rueckfallwerte.
 *
 * Sie entsprechen dem Stand von Mesocycle 1 und dienen nur dazu, dass die Seite
 * bei einem umgebauten Sheet nicht leer bleibt. Ihre Verwendung wird angezeigt.
 */
export const FALLBACK_GOALS: DayGoals = {
  proteinG: 200,
  carbsG: 225,
  fatG: 60,
  fiberG: 40,
  caloriesKcal: 2300.5,
  proteinFeedings: 4,
  steps: 10000,
};

/** Beschriftungen, an denen die Zeile mit den Zielwerten erkannt wird. */
const GOAL_HEADER_MARKERS = ['Day', 'Protein', 'Calories'] as const;

/** Zeilen des Vorgabeblocks, erkannt am Anfang der Beschriftung in Spalte B. */
const ROW_LABELS = { highDay: 'high day', lowDay: 'low day', average: 'average' } as const;

const LABEL_COLUMN = 1;

/** Feld zu Beschriftung. Die erste passende Spalte gewinnt. */
const FIELDS: readonly (readonly [keyof DayGoals, string])[] = [
  ['proteinG', 'Protein'],
  ['carbsG', 'Carbs'],
  ['fatG', 'Fat'],
  ['fiberG', 'Fiber'],
  ['caloriesKcal', 'Calories'],
  ['proteinFeedings', 'Proteinfeedings'],
  ['steps', 'Steps'],
];

/** So weit oben im Tab wird nach dem Vorgabeblock gesucht. */
const HEADER_SEARCH_ROWS = 40;

/** `ROL - 0,25%`, auch mit Punkt als Dezimaltrenner oder ohne Bindestrich. */
const ROL_PATTERN = /ROL\s*[-–]?\s*(\d+(?:[.,]\d+)?)\s*%/i;

/** So weit oben im Mesocycle Tab steht der Kopfbereich. */
const ROL_SEARCH_ROWS = 20;

function findGoalHeader(rows: SheetValues): number {
  const limit = Math.min(rows.length, HEADER_SEARCH_ROWS);
  for (let i = 0; i < limit; i++) {
    const row = rows[i];
    if (!row) continue;
    if ((row[LABEL_COLUMN] ?? '').trim() !== 'Day') continue;
    const labels = new Set(row.map((c) => (c ?? '').trim()));
    if (GOAL_HEADER_MARKERS.every((m) => labels.has(m))) return i;
  }
  return -1;
}

function readDayGoals(row: SheetRow, header: SheetRow): DayGoals {
  const result = {} as DayGoals;
  for (const [field, label] of FIELDS) {
    const index = header.findIndex((c) => (c ?? '').trim() === label);
    result[field] = index >= 0 ? num(row[index]) : null;
  }
  return result;
}

/** Wert rechts neben einer Beschriftung, etwa `Weight:` gefolgt von `92kg`. */
function labeledValue(rows: SheetValues, label: string, limit = HEADER_SEARCH_ROWS): string | null {
  for (let i = 0; i < Math.min(rows.length, limit); i++) {
    const row = rows[i];
    if (!row) continue;
    const at = row.findIndex((c) => (c ?? '').trim() === label);
    if (at < 0) continue;
    for (let c = at + 1; c < row.length; c++) {
      const value = (row[c] ?? '').trim();
      if (value) return value;
    }
  }
  return null;
}

export function parseRateOfLoss(rows: SheetValues): number | null {
  const limit = Math.min(rows.length, ROL_SEARCH_ROWS);
  for (let i = 0; i < limit; i++) {
    for (const cell of rows[i] ?? []) {
      const match = ROL_PATTERN.exec(cell ?? '');
      if (match) return parseFloat(match[1]!.replace(',', '.'));
    }
  }
  return null;
}

export function parseGoals(dailyRows: SheetValues, trainingRows: SheetValues = []): Goals {
  const missing: string[] = [];
  const headerIndex = findGoalHeader(dailyRows);

  if (headerIndex < 0) {
    missing.push('Vorgabeblock');
    return {
      average: { ...FALLBACK_GOALS },
      highDay: null,
      lowDay: null,
      rateOfLossPct: parseRateOfLoss(trainingRows),
      startWeightKg: null,
      heightCm: null,
      missing,
    };
  }

  const header = dailyRows[headerIndex]!;
  const found: Partial<Record<keyof typeof ROW_LABELS, DayGoals>> = {};

  for (let i = headerIndex + 1; i < Math.min(dailyRows.length, headerIndex + 20); i++) {
    const row = dailyRows[i];
    if (!row) continue;
    const label = (row[LABEL_COLUMN] ?? '').trim().toLowerCase();
    for (const [key, prefix] of Object.entries(ROW_LABELS)) {
      if (label.startsWith(prefix)) {
        found[key as keyof typeof ROW_LABELS] ??= readDayGoals(row, header);
      }
    }
  }

  const average = found.average ?? found.highDay ?? { ...FALLBACK_GOALS };
  if (!found.average) missing.push('Zeile Average');

  for (const [field] of FIELDS) {
    if (average[field] === null) {
      average[field] = FALLBACK_GOALS[field];
      missing.push(field);
    }
  }

  const rateOfLossPct = parseRateOfLoss(trainingRows);
  if (rateOfLossPct === null) missing.push('Rate of Loss');

  return {
    average,
    highDay: found.highDay ?? null,
    lowDay: found.lowDay ?? null,
    rateOfLossPct,
    startWeightKg: num(labeledValue(dailyRows, 'Weight:')),
    heightCm: num(labeledValue(dailyRows, 'Height:')),
    missing,
  };
}

/**
 * Sollrate in kg pro Woche, laufend aus dem aktuellen Gewicht.
 *
 * Der Trainer gibt in Prozent vor, damit die absolute Rate mit dem Gewicht
 * sinkt. Eine einmalig festgehaltene Kilogrammzahl waere nach einigen Wochen
 * falsch.
 */
export function targetRateKgPerWeek(rateOfLossPct: number | null, currentWeightKg: number | null): number | null {
  if (rateOfLossPct === null || currentWeightKg === null) return null;
  return -(currentWeightKg * rateOfLossPct) / 100;
}

/** True, wenn High Day und Low Day sich unterscheiden und getrennt gezeigt werden muessen. */
export function daysDiffer(goals: Goals): boolean {
  if (!goals.highDay || !goals.lowDay) return false;
  return FIELDS.some(([field]) => goals.highDay![field] !== goals.lowDay![field]);
}
