import type { SheetValues, SheetRow } from '../types';

/**
 * Spaltenauflaesung ueber Kopfzeilen statt ueber feste Indizes.
 *
 * Der Trainer hat Schreibrechte am Sheet. Eine eingefuegte Spalte wuerde bei
 * festen Indizes jede nachfolgende Spalte still verschieben und das Dashboard
 * wuerde etwa Stresslevel als Schritte anzeigen, ohne Fehlermeldung. Deshalb
 * werden Spalten ueber ihre Beschriftung gesucht und ein Fehlen fuehrt zu einer
 * sichtbaren Meldung.
 */

export interface ColumnSpec {
  /** Interner Schluessel. */
  key: string;
  /** Beschriftung in der Kopfzeile. Fehlt sie, gibt es nur den Rueckfallindex. */
  header?: string;
  /** Index, der gilt, wenn die Spalte keine Beschriftung traegt. */
  fallbackIndex?: number;
  /** Ohne diese Spalte ist die Tabelle nicht auswertbar. */
  required?: boolean;
}

export class MissingColumnsError extends Error {
  constructor(public readonly missing: string[]) {
    super(`Spalten nicht gefunden: ${missing.join(', ')}`);
    this.name = 'MissingColumnsError';
  }
}

export type ColumnMap = Readonly<Record<string, number>>;

/** Sucht die Kopfzeile ueber Beschriftungen, die dort zwingend stehen muessen. */
export function findHeaderRow(rows: SheetValues, required: readonly string[]): number {
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;
    const labels = new Set(row.map((c) => (c ?? '').trim()));
    if (required.every((r) => labels.has(r))) return i;
  }
  return -1;
}

/**
 * Bildet Spaltenschluessel auf Indizes ab.
 *
 * Beschriftete Spalten werden gesucht. Unbeschriftete Spalten, etwa die
 * Notizspalte ohne Kopfzeile, nutzen ihren Rueckfallindex.
 */
export function resolveColumns(headerRow: SheetRow, specs: readonly ColumnSpec[]): ColumnMap {
  const map: Record<string, number> = {};
  const missing: string[] = [];

  for (const spec of specs) {
    let index = -1;
    if (spec.header !== undefined) {
      index = headerRow.findIndex((cell) => (cell ?? '').trim() === spec.header);
    }
    if (index < 0 && spec.fallbackIndex !== undefined) index = spec.fallbackIndex;
    if (index < 0) {
      if (spec.required) missing.push(spec.header ?? spec.key);
      continue;
    }
    map[spec.key] = index;
  }

  if (missing.length) throw new MissingColumnsError(missing);
  return map;
}

/** Liest eine Zelle ueber den Spaltenschluessel. Fehlt die Spalte, kommt undefined. */
export function cell(row: SheetRow, columns: ColumnMap, key: string): string | undefined {
  const index = columns[key];
  if (index === undefined) return undefined;
  return row[index];
}
