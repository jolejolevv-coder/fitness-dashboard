/** Lineare Regression nach kleinsten Quadraten. */

export interface Point {
  x: number;
  y: number;
}

export interface Regression {
  /** Steigung je Einheit von x. */
  slope: number;
  intercept: number;
  /** Bestimmtheitsmass, 0 bis 1. */
  r2: number;
  /** Standardfehler der Steigung, Grundlage des Projektionsbandes. */
  slopeStdError: number;
  n: number;
}

export function linearRegression(points: readonly Point[]): Regression | null {
  const n = points.length;
  if (n < 3) return null;

  let sumX = 0, sumY = 0;
  for (const p of points) { sumX += p.x; sumY += p.y; }
  const meanX = sumX / n;
  const meanY = sumY / n;

  let sxx = 0, sxy = 0, syy = 0;
  for (const p of points) {
    const dx = p.x - meanX;
    const dy = p.y - meanY;
    sxx += dx * dx;
    sxy += dx * dy;
    syy += dy * dy;
  }
  if (sxx === 0) return null;

  const slope = sxy / sxx;
  const intercept = meanY - slope * meanX;

  // Summe der quadrierten Residuen, daraus R² und der Standardfehler.
  let sse = 0;
  for (const p of points) {
    const predicted = intercept + slope * p.x;
    sse += (p.y - predicted) ** 2;
  }

  const r2 = syy === 0 ? 1 : Math.max(0, 1 - sse / syy);
  const slopeStdError = n > 2 ? Math.sqrt(sse / (n - 2) / sxx) : 0;

  return { slope, intercept, r2, slopeStdError, n };
}

/** Faktor fuer ein Konfidenzband von rund 95 Prozent. */
export const CONFIDENCE_FACTOR = 1.96;

/** Pearson Korrelationskoeffizient. Null, wenn eine Reihe keine Streuung hat. */
export function pearson(points: readonly Point[]): number | null {
  const n = points.length;
  if (n < 3) return null;

  let sumX = 0, sumY = 0;
  for (const p of points) { sumX += p.x; sumY += p.y; }
  const meanX = sumX / n;
  const meanY = sumY / n;

  let sxy = 0, sxx = 0, syy = 0;
  for (const p of points) {
    const dx = p.x - meanX;
    const dy = p.y - meanY;
    sxy += dx * dy;
    sxx += dx * dx;
    syy += dy * dy;
  }
  if (sxx === 0 || syy === 0) return null;
  return sxy / Math.sqrt(sxx * syy);
}
