import type { DailyEntry } from '../types';
import { COACH_RULES as R } from '../config/coachRules';
import { refuse, tooFewDays, type Insight } from '../analytics/result';
import { mean, windowOf } from './window';

/** Regeln D1 bis D3, siehe `docs/coach-regeln.md`. Reine Funktionen. */

const hasSleep = (entry: DailyEntry): boolean => entry.sleep !== null;
const hasEnergy = (entry: DailyEntry): boolean => entry.energy !== null;

export type SleepStatus = 'unter' | 'im-korridor' | 'ueber';

export interface SleepDuration {
  meanH: number;
  status: SleepStatus;
  basisDays: number;
}

/** D1: Mittel der Schlafdauer gegen den Korridor. */
export function sleepDuration(daily: readonly DailyEntry[]): Insight<SleepDuration> {
  const hours = windowOf(daily, R.SLEEP_WINDOW_DAYS, 0, hasSleep).filter(hasSleep).map((e) => e.sleep!);
  if (hours.length < R.SLEEP_MIN_DAYS) return tooFewDays(hours.length, R.SLEEP_MIN_DAYS);
  const meanH = mean(hours);
  let status: SleepStatus = 'im-korridor';
  if (meanH < R.SLEEP_MIN_H) status = 'unter';
  else if (meanH > R.SLEEP_MAX_H) status = 'ueber';
  return { ok: true, meanH, status, basisDays: hours.length };
}

export interface SleepSpread {
  /** Standardabweichung der Schlafdauer in Stunden. */
  sdH: number;
  irregular: boolean;
  basisDays: number;
}

/** D2: Streuung der Schlafdauer als Ersatzmass fuer Regelmaessigkeit. */
export function sleepSpread(daily: readonly DailyEntry[]): Insight<SleepSpread> {
  const hours = windowOf(daily, R.SLEEP_SPREAD_WINDOW_DAYS, 0, hasSleep).filter(hasSleep).map((e) => e.sleep!);
  if (hours.length < R.SLEEP_SPREAD_MIN_DAYS) return tooFewDays(hours.length, R.SLEEP_SPREAD_MIN_DAYS);
  const center = mean(hours);
  const sdH = Math.sqrt(mean(hours.map((h) => (h - center) * (h - center))));
  return { ok: true, sdH, irregular: sdH > R.SLEEP_SPREAD_MAX_H, basisDays: hours.length };
}

export interface RecoverySignal {
  active: boolean;
  sleepMeanH: number;
  /** Energylevel dieser Woche minus Vorwoche. */
  energyChange: number;
  /** Anteil ruecklaeufiger Uebungen, 0 bis 1. */
  regressingShare: number;
  basisDays: number;
}

/**
 * D3: Erholungssignal. Aktiv nur, wenn Schlaf unter dem Korridor, fallender
 * Energylevel und Kraftrueckgang zusammentreffen.
 */
export function recoverySignal(
  daily: readonly DailyEntry[],
  regressingShare: number | null,
): Insight<RecoverySignal> {
  const sleep = sleepDuration(daily);
  if (!sleep.ok) return sleep;
  if (regressingShare === null) return refuse('Progression ohne Basis');

  const energyOf = (offsetDays: number): number[] =>
    windowOf(daily, R.SLEEP_WINDOW_DAYS, offsetDays, hasEnergy).filter(hasEnergy).map((e) => e.energy!);
  const current = energyOf(0);
  const previous = energyOf(R.SLEEP_WINDOW_DAYS);
  const fewest = Math.min(current.length, previous.length);
  if (fewest < R.SLEEP_MIN_DAYS) return refuse(`Energylevel: Basis ${fewest} von ${R.SLEEP_MIN_DAYS} Tagen je Woche`);

  const energyChange = mean(current) - mean(previous);
  const active = sleep.status === 'unter' && energyChange <= -R.ENERGY_DROP && regressingShare > 0;
  return {
    ok: true,
    active,
    sleepMeanH: sleep.meanH,
    energyChange,
    regressingShare,
    basisDays: current.length + previous.length,
  };
}
