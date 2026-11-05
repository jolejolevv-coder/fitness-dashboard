import type { SheetValues } from '../types';
import { cell, findHeaderRow, resolveColumns, type ColumnSpec } from './columns';
import { num } from './num';

/**
 * Trainingsplan aus den Tabs `Plan` und `PlanSettings` der Logbuch Tabelle
 * (Phase 20, ADR 0010).
 *
 * `Plan`: eine Zeile je Uebung, Spalten ueber die Kopfzeile. Tage in der
 * Reihenfolge ihres ersten Auftretens. `PlanSettings`: Schluessel und Wert,
 * Aufwaermstufen, Lastschritt, Regionen und Texte. Ein fehlender Schluessel
 * schaltet nur die jeweilige Funktion ab.
 */

const PLAN_COLUMNS: readonly ColumnSpec[] = [
  { key: 'tag', header: 'tag', required: true },
  { key: 'label', header: 'label', required: true },
  { key: 'id', header: 'id', required: true },
  { key: 'exercise', header: 'exercise', required: true },
  { key: 'muscle', header: 'muscle', required: true },
  { key: 'sets', header: 'sets', required: true },
  { key: 'r1', header: 'r1', required: true },
  { key: 'r2', header: 'r2', required: true },
  { key: 'rir', header: 'rir', required: true },
  { key: 'tempo', header: 'tempo', required: true },
  { key: 'rest', header: 'rest', required: true },
  { key: 'ss', header: 'ss', required: true },
  { key: 'lastLoad', header: 'lastLoad', required: true },
  { key: 'tip', header: 'tip', required: true },
  { key: 'typ', header: 'typ' },
  { key: 'lastReps', header: 'lastReps' },
  { key: 'kind', header: 'kind' },
];

const PLAN_REQUIRED_HEADERS = ['tag', 'exercise'];

/** Platzhalter fuer eine leere Range in der Spalte `r2`. */
const NO_RANGE = '-';

export interface PlanExercise {
  id: string;
  name: string;
  muscle: string;
  type: string;
  sets: number;
  /** Ziel Range des ersten Satzes, etwa `6-9`. */
  r1: string;
  /** Ziel Range der weiteren Saetze. Leer, wenn `r1` fuer alle gilt. */
  r2: string;
  rir: string;
  tempo: string;
  /** Pause in Sekunden, null ohne Angabe. */
  rest: number | null;
  /** Supersatz Kennung wie `A1` oder `B1`, leer ohne Supersatz. */
  ss: string;
  lastLoad: string;
  lastReps: string;
  tip: string;
  kind: string;
}

export interface PlanDay {
  tag: string;
  label: string;
  exercises: PlanExercise[];
}

export interface Plan {
  days: PlanDay[];
}

export class PlanError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PlanError';
  }
}

function text(row: readonly string[], columns: Readonly<Record<string, number>>, key: string): string {
  return (cell(row, columns, key) ?? '').trim();
}

/**
 * Wirft `MissingColumnsError` bei fehlender Spalte und `PlanError` bei einer
 * Zeile, deren Satzzahl keine Zahl ueber null ist. Leere Zeilen werden uebergangen.
 */
export function parsePlan(rows: SheetValues): Plan {
  const headerIndex = findHeaderRow(rows, PLAN_REQUIRED_HEADERS);
  const columns = resolveColumns(rows[Math.max(headerIndex, 0)] ?? [], PLAN_COLUMNS);

  const days: PlanDay[] = [];
  for (let i = headerIndex + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;
    const tag = text(row, columns, 'tag');
    const name = text(row, columns, 'exercise');
    if (!tag || !name) continue;

    const sets = num(cell(row, columns, 'sets'));
    if (sets === null || sets <= 0 || !Number.isInteger(sets)) {
      throw new PlanError(`Plan Zeile ${i + 1}: Sätze von ${name} sind keine Zahl`);
    }

    let day = days.find((d) => d.tag === tag);
    if (!day) {
      day = { tag, label: text(row, columns, 'label') || tag, exercises: [] };
      days.push(day);
    }
    const r2 = text(row, columns, 'r2');
    day.exercises.push({
      id: text(row, columns, 'id') || name,
      name,
      muscle: text(row, columns, 'muscle'),
      type: text(row, columns, 'typ'),
      sets,
      r1: text(row, columns, 'r1'),
      r2: r2 === NO_RANGE ? '' : r2,
      rir: text(row, columns, 'rir'),
      tempo: text(row, columns, 'tempo'),
      rest: num(cell(row, columns, 'rest')),
      ss: text(row, columns, 'ss'),
      lastLoad: text(row, columns, 'lastLoad'),
      lastReps: text(row, columns, 'lastReps'),
      tip: text(row, columns, 'tip'),
      kind: text(row, columns, 'kind'),
    });
  }
  return { days };
}

