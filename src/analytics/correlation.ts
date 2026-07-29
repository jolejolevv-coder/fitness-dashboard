import type { DailyEntry } from '../types';
import { avg } from './smoothing';
import { pearson, type Point } from './regression';
import { parseTrainingMarker } from '../parse/trainingday';
import { smoothedWeightSeries } from './trend';
import { type Insight, refuse } from './result';

/**
 * Zusammenhaenge zwischen Gewohnheiten und Befinden.
 *
 * Alle Angaben sind Zusammenhaenge, keine Ursachen. Das steht so auch in der
 * Oberflaeche, weil ein Pearson r ohne diesen Hinweis regelmaessig als Beleg
 * gelesen wird.
 */

/** Unter dieser Anzahl Paare wird keine Korrelation ausgegeben. */
export const MIN_CORRELATION_PAIRS = 20;

/** Groesster Abstand in Tagen, damit zwei Zeilen noch als Folgetage gelten. */
const MAX_GAP_DAYS = 2;

const MS_PER_DAY = 864e5;

type Picker = (entry: DailyEntry) => number | null;

function sortedByDate(entries: readonly DailyEntry[]): DailyEntry[] {
  return [...entries]
    .filter((e) => e.dateObj)
    .sort((a, b) => a.dateObj!.getTime() - b.dateObj!.getTime());
}

/**
 * Wertepaare, optional mit einem Tag Versatz.
 *
 * Bei `lagDays` gleich 1 wird der Wert des Folgetags genommen, aber nur wenn er
 * wirklich am Folgetag liegt. Fehlende Tage duerfen nicht ueberbrueckt werden.
 */
export function pairs(
  entries: readonly DailyEntry[],
  pickX: Picker,
  pickY: Picker,
  lagDays = 0,
): Point[] {
  const sorted = sortedByDate(entries);
  const result: Point[] = [];

  for (let i = 0; i < sorted.length - lagDays; i++) {
    const from = sorted[i]!;
    const to = sorted[i + lagDays]!;
    if (lagDays > 0) {
      const gap = (to.dateObj!.getTime() - from.dateObj!.getTime()) / MS_PER_DAY;
      if (gap < 1 || gap > MAX_GAP_DAYS) continue;
    }
    const x = pickX(from);
    const y = pickY(to);
    if (x === null || y === null) continue;
    result.push({ x, y });
  }

  return result;
}

export interface CorrelationResult {
  key: string;
  label: string;
  r: number;
  n: number;
}

interface Definition {
  key: string;
  label: string;
  x: Picker;
  y: Picker;
  lag: number;
}

const DEFINITIONS: readonly Definition[] = [
  { key: 'sleep-energy', label: 'Schlafdauer und Energie am Folgetag', x: (e) => e.sleep, y: (e) => e.energy, lag: 1 },
  { key: 'sleepq-energy', label: 'Schlafqualitaet und Energie am Folgetag', x: (e) => e.sleepQ, y: (e) => e.energy, lag: 1 },
  { key: 'stress-sleep', label: 'Stress und Schlafdauer derselben Nacht', x: (e) => e.stress, y: (e) => e.sleep, lag: 0 },
  { key: 'calories-energy', label: 'Kalorien und Energie am Folgetag', x: (e) => e.calories, y: (e) => e.energy, lag: 1 },
  { key: 'steps-energy', label: 'Schritte und Energie am Folgetag', x: (e) => e.steps, y: (e) => e.energy, lag: 1 },
];

/** Vorlauf in Tagen, ueber den die Wirkung von Schritten auf das Gewicht gemessen wird. */
const STEPS_LOOKAHEAD_DAYS = 7;

/**
 * Schritte gegen die Gewichtsveraenderung der folgenden Woche.
 *
 * Braucht eine eigene Paarbildung, weil die Zielgroesse nicht in einer Spalte
 * steht, sondern aus dem geglaetteten Verlauf stammt: der Wert sieben Tage
 * spaeter minus der Wert am Tag selbst.
 */
