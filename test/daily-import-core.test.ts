import { readFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';
import { describe, expect, it } from 'vitest';

/**
 * Tests der Kernlogik des Daily Import.
 *
 * Die Datei unter apps-script/ ist ein klassisches Apps Script ohne Module. Sie
 * wird hier unveraendert in einen eigenen vm Kontext geladen, ihre Funktionen
 * auf oberster Ebene liegen danach als Eigenschaften auf dem Kontext.
 *
 * Die Tabellen unter test/fixtures/daily-import/ sind synthetisch, alle Werte
 * erfunden, Jahr 2030. Sie bilden den Aufbau von `Daily Tracking` nach, siehe
 * specs/sheet-structure.md.
 */

type Failure = { ok: false; error: string; detail: string };
type SheetDate = { day: number; month: number; year: number };
type Values = Record<string, string | number>;
type Columns = Record<string, number>;
type Write = { header: string; column: number; value: string | number };

interface Core {
  validateRequest(rawBody: unknown, expectedToken: unknown): { ok: true; date: SheetDate; values: Values } | Failure;
  mapHeaders(headerCells: string[], wantedHeaders: string[]): { ok: true; columns: Columns } | Failure;
  findDateRow(grid: string[][], dateColumn: number, firstDataRow: number, date: SheetDate): { ok: true; row: number } | Failure;
  planWrites(rowDisplay: string[], rowFormulas: string[], columns: Columns, values: Values): { ok: true; writes: Write[]; skipped: string[] };
}

interface Table {
  description: string;
  headerRow: number;
  firstDataRow: number;
  formulas: Record<string, Record<string, string>>;
  display: string[][];
}

function loadCore(): Core {
  const source = readFileSync(new URL('../apps-script/daily-import-core.js', import.meta.url), 'utf8');
  const context = createContext({});
  runInContext(source, context, { filename: 'daily-import-core.js' });
  return context as unknown as Core;
}

function loadTable(name: string): Table {
  const url = new URL(`./fixtures/daily-import/${name}.json`, import.meta.url);
  return JSON.parse(readFileSync(url, 'utf8')) as Table;
}

/** Baut die Formelzeile so, wie getFormulas sie liefert: leerer Text ohne Formel. */
function formulaRow(table: Table, row: number): string[] {
  const cells = table.formulas[String(row)] ?? {};
  const width = table.display[table.headerRow - 1]!.length;
  return Array.from({ length: width }, (_, column) => cells[String(column)] ?? '');
}

function headerCells(table: Table): string[] {
  return table.display[table.headerRow - 1]!;
}

function expectOk<T extends { ok: boolean }>(result: T | Failure): T {
  if (!result.ok) throw new Error(`expected ok, got ${(result as Failure).error}: ${(result as Failure).detail}`);
  return result as T;
}

const core = loadCore();
const TOKEN = 'test-token-0123456789abcdef';
const day = (d: number, m: number, y: number): SheetDate => ({ day: d, month: m, year: y });
const body = (fields: Record<string, unknown>) => JSON.stringify(fields);

/**
 * Laeuft die Kernfunktionen in der Reihenfolge der Huelle durch und liefert den
 * Schreibplan oder den ersten Fehler.
 */
function planFor(table: Table, date: SheetDate, values: Values) {
  const mapped = core.mapHeaders(headerCells(table), ['Date', ...Object.keys(values)]);
  if (!mapped.ok) return mapped;
  const found = core.findDateRow(table.display, mapped.columns['Date']!, table.firstDataRow, date);
  if (!found.ok) return found;
  const plan = core.planWrites(table.display[found.row - 1] ?? [], formulaRow(table, found.row), mapped.columns, values);
  return { ...plan, row: found.row };
}

describe('validateRequest', () => {
  const valid = { token: TOKEN, date: '11.1.2030', values: { Weight: 91.2, Time: '06:58' } };

  it('liefert Datum und Werte fuer eine gueltige Anfrage', () => {
    const result = expectOk(core.validateRequest(body(valid), TOKEN));
    expect(result.date).toEqual(day(11, 1, 2030));
    expect(result.values).toEqual({ Weight: 91.2, Time: '06:58' });
  });

  it('akzeptiert fuehrende Nullen im Datum', () => {
    const result = expectOk(core.validateRequest(body({ ...valid, date: '01.02.2030' }), TOKEN));
    expect(result.date).toEqual(day(1, 2, 2030));
  });

  it.each([
    ['falsches Token', { ...valid, token: 'test-token-0123456789abcdeX' }, TOKEN],
    ['fehlendes Token', { date: valid.date, values: valid.values }, TOKEN],
    ['Token als Zahl', { ...valid, token: 42 }, TOKEN],
    ['Property nicht gesetzt', valid, null],
    ['Property leer, Token leer', { ...valid, token: '' }, ''],
  ])('lehnt ab bei %s', (_name, fields, expected) => {
    const result = core.validateRequest(body(fields), expected);
    expect(result).toMatchObject({ ok: false, error: 'unauthorized' });
  });

  it('prueft das Token vor Datum und Werten', () => {
    const result = core.validateRequest(body({ token: 'falsch', date: 'kein Datum', values: [] }), TOKEN);
    expect(result).toMatchObject({ ok: false, error: 'unauthorized' });
  });

  it.each([
    ['kein JSON', 'token=abc'],
    ['JSON Array', '[1, 2]'],
    ['JSON null', 'null'],
    ['kein Text', undefined],
  ])('meldet bad_request bei %s', (_name, raw) => {
    expect(core.validateRequest(raw, TOKEN)).toMatchObject({ ok: false, error: 'bad_request' });
  });

  it.each(['2030-01-11', '11.1.30', '11/1/2030', '31.2.2030', '0.1.2030', '11.13.2030', '', undefined])(
    'meldet bad_request fuer das Datum %s',
    (date) => {
      const result = core.validateRequest(body({ ...valid, date }), TOKEN);
      expect(result).toMatchObject({ ok: false, error: 'bad_request' });
    },
  );

  it.each([
    ['values fehlt', undefined],
    ['values als Array', [91.2]],
    ['Wert null', { Weight: null }],
    ['Wert Objekt', { Weight: { kg: 91 } }],
    ['Wert Wahrheitswert', { Weight: true }],
  ])('meldet bad_request bei %s', (_name, values) => {
    const result = core.validateRequest(body({ ...valid, values }), TOKEN);
    expect(result).toMatchObject({ ok: false, error: 'bad_request' });
  });

  it('verwirft leeren Text, damit die Zelle leer bleibt', () => {
    const result = expectOk(core.validateRequest(body({ ...valid, values: { Comments: '  ', Steps: 0 } }), TOKEN));
    expect(result.values).toEqual({ Steps: 0 });
  });
});

describe('mapHeaders', () => {
  const table = loadTable('week-blocks');

  it('ordnet jeden Kopf seiner Spalte zu', () => {
    const result = expectOk(core.mapHeaders(headerCells(table), ['Date', 'Weight', 'Sleep', 'Steps', 'Comments']));
    expect(result.columns).toEqual({ Date: 0, Weight: 1, Sleep: 12, Steps: 18, Comments: 28 });
  });

  it('findet Koepfe mit Zeilenumbruch ueber zusammengefassten Leerraum', () => {
    const result = expectOk(core.mapHeaders(headerCells(table), ['Menstruation Cycle']));
    expect(result.columns).toEqual({ 'Menstruation Cycle': 19 });
  });

  it('folgt verschobenen Spalten', () => {
    const shifted = loadTable('shifted-columns');
    const result = expectOk(core.mapHeaders(headerCells(shifted), ['Date', 'Weight', 'Steps', 'Comments']));
    expect(result.columns).toEqual({ Date: 0, Weight: 2, Steps: 19, Comments: 29 });
  });

  it('meldet einen fehlenden Kopf mit Namen', () => {
    expect(core.mapHeaders(headerCells(table), ['Date', 'Puls'])).toEqual({
      ok: false, error: 'header_missing', detail: 'Puls',
    });
  });

  it('kennt Qualitaet nicht, weil der Kopf wie im Original eine Zeile hoeher steht', () => {
    expect(core.mapHeaders(headerCells(table), ['Qualität'])).toMatchObject({
      ok: false, error: 'header_missing', detail: 'Qualität',
    });
  });

  it('meldet einen doppelten Kopf mit Namen', () => {
    const duplicate = loadTable('duplicate-headers');
    expect(core.mapHeaders(headerCells(duplicate), ['Date', 'Steps'])).toEqual({
      ok: false, error: 'header_ambiguous', detail: 'Steps',
    });
  });

  it('meldet eine leere Kopfzeile als fehlenden Kopf', () => {
    expect(core.mapHeaders([], ['Date'])).toMatchObject({ ok: false, error: 'header_missing', detail: 'Date' });
  });

  it('unterscheidet Gross und Kleinschreibung', () => {
    expect(core.mapHeaders(headerCells(table), ['steps'])).toMatchObject({ ok: false, error: 'header_missing' });
  });
});

describe('findDateRow', () => {
  const table = loadTable('week-blocks');

  it.each([
    [day(7, 1, 2030), 5],
    [day(13, 1, 2030), 11],
    [day(14, 1, 2030), 17],
    [day(20, 1, 2030), 23],
  ])('findet %o in Zeile %i ueber die Wochenbloecke hinweg', (date, row) => {
    expect(core.findDateRow(table.display, 0, table.firstDataRow, date)).toEqual({ ok: true, row });
  });

  it('meldet date_missing fuer ein Datum ohne Zeile', () => {
    expect(core.findDateRow(table.display, 0, table.firstDataRow, day(21, 1, 2030))).toEqual({
      ok: false, error: 'date_missing', detail: '21.1.2030',
    });
  });

  it('meldet date_ambiguous fuer ein doppeltes Datum mit beiden Zeilen', () => {
    const duplicate = loadTable('duplicate-date');
    expect(core.findDateRow(duplicate.display, 0, duplicate.firstDataRow, day(11, 1, 2030))).toEqual({
      ok: false, error: 'date_ambiguous', detail: '11.1.2030 in rows 9, 10',
    });
  });

  it('liest erst ab der ersten Datenzeile', () => {
    const shifted = loadTable('shifted-columns');
    expect(core.findDateRow(shifted.display, 0, shifted.firstDataRow, day(14, 1, 2030))).toMatchObject({
      ok: false, error: 'date_missing',
    });
    expect(core.findDateRow(shifted.display, 0, shifted.firstDataRow, day(10, 1, 2030))).toEqual({ ok: true, row: 34 });
  });

  it('nimmt die erste Datenzeile als Parameter und keine feste Zahl', () => {
    expect(core.findDateRow(table.display, 0, 6, day(7, 1, 2030))).toMatchObject({ error: 'date_missing' });
    expect(core.findDateRow(table.display, 0, 6, day(8, 1, 2030))).toEqual({ ok: true, row: 6 });
  });

  it('vergleicht Datumszellen mit fuehrender Null', () => {
    const grid = [['Date'], ['07.01.2030']];
    expect(core.findDateRow(grid, 0, 2, day(7, 1, 2030))).toEqual({ ok: true, row: 2 });
  });
});

describe('planWrites', () => {
  const table = loadTable('week-blocks');
  const columns = expectOk(core.mapHeaders(headerCells(table), ['Weight', 'Time', 'Steps', 'Fiber', 'Comments'])).columns;

  it('beschreibt alle Felder einer leeren Vorlagezeile', () => {
    const values = { Weight: 90.8, Time: '07:02', Steps: 11200 };
    const plan = core.planWrites(table.display[8]!, formulaRow(table, 9), columns, values);
    expect(plan.writes).toEqual([
      { header: 'Weight', column: 1, value: 90.8 },
      { header: 'Time', column: 2, value: '07:02' },
      { header: 'Steps', column: 18, value: 11200 },
    ]);
    expect(plan.skipped).toEqual([]);
  });

  it('ueberspringt befuellte Zellen einer teils befuellten Zeile', () => {
    const values = { Weight: 90.8, Time: '07:02', Steps: 11200, Comments: 'neu' };
    const plan = core.planWrites(table.display[7]!, formulaRow(table, 8), columns, values);
    expect(plan.writes).toEqual([{ header: 'Steps', column: 18, value: 11200 }]);
    expect(plan.skipped).toEqual(['Weight', 'Time', 'Comments']);
  });

  it('ueberspringt eine Zelle mit Formel, auch wenn sie leer angezeigt wird', () => {
    const plan = core.planWrites(table.display[7]!, formulaRow(table, 8), columns, { Fiber: 30 });
    expect(plan.writes).toEqual([]);
    expect(plan.skipped).toEqual(['Fiber']);
  });

  it('schreibt die Null, weil sie ein echter Wert ist', () => {
    const plan = core.planWrites(table.display[8]!, formulaRow(table, 9), columns, { Steps: 0 });
    expect(plan.writes).toEqual([{ header: 'Steps', column: 18, value: 0 }]);
  });

  it('behandelt fehlende Zellen am Zeilenende als leer', () => {
    const plan = core.planWrites(['11.1.2030'], [], columns, { Comments: 'kurz' });
    expect(plan.writes).toEqual([{ header: 'Comments', column: 28, value: 'kurz' }]);
  });

  it('schreibt beim zweiten Lauf nichts mehr', () => {
    const values = { Weight: 90.8, Time: '07:02', Steps: 11200 };
    const first = core.planWrites(table.display[8]!, formulaRow(table, 9), columns, values);
    const afterFirst = [...table.display[8]!];
    for (const write of first.writes) afterFirst[write.column] = String(write.value);
    const second = core.planWrites(afterFirst, formulaRow(table, 9), columns, values);
    expect(second.writes).toEqual([]);
    expect(second.skipped).toEqual(['Weight', 'Time', 'Steps']);
  });
});

describe('Ablauf wie in der Huelle', () => {
  it('schreibt einen Tag ohne Wiegen ohne Weight und Time', () => {
    const plan = planFor(loadTable('week-blocks'), day(12, 1, 2030), { Steps: 9000, Calories: 2310 });
    expect(plan).toMatchObject({ ok: true, row: 10, skipped: [] });
    expect('writes' in plan && plan.writes.map((w) => w.header)).toEqual(['Steps', 'Calories']);
  });

  it('beschreibt in verschobenen Spalten die richtige Spalte', () => {
    const plan = planFor(loadTable('shifted-columns'), day(13, 1, 2030), { Steps: 9000 });
    expect(plan).toMatchObject({ ok: true, row: 37, writes: [{ header: 'Steps', column: 19, value: 9000 }] });
  });

  it('beschreibt nie eine Zeile der Wochenbloecke', () => {
    const table = loadTable('week-blocks');
    const blockRows = new Set([12, 13, 14, 15, 16, 24, 25, 26, 27, 28]);
    for (let d = 1; d <= 31; d++) {
      const plan = planFor(table, day(d, 1, 2030), { Steps: 1 });
      if ('row' in plan) expect(blockRows.has(plan.row)).toBe(false);
    }
  });

  it('bricht bei doppeltem Kopf ab, bevor eine Zeile gesucht wird', () => {
    const plan = planFor(loadTable('duplicate-headers'), day(11, 1, 2030), { Steps: 9000 });
    expect(plan).toEqual({ ok: false, error: 'header_ambiguous', detail: 'Steps' });
  });
});
