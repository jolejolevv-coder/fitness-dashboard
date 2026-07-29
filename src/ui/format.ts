/**
 * Zahlenformate der Oberflaeche.
 *
 * Deutsches Dezimalkomma und ein echtes Minuszeichen (U+2212) statt eines
 * Bindestrichs. Der Bindestrich ist schmaler, sitzt zu hoch und laesst eine
 * negative Zahl wie einen Trennstrich aussehen.
 */

const MINUS = '−';

/** Platzhalter fuer einen fehlenden Wert. Halbgeviertstrich, kein Bindestrich. */
export const EMPTY = '–';

function withGermanSigns(text: string): string {
  return text.replace('-', MINUS);
}

export function decimal(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return EMPTY;
  return withGermanSigns(value.toLocaleString('de-DE', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }));
}

export function integer(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return EMPTY;
  return withGermanSigns(Math.round(value).toLocaleString('de-DE'));
}

/** Mit ausdruecklichem Vorzeichen, fuer Veraenderungen. */
export function signed(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return EMPTY;
  return `${value > 0 ? '+' : ''}${decimal(value, digits)}`;
}

/** Zielzahl ohne unnoetige Nachkommastelle. */
export function target(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return EMPTY;
  return Number.isInteger(value) ? integer(value) : decimal(value, 1);
}

export const dateFormat = new Intl.DateTimeFormat('de-DE', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});
