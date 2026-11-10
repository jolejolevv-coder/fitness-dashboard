import type { SheetValues } from '../types';
import { cell, findHeaderRow, resolveColumns, type ColumnSpec } from './columns';
import { num, parseDate } from './num';
import { parseSetDate } from './trainingSets';

/**
 * Tab `Body` im Gym Logbuch (Phase 21, ADR 0011): von Hand gepflegte
 * Koerperdaten. Zuordnung ueber Kopfzeilen, eine fehlende Pflichtspalte wirft
 * `MissingColumnsError`.
 */

export interface BodyEntry {
  date: Date;
  bodyfatPct: number | null;
  waistCm: number | null;
  note: string;
}

const REQUIRED_HEADERS = ['date', 'bodyfat_pct'] as const;

const COLUMNS: readonly ColumnSpec[] = [
  { key: 'date', header: 'date', required: true },
  { key: 'bodyfat', header: 'bodyfat_pct', required: true },
  { key: 'waist', header: 'waist_cm' },
  { key: 'note', header: 'note' },
];

/** Eintraege mit gueltigem Datum, aufsteigend. Leere Tabelle ergibt eine leere Liste. */
export function parseBody(rows: SheetValues): BodyEntry[] {
  if (!rows.length) return [];
  const headerIndex = findHeaderRow(rows, REQUIRED_HEADERS);
  const columns = resolveColumns(rows[Math.max(headerIndex, 0)] ?? [], COLUMNS);

  const entries: BodyEntry[] = [];
  for (let i = headerIndex + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;
    const raw = cell(row, columns, 'date');
    const date = parseSetDate(raw) ?? parseDate(raw);
    if (!date) continue;
    entries.push({
      date,
      bodyfatPct: num(cell(row, columns, 'bodyfat')),
      waistCm: num(cell(row, columns, 'waist')),
      note: (cell(row, columns, 'note') ?? '').trim(),
    });
  }
  return entries.sort((a, b) => a.date.getTime() - b.date.getTime());
}

/** Juengster Eintrag mit Koerperfett, null ohne Messung. */
export function latestBodyfat(entries: readonly BodyEntry[]): BodyEntry | null {
  return [...entries].reverse().find((e) => e.bodyfatPct !== null) ?? null;
}