// ── PlanSettings ─────────────────────────────────────────────────────────────

/** Eine Aufwaermstufe: Anteil des Arbeitsgewichts und Wiederholungen. */
export interface WarmupStep {
  factor: number;
  reps: number;
}

export interface PlanSettings {
  /** Stufen vor dem ersten Satz des Tages. Leer: Funktion aus. */
  warmupFirst: WarmupStep[];
  /** Stufe bei einer neuen Muskelregion. Null: Funktion aus. */
  warmupRegion: WarmupStep | null;
  /** Rundung der Aufwaermgewichte in kg. Null: Aufwaermgewichte aus. */
  loadStep: number | null;
  /** Regionen ohne Aufwaermen. */
  noWarmupRegions: string[];
  /** Allgemeine Hinweise je Tagestyp, Schluessel ist der Teil hinter `general_`. */
  general: Record<string, string>;
  /** Text bei voller Range. Null: kein Hinweis. */
  rangeFullText: string | null;
  /** Muskel zu Region. */
  regions: Record<string, string>;
}

const GENERAL_PREFIX = 'general_';
const REGION_PREFIX = 'region_';
const STEP_PATTERN = /^(\d+(?:[.,]\d+)?)\s*[x×]\s*(\d+)$/i;
const LIST_SEPARATOR = ',';

/** `0.5x8` oder `0,75 x 3`. Alles andere ist keine Stufe. */
export function parseWarmupStep(raw: string): WarmupStep | null {
  const match = STEP_PATTERN.exec(raw.trim());
  if (!match) return null;
  const factor = Number(match[1]!.replace(',', '.'));
  const reps = Number(match[2]);
  return factor > 0 && reps > 0 ? { factor, reps } : null;
}

function parseSteps(raw: string): WarmupStep[] {
  const steps = raw.split(LIST_SEPARATOR).map(parseWarmupStep);
  // Eine kaputte Stufe schaltet die ganze Zeile ab, statt eine halbe Folge zu zeigen.
  return steps.every((s): s is WarmupStep => s !== null) ? (steps as WarmupStep[]) : [];
}

export function parsePlanSettings(rows: SheetValues): PlanSettings {
  const settings: PlanSettings = {
    warmupFirst: [],
    warmupRegion: null,
    loadStep: null,
    noWarmupRegions: [],
    general: {},
    rangeFullText: null,
    regions: {},
  };
  for (const row of rows) {
    const key = (row[0] ?? '').trim();
    const value = (row[1] ?? '').trim();
    if (!key || !value) continue;
    if (key === 'warmup_first') settings.warmupFirst = parseSteps(value);
    else if (key === 'warmup_region') settings.warmupRegion = parseSteps(value)[0] ?? null;
    else if (key === 'load_step') {
      const step = num(value);
      settings.loadStep = step !== null && step > 0 ? step : null;
    } else if (key === 'no_warmup_region') {
      settings.noWarmupRegions = value.split(LIST_SEPARATOR).map((r) => r.trim()).filter(Boolean);
    } else if (key === 'range_full_text') settings.rangeFullText = value;
    else if (key.startsWith(GENERAL_PREFIX)) settings.general[key.slice(GENERAL_PREFIX.length)] = value;
    else if (key.startsWith(REGION_PREFIX)) settings.regions[key.slice(REGION_PREFIX.length)] = value;
  }
  return settings;
}

/** Allgemeiner Hinweis des Tages: der Schluessel, dessen Name im Tageslabel vorkommt. */
export function generalTextFor(settings: PlanSettings, dayLabel: string): string | null {
  const key = Object.keys(settings.general).find((k) => dayLabel.includes(k));
  return key ? settings.general[key]! : null;
}
