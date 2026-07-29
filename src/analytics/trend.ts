import type { DailyEntry } from '../types';
import { MOVING_AVERAGE_WINDOW, movingAvg } from './smoothing';
import { CONFIDENCE_FACTOR, linearRegression, type Point } from './regression';
import { type Insight, refuse, tooFewDays } from './result';

/**
 * Trend, Zielprojektion und Plateau Erkennung.
 *
 * Gerechnet wird ausschliesslich auf dem geglaetteten Gewichtsverlauf. Auf
 * Einzeltagen ergibt eine Regression bei taeglichen Schwankungen von ueber einem
 * Kilogramm keine belastbare Steigung.
 */

const MS_PER_DAY = 864e5;
const DAYS_PER_WEEK = 7;

/** Mindestanzahl geglaetteter Punkte fuer eine Aussage. */
export const MIN_TREND_DAYS = 14;

/** Unter diesem Bestimmtheitsmass ist der Verlauf zu unruhig fuer eine Projektion. */
export const MIN_R2_FOR_PROJECTION = 0.3;

/** Fenster der Plateau Pruefung in Tagen. */
export const PLATEAU_WINDOW_DAYS = 14;

/** Betrag, unter dem eine Rate als Stillstand gilt, in kg pro Woche. */
export const PLATEAU_THRESHOLD_KG_PER_WEEK = 0.15;

/** Ab dieser Compliance gilt die Ausfuehrung als erfuellt. */
export const PLATEAU_COMPLIANCE_PCT = 80;

export interface SmoothedPoint {
  date: Date;
  /** Gleitendes Mittel des Gewichts an diesem Tag. */
  value: number;
}

/**
 * Geglaetteter Gewichtsverlauf, nach Datum sortiert.
 *
 * Nur Punkte mit vollem Fenster. Die ersten Punkte einer Reihe mitteln ueber
 * weniger Tage und liegen deshalb systematisch daneben. Auf einem exakt linearen
 * Verlust verbiegen sie die Regression sichtbar: mit ihnen ergibt ein Verlust
 * von 0.7 kg pro Woche eine gemessene Rate von 0.687.
 */
export function smoothedWeightSeries(entries: readonly DailyEntry[]): SmoothedPoint[] {
  const weighed = entries
    .filter((e) => e.dateObj && e.weight !== null && !isNaN(e.weight))
    .sort((a, b) => a.dateObj!.getTime() - b.dateObj!.getTime());

  const smoothed = movingAvg(weighed.map((e) => e.weight));
  const points: SmoothedPoint[] = [];
  for (let i = MOVING_AVERAGE_WINDOW - 1; i < weighed.length; i++) {
    const value = smoothed[i];
    if (value === null || value === undefined) continue;
    points.push({ date: weighed[i]!.dateObj!, value });
  }
  return points;
}

function toPoints(series: readonly SmoothedPoint[]): Point[] {
  const start = series[0]!.date.getTime();
  return series.map((p) => ({ x: (p.date.getTime() - start) / MS_PER_DAY, y: p.value }));
}

export interface Trend {
  /** Veraenderung in kg pro Woche, negativ bedeutet Abnahme. */
  ratePerWeek: number;
  /** Verlaesslichkeit der Geraden, 0 bis 1. */
  r2: number;
  /** Standardfehler der Rate, ebenfalls in kg pro Woche. */
  rateStdError: number;
  /** Letzter geglaetteter Wert, Ausgangspunkt jeder Projektion. */
  currentSmoothed: number;
  /** Anzahl geglaetteter Tage, die eingegangen sind. */
  basisDays: number;
  lastDate: Date;
}

export function weightTrend(entries: readonly DailyEntry[]): Insight<Trend> {
  const series = smoothedWeightSeries(entries);
  if (series.length < MIN_TREND_DAYS) return tooFewDays(series.length, MIN_TREND_DAYS);

  const regression = linearRegression(toPoints(series));
  if (!regression) return refuse('Verlauf ohne Streuung');

  const last = series[series.length - 1]!;
  return {
    ok: true,
    ratePerWeek: regression.slope * DAYS_PER_WEEK,
    r2: regression.r2,
    rateStdError: regression.slopeStdError * DAYS_PER_WEEK,
    currentSmoothed: last.value,
    basisDays: series.length,
    lastDate: last.date,
  };
}

