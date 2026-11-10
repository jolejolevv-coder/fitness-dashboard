import type { DailyEntry } from '../types';
import { COACH_RULES as R } from '../config/coachRules';

/** Eintraege mit Datum, aufsteigend sortiert. */
export function dated(entries: readonly DailyEntry[]): DailyEntry[] {
  return entries.filter((e) => e.dateObj).sort((a, b) => a.dateObj!.getTime() - b.dateObj!.getTime());
}

/**
 * Eintraege eines Fensters von `days` Tagen, das `offsetDays` vor dem letzten
 * Tag endet. Der letzte Tag ist der juengste, fuer den `has` gilt.
 */
export function windowOf(
  entries: readonly DailyEntry[],
  days: number,
  offsetDays: number,
  has: (entry: DailyEntry) => boolean,
): DailyEntry[] {
  const sorted = dated(entries);
  const last = sorted.filter(has).pop()?.dateObj;
  if (!last) return [];
  const end = last.getTime() - offsetDays * R.MS_PER_DAY;
  const start = end - days * R.MS_PER_DAY;
  return sorted.filter((e) => e.dateObj!.getTime() > start && e.dateObj!.getTime() <= end);
}

export function mean(values: readonly number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

/** Zahl fuer eine Verweigerungszeile, mit Komma. */
export function show(value: number, digits = 1): string {
  return value.toFixed(digits).replace('.', ',');
}
