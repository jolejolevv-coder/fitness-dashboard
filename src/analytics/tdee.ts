import type { DailyEntry } from '../types';
import { avg, MOVING_AVERAGE_WINDOW } from './smoothing';
import { type Insight, refuse, tooFewDays } from './result';

/**
 * Geschaetzter Erhaltungsbedarf aus der tatsaechlichen Energiebilanz.
 *
 *   TDEE = Ø Zufuhr + (Gewichtsverlust in kg * 7700) / Tage
 *
 * Statt aus einer Formel wie Harris Benedict, die mit dem einzelnen Koerper
 * nichts zu tun hat. Der Faktor ist eine Naeherung, die Fett und Magermasse
 * nicht trennt, was bei Body Recomposition die eigentlich interessante Trennung
 * waere. Die Zufuhr wird abgewogen erfasst, damit misst der Schaetzer
 * ueberwiegend Stoffwechsel und nicht Schaetzfehler.
 */

/** Energiegehalt eines Kilogramms Koerpermasse, Naeherung. */
export const KCAL_PER_KG_BODYMASS = 7700;

/** Fenster in Tagen, ueber die geschaetzt wird. */
export const TDEE_WINDOWS = [14, 28, 56] as const;

/** Kuerzestes zulaessiges Fenster. */
export const MIN_TDEE_DAYS = 14;

/** Anteil der Tage im Fenster, an denen Kalorien erfasst sein muessen. */
export const MIN_CALORIE_COVERAGE = 0.8;

const MS_PER_DAY = 864e5;

export interface TdeeEstimate {
  /** Erhaltungsbedarf in kcal pro Tag. */
  kcal: number;
  /** Laenge des Fensters in Tagen. */
  windowDays: number;
  /** Tage mit erfasster Zufuhr im Fenster. */
  daysWithCalories: number;
  /** Tage mit Waegung im Fenster. */
  daysWithWeight: number;
  meanIntake: number;
  /** Gewichtsveraenderung im Fenster, geglaettet, negativ bedeutet Abnahme. */
  weightChangeKg: number;
}

function withinWindow(entries: readonly DailyEntry[], days: number): DailyEntry[] {
  const dated = entries.filter((e) => e.dateObj).sort((a, b) => a.dateObj!.getTime() - b.dateObj!.getTime());
  const last = dated[dated.length - 1]?.dateObj;
  if (!last) return [];
  const cutoff = new Date(last.getTime() - (days - 1) * MS_PER_DAY);
  return dated.filter((e) => e.dateObj! >= cutoff);
}

/**
 * Schaetzung fuer ein einzelnes Fenster.
 *
 * Die Gewichtsveraenderung ist die Differenz der Mittel der ersten und letzten
 * Waegungen im Fenster, nicht die zweier Einzeltage.
 */
export function tdeeForWindow(entries: readonly DailyEntry[], windowDays: number): Insight<TdeeEstimate> {
  if (windowDays < MIN_TDEE_DAYS) return refuse(`Fenster ${windowDays} unter ${MIN_TDEE_DAYS} Tagen`);

  const inWindow = withinWindow(entries, windowDays);
  if (inWindow.length < windowDays) return tooFewDays(inWindow.length, windowDays);

  const calories = inWindow.filter((e) => e.calories !== null);
  const coverage = calories.length / inWindow.length;
  if (coverage < MIN_CALORIE_COVERAGE) {
    return refuse(`Kalorien an ${calories.length} von ${inWindow.length} Tagen`);
  }

  const weights = inWindow.filter((e) => e.weight !== null).map((e) => e.weight!);
  const edge = Math.max(1, Math.min(MOVING_AVERAGE_WINDOW, Math.floor(weights.length / 2) || 1));
  if (weights.length < 2 * edge) return tooFewDays(weights.length, 2 * edge);

  const from = avg(weights.slice(0, edge));
  const to = avg(weights.slice(-edge));
  const meanIntake = avg(calories.map((e) => e.calories));
  if (from === null || to === null || meanIntake === null) return refuse('Zu wenige Werte im Fenster');

  const weightChangeKg = to - from;
  // Abnahme bedeutet ein Defizit, also liegt der Bedarf ueber der Zufuhr.
  const dailyBalance = (-weightChangeKg * KCAL_PER_KG_BODYMASS) / inWindow.length;

  return {
    ok: true,
    kcal: meanIntake + dailyBalance,
    windowDays,
    daysWithCalories: calories.length,
    daysWithWeight: weights.length,
    meanIntake,
    weightChangeKg,
  };
}

export interface TdeeRange {
  /** Schaetzungen der Fenster, fuer die die Daten reichen. */
  estimates: TdeeEstimate[];
  low: number;
  high: number;
  /** Verweigerte Fenster mit Grund, damit sichtbar ist was fehlt. */
  skipped: { windowDays: number; reason: string }[];
}

/**
 * Schaetzung ueber alle verfuegbaren Fenster.
 *
 * Ausgegeben wird eine Spanne. Eine einzelne Zahl waere unehrlicher, weil die
 * Streuung zwischen den Fenstern die eigentliche Unsicherheit zeigt.
 */
export function tdeeRange(entries: readonly DailyEntry[]): Insight<TdeeRange> {
  const estimates: TdeeEstimate[] = [];
  const skipped: { windowDays: number; reason: string }[] = [];

  for (const windowDays of TDEE_WINDOWS) {
    const result = tdeeForWindow(entries, windowDays);
    if (result.ok) estimates.push(result);
    else skipped.push({ windowDays, reason: result.reason });
  }

  if (!estimates.length) {
    return refuse(skipped[0]?.reason ?? `Basis unter ${MIN_TDEE_DAYS} Tagen`);
  }

  const values = estimates.map((e) => e.kcal);
  return { ok: true, estimates, low: Math.min(...values), high: Math.max(...values), skipped };
}
