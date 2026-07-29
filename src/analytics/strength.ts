/** Nenner der Epley Formel. */
const EPLEY_DIVISOR = 30;

/**
 * Mittlere Wiederholungszahl aus einer Angabe wie `8-10`.
 *
 * PHASE 1: Verhalten unveraendert. Die Trennung an `-` kollidiert mit
 * Bereichsangaben in der Lastspalte, betrifft hier aber nur die Wiederholungen.
 */
export function avgRepsFromStr(s: string | undefined | null): number | null {
  if (!s) return null;
  const nums = s.split('-').map(Number).filter((n) => !isNaN(n) && n > 0);
  if (!nums.length) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

/** Geschaetztes Einwiederholungsmaximum nach Epley, auf eine Nachkommastelle. */
export function epley1RM(load: number | null, reps: number | null): number | null {
  if (!load || !reps) return null;
  return Math.round(load * (1 + reps / EPLEY_DIVISOR) * 10) / 10;
}
