import type { SheetValues } from '../types';

/**
 * Liest einen Mesocycle Tab fuer Training eintragen.
 *
 * Gleiche Regeln wie `apps-script/training-log-core.js`, damit App und Script
 * dieselbe Zeile meinen: Jeder Tag hat eine Kopfzeile mit dem Tag links und den
 * Wochenbloecken ab `Excercise`. Im Block stehen Soll (`Sets`, `Reps`, `RIR`,
 * `Tempo` vor `Load`) und Ist (`Load`, `Reps` hinter `Load`, optional `Notes`).
 * Dieselbe Uebung kann an einem Tag mehrfach stehen, `occurrence` zaehlt sie.
 *
 * Reine Funktionen, kein DOM. `src/parse/training.ts` bleibt unberuehrt: Er
 * ueberspringt Uebungen ohne Last und taugt deshalb nicht fuer leere Wochen.
 */

const WEEK_BLOCK_MARKER = 'Excercise';
const MIN_WEEK_BLOCKS = 3;

/** Spalten eines Wochenblocks. `null`, wo der Block den Kopf nicht hat. */
interface BlockColumns {
  name: number;
  sets: number | null;
  repsTarget: number | null;
  rir: number | null;
  tempo: number | null;
  load: number;
  repsActual: number;
  notes: number | null;
}

/** Eine Uebung in einer Woche: Soll zum Ablesen, Ist zum Eintragen. */
export interface LogExercise {
  name: string;
  occurrence: number;
  sets: string;
  repsTarget: string;
  rir: string;
  tempo: string;
  load: string;
  repsActual: string;
  /** `null`, wenn der Tab keine Spalte `Notes` hat. */
  notes: string | null;
}

export interface LogDay {
  label: string;
  /** Je Woche die Uebungen, `null` fuer einen Block ohne `Load` oder `Reps` Ist. */
  weeks: (LogExercise[] | null)[];
}

export interface LogTab {
  weekCount: number;
  days: LogDay[];
}

function normalize(text: string | undefined): string {
  return (text ?? '').replace(/\s+/g, ' ').trim();
}

function markerColumns(row: readonly string[] | undefined): number[] {
  const found: number[] = [];
  row?.forEach((cell, column) => {
    if (normalize(cell) === WEEK_BLOCK_MARKER) found.push(column);
  });
  return found;
}

function firstColumn(row: readonly string[], names: readonly string[], from: number, to: number): number | null {
  for (let column = from; column < to; column++) {
    if (names.includes(normalize(row[column]))) return column;
  }
  return null;
}

function blockColumns(header: readonly string[], start: number, end: number): BlockColumns | null {
  const load = firstColumn(header, ['Load'], start, end);
  if (load === null) return null;
  const repsActual = firstColumn(header, ['Reps Ist', 'Reps'], load + 1, end);
  if (repsActual === null) return null;
  return {
    name: start,
    sets: firstColumn(header, ['Sets'], start, load),
    repsTarget: firstColumn(header, ['Reps'], start, load),
    rir: firstColumn(header, ['RIR'], start, load),
    tempo: firstColumn(header, ['Tempo'], start, load),
    load,
    repsActual,
    notes: firstColumn(header, ['Notes'], load + 1, end),
  };
}

function cell(row: readonly string[] | undefined, column: number | null): string {
  return column === null ? '' : normalize(row?.[column]);
}

/**
 * Uebungen eines Tags in einer Woche: die zusammenhaengenden Zeilen unter der
 * Kopfzeile. Die erste leere Zeile beendet den Block, darunter stehen im Tab
 * Summenzeilen wie `Dauer der Trainingseinheit` oder `Satzzahl`.
 */
function weekExercises(rows: SheetValues, headerIndex: number, endIndex: number, columns: BlockColumns): LogExercise[] {
  const seen = new Map<string, number>();
  const exercises: LogExercise[] = [];
  for (let index = headerIndex + 1; index < endIndex; index++) {
    const row = rows[index];
    const name = cell(row, columns.name);
    if (!name) break;
    const occurrence = (seen.get(name) ?? 0) + 1;
    seen.set(name, occurrence);
    exercises.push({
      name,
      occurrence,
      sets: cell(row, columns.sets),
      repsTarget: cell(row, columns.repsTarget),
      rir: cell(row, columns.rir),
      tempo: cell(row, columns.tempo),
      load: cell(row, columns.load),
      repsActual: cell(row, columns.repsActual),
      notes: columns.notes === null ? null : cell(row, columns.notes),
    });
  }
  return exercises;
}

/** Liest alle Tage des Tabs. `null`, wenn keine Kopfzeile mit Wochenbloecken existiert. */
export function readLogTab(rows: SheetValues): LogTab | null {
  const headers = rows
    .map((row, index) => ({ index, markers: markerColumns(row) }))
    .filter((entry) => entry.markers.length >= MIN_WEEK_BLOCKS);
  if (!headers.length) return null;

  const days = headers.map(({ index, markers }, position) => {
    const header = rows[index]!;
    const label = header.slice(0, markers[0]).map(normalize).find(Boolean) ?? `Tag ${position + 1}`;
    const endIndex = headers[position + 1]?.index ?? rows.length;
    const weeks = markers.map((start, week) => {
      const columns = blockColumns(header, start, markers[week + 1] ?? header.length);
      return columns ? weekExercises(rows, index, endIndex, columns) : null;
    });
    return { label, weeks };
  });

  return { weekCount: Math.max(...headers.map((h) => h.markers.length)), days };
}

/**
 * Vorauswahl der Woche: die erste, in der der Tag noch kein `Reps` Ist traegt.
 * Sind alle Wochen eingetragen, die letzte. Ergebnis 0 basiert.
 */
export function firstOpenWeek(day: LogDay): number {
  const open = day.weeks.findIndex((week) => week !== null && week.length > 0 && week.every((e) => e.repsActual === ''));
  return open === -1 ? Math.max(0, day.weeks.length - 1) : open;
}