function stepsAgainstWeightChange(entries: readonly DailyEntry[]): Point[] {
  // Tagesschluessel ohne Uhrzeit, ohne das uebergebene Datum zu veraendern.
  const dayKey = (date: Date): number => Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());

  const smoothed = new Map<number, number>();
  for (const point of smoothedWeightSeries(entries)) {
    smoothed.set(dayKey(point.date), point.value);
  }

  const result: Point[] = [];
  for (const entry of sortedByDate(entries)) {
    if (entry.steps === null) continue;
    const from = smoothed.get(dayKey(entry.dateObj!));
    const to = smoothed.get(dayKey(new Date(entry.dateObj!.getTime() + STEPS_LOOKAHEAD_DAYS * MS_PER_DAY)));
    if (from === undefined || to === undefined) continue;
    result.push({ x: entry.steps, y: to - from });
  }
  return result;
}

export interface Correlations {
  found: CorrelationResult[];
  /** Paare, fuer die die Datenbasis nicht reicht, mit Grund. */
  skipped: { label: string; reason: string }[];
}

export function correlations(entries: readonly DailyEntry[]): Correlations {
  const found: CorrelationResult[] = [];
  const skipped: { label: string; reason: string }[] = [];

  const stepsPoints = stepsAgainstWeightChange(entries);
  const stepsLabel = `Schritte und Gewichtsaenderung der folgenden ${STEPS_LOOKAHEAD_DAYS} Tage`;
  if (stepsPoints.length < MIN_CORRELATION_PAIRS) {
    skipped.push({ label: stepsLabel, reason: `${stepsPoints.length} von ${MIN_CORRELATION_PAIRS} Paaren` });
  } else {
    const r = pearson(stepsPoints);
    if (r === null) skipped.push({ label: stepsLabel, reason: 'Werte ohne Streuung' });
    else found.push({ key: 'steps-weight', label: stepsLabel, r, n: stepsPoints.length });
  }

  for (const definition of DEFINITIONS) {
    const points = pairs(entries, definition.x, definition.y, definition.lag);
    if (points.length < MIN_CORRELATION_PAIRS) {
      skipped.push({ label: definition.label, reason: `${points.length} von ${MIN_CORRELATION_PAIRS} Paaren` });
      continue;
    }
    const r = pearson(points);
    if (r === null) {
      skipped.push({ label: definition.label, reason: 'Werte ohne Streuung' });
      continue;
    }
    found.push({ key: definition.key, label: definition.label, r, n: points.length });
  }

  return { found, skipped };
}

export interface TrainingEffect {
  afterTraining: { energy: number | null; sleep: number | null; n: number };
  afterRest: { energy: number | null; sleep: number | null; n: number };
  energyDifference: number | null;
  sleepDifference: number | null;
}

/**
 * Befinden am Tag nach einem Training gegenueber dem nach einem Ruhetag.
 *
 * Tage, deren Trainingsmarker weder Training noch Ruhetag belegt, bleiben aussen
 * vor. In der Spalte stehen vereinzelt freie Notizen.
 */
export function trainingEffect(entries: readonly DailyEntry[]): Insight<TrainingEffect> {
  const sorted = sortedByDate(entries);
  const training = { energy: [] as number[], sleep: [] as number[] };
  const rest = { energy: [] as number[], sleep: [] as number[] };

  for (let i = 0; i < sorted.length - 1; i++) {
    const today = sorted[i]!;
    const next = sorted[i + 1]!;
    if ((next.dateObj!.getTime() - today.dateObj!.getTime()) / MS_PER_DAY > MAX_GAP_DAYS) continue;

    const marker = parseTrainingMarker(today.training);
    if (marker.kind === 'unknown') continue;

    const bucket = marker.kind === 'training' ? training : rest;
    if (next.energy !== null) bucket.energy.push(next.energy);
    if (next.sleep !== null) bucket.sleep.push(next.sleep);
  }

  if (!training.energy.length && !rest.energy.length) {
    return refuse('Keine verwertbaren Folgetage');
  }

  const trainingEnergy = avg(training.energy);
  const restEnergy = avg(rest.energy);
  const trainingSleep = avg(training.sleep);
  const restSleep = avg(rest.sleep);

  return {
    ok: true,
    afterTraining: { energy: trainingEnergy, sleep: trainingSleep, n: training.energy.length },
    afterRest: { energy: restEnergy, sleep: restSleep, n: rest.energy.length },
    energyDifference: trainingEnergy !== null && restEnergy !== null ? trainingEnergy - restEnergy : null,
    sleepDifference: trainingSleep !== null && restSleep !== null ? trainingSleep - restSleep : null,
  };
}
