import type { DailyEntry } from '../types';
import { avg, MOVING_AVERAGE_WINDOW } from './smoothing';

/**
 * Gesamtveraenderung des Gewichts, geglaettet.
 *
 * PHASE 2: verglichen werden die Mittel der ersten und der letzten Tage, nicht
 * mehr zwei einzelne Waegungen. Zwei Einzeltage messen ueberwiegend
 * Wasserhaushalt. Beim vorliegenden Bestand faellt die erste Waegung mit 99.9 kg
 * deutlich aus der Reihe und praegte damit die Titelzahl.
 */

export interface WeightChange {
  /** Mittel der ersten Tage. */
  from: number;
  /** Mittel der letzten Tage. */
  to: number;
  /** Differenz in kg, negativ bedeutet Abnahme. */
  change: number;
  /** Anzahl Waegungen, die in jedes der beiden Mittel eingehen. */
  window: number;
  /** Die beiden urspruenglichen Einzelwerte, weiterhin als Detail verfuegbar. */
  firstRaw: number;
  lastRaw: number;
}

export function weightChange(
  entries: readonly DailyEntry[],
  window: number = MOVING_AVERAGE_WINDOW,
): WeightChange | null {
  const weights = entries
    .filter((e) => e.weight !== null && !isNaN(e.weight))
    .map((e) => e.weight!);

  if (!weights.length) return null;

  // Bei kurzen Reihen darf sich das Fenster nicht mit sich selbst ueberlappen.
  const size = Math.max(1, Math.min(window, Math.floor(weights.length / 2) || 1));
  const from = avg(weights.slice(0, size));
  const to = avg(weights.slice(-size));
  if (from === null || to === null) return null;

  return {
    from,
    to,
    change: to - from,
    window: size,
    firstRaw: weights[0]!,
    lastRaw: weights[weights.length - 1]!,
  };
}