export interface Projection {
  /** Erwartetes Datum, an dem das Zielgewicht erreicht ist. */
  date: Date;
  /** Frueheste und spaeteste Erwartung aus dem Standardfehler der Rate. */
  earliest: Date;
  latest: Date;
  weeks: number;
}

/**
 * Projektion auf das Zielgewicht.
 *
 * Ausgegeben wird ein Band, keine Punktprognose. Die Annahme, dass es linear
 * weitergeht, trifft nie zu, deshalb ist die Breite des Bandes die eigentliche
 * Information.
 */
export function projectToTarget(trend: Insight<Trend>, targetKg: number | null): Insight<Projection> {
  if (!trend.ok) return trend;
  if (targetKg === null) return refuse('Kein Zielgewicht gesetzt');
  if (trend.r2 < MIN_R2_FOR_PROJECTION) {
    return refuse(`Verlauf zu unruhig, R² ${trend.r2.toFixed(2)} von ${MIN_R2_FOR_PROJECTION}`);
  }

  const remaining = targetKg - trend.currentSmoothed;
  if (Math.abs(remaining) < 0.05) return refuse('Ziel erreicht');
  if (Math.sign(remaining) !== Math.sign(trend.ratePerWeek)) {
    return refuse('Trend zeigt vom Ziel weg');
  }

  const weeksAt = (rate: number): number => remaining / rate;
  const fastRate = trend.ratePerWeek + Math.sign(trend.ratePerWeek) * CONFIDENCE_FACTOR * trend.rateStdError;
  const slowRate = trend.ratePerWeek - Math.sign(trend.ratePerWeek) * CONFIDENCE_FACTOR * trend.rateStdError;

  const weeks = weeksAt(trend.ratePerWeek);
  const at = (w: number): Date => new Date(trend.lastDate.getTime() + w * DAYS_PER_WEEK * MS_PER_DAY);

  // Eine Rate, die durch den Fehlerbereich das Vorzeichen wechselt, ergibt kein Datum.
  const slowWeeks = Math.sign(slowRate) === Math.sign(trend.ratePerWeek) ? weeksAt(slowRate) : Infinity;
  const fastWeeks = weeksAt(fastRate);

  return {
    ok: true,
    date: at(weeks),
    earliest: at(Math.min(fastWeeks, weeks)),
    latest: Number.isFinite(slowWeeks) ? at(Math.max(slowWeeks, weeks)) : at(weeks * 3),
    weeks,
  };
}

export type PlateauStatus = 'kein-plateau' | 'plateau' | 'ausfuehrung';

export interface Plateau {
  status: PlateauStatus;
  /** Rate der letzten zwei Wochen, in kg pro Woche. */
  ratePerWeek: number;
  basisDays: number;
}

/**
 * Plateau Erkennung ueber die letzten vierzehn Tage.
 *
 * Unterschieden wird zwischen einem echten Plateau, bei dem die Vorgabe trotz
 * eingehaltener Ausfuehrung nicht mehr greift, und blossem Stillstand bei
 * unzureichender Compliance. Die Konsequenz ist eine andere: das eine ist ein
 * Anlass, den Trainer anzusprechen, das andere nicht.
 */
export function detectPlateau(
  entries: readonly DailyEntry[],
  compliancePct: number | null,
): Insight<Plateau> {
  const series = smoothedWeightSeries(entries);
  if (series.length < PLATEAU_WINDOW_DAYS) return tooFewDays(series.length, PLATEAU_WINDOW_DAYS);

  const recent = series.slice(-PLATEAU_WINDOW_DAYS);
  const regression = linearRegression(toPoints(recent));
  if (!regression) return refuse('Verlauf ohne Streuung');

  const ratePerWeek = regression.slope * DAYS_PER_WEEK;
  const flat = Math.abs(ratePerWeek) < PLATEAU_THRESHOLD_KG_PER_WEEK;

  let status: PlateauStatus = 'kein-plateau';
  if (flat) {
    status = compliancePct !== null && compliancePct < PLATEAU_COMPLIANCE_PCT ? 'ausfuehrung' : 'plateau';
  }

  return { ok: true, status, ratePerWeek, basisDays: recent.length };
}
