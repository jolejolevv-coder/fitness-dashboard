export type Nullable = number | null | undefined;

/** Fenstergroesse des gleitenden Mittels in Tagen. */
export const MOVING_AVERAGE_WINDOW = 7;

/** Mindestanzahl Werte im Fenster, damit ein Mittel ausgegeben wird. */
const MOVING_AVERAGE_MIN_POINTS = 3;

function isNumber(v: Nullable): v is number {
  return v !== null && v !== undefined && !isNaN(v);
}

/** Mittelwert ueber alle gueltigen Werte. Null, wenn keiner gueltig ist. */
export function avg(values: readonly Nullable[]): number | null {
  const valid = values.filter(isNumber);
  if (!valid.length) return null;
  return valid.reduce((a, b) => a + b, 0) / valid.length;
}

/**
 * Nachlaufendes gleitendes Mittel.
 *
 * Nachlaufend, nicht zentriert: jeder Punkt mittelt sich selbst und die
 * vorangegangenen Tage. Damit springt der letzte Punkt nicht, sobald ein neuer
 * Tag hinzukommt.
 */
export function movingAvg(
  data: readonly Nullable[],
  win: number = MOVING_AVERAGE_WINDOW,
): (number | null)[] {
  return data.map((_, i) => {
    const slice = data.slice(Math.max(0, i - win + 1), i + 1).filter(isNumber);
    if (slice.length < Math.min(win, MOVING_AVERAGE_MIN_POINTS)) return null;
    return slice.reduce((a, b) => a + b, 0) / slice.length;
  });
}

/** Zahl mit fester Nachkommastelle, sonst Gedankenstrich als Platzhalter. */
export function fmt(v: Nullable, d = 1): string {
  return isNumber(v) ? v.toFixed(d) : '–';
}
