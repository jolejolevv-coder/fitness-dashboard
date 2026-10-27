import { readFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';
import { beforeEach, describe, expect, it } from 'vitest';

/**
 * Tests der Huelle `doPost` (Phase 13.3, schliesst 10.2 mit ab; 13.5 eigenstaendig ueber `SHEET_ID`).
 *
 * Alle drei Dateien unter apps-script/ laufen in einem vm Kontext, dazu
 * nachgebaute Dienste von Apps Script: SpreadsheetApp.openById mit Tabs aus den
 * synthetischen Fixtures, PropertiesService, LockService, ContentService.
 */

interface Fixture {
  formulas: Record<string, Record<string, string>>;
  display: string[][];
}

interface Write { sheet: string; row: number; column: number; value: unknown }

function loadFixture(path: string): Fixture {
  return JSON.parse(readFileSync(new URL(`./fixtures/${path}.json`, import.meta.url), 'utf8')) as Fixture;
}

/** Tab mit Anzeigewerten und Formeln, protokolliert jedes setValue. */
function fakeSheet(name: string, fixture: Fixture, writes: Write[]) {
  const display = fixture.display.map((row) => [...row]);
  const formulas = display.map((row, index) =>
    row.map((_, column) => fixture.formulas[String(index + 1)]?.[String(column)] ?? ''));
  return {
    display,
    getDataRange: () => ({
      getDisplayValues: () => display.map((row) => [...row]),
      getFormulas: () => formulas.map((row) => [...row]),
    }),
    getRange: (row: number, column: number) => ({
      setValue: (value: unknown) => {
        writes.push({ sheet: name, row, column, value });
        display[row - 1]![column - 1] = String(value);
      },
    }),
  };
}

const DAILY_TOKEN = 'daily-token-0123456789abcdef';
const TRAINING_TOKEN = 'training-token-0123456789abcdef';

let writes: Write[];
let properties: Record<string, string>;
let lockFree: boolean;
let sheets: Record<string, ReturnType<typeof fakeSheet>>;
let doPost: (event: unknown) => { content: string };
let openedIds: string[];

function load(): void {
  const context = createContext({
    SpreadsheetApp: {
      openById: (id: string) => {
        openedIds.push(id);
        return { getSheetByName: (name: string) => sheets[name] ?? null };
      },
    },
    PropertiesService: { getScriptProperties: () => ({ getProperty: (name: string) => properties[name] ?? null }) },
    LockService: { getScriptLock: () => ({ tryLock: () => lockFree, releaseLock: () => undefined }) },
    ContentService: {
      MimeType: { JSON: 'json' },
      createTextOutput: (content: string) => ({ content, setMimeType() { return this; } }),
    },
  });
  for (const file of ['daily-import-core.js', 'training-log-core.js', 'daily-import.js']) {
    runInContext(readFileSync(new URL(`../apps-script/${file}`, import.meta.url), 'utf8'), context, { filename: file });
  }
  doPost = (context as unknown as { doPost: typeof doPost }).doPost;
}

function post(body: unknown): Record<string, unknown> {
  const contents = typeof body === 'string' ? body : JSON.stringify(body);
  return JSON.parse(doPost({ postData: { contents } }).content) as Record<string, unknown>;
}

beforeEach(() => {
  writes = [];
  openedIds = [];
  lockFree = true;
  properties = { SHEET_ID: 'sheet-id-test', DAILY_IMPORT_TOKEN: DAILY_TOKEN, TRAINING_TOKEN, HEADER_ROW: '3', FIRST_DATA_ROW: '5' };
  sheets = {
    'Daily Tracking': fakeSheet('Daily Tracking', loadFixture('daily-import/week-blocks'), writes),
    'Mesocycle 2': fakeSheet('Mesocycle 2', loadFixture('training-log/with-notes'), writes),
    'Mesocycle 1': fakeSheet('Mesocycle 1', loadFixture('training-log/without-notes'), writes),
  };
  load();
});

const training = (fields: Record<string, unknown> = {}) => ({
  token: TRAINING_TOKEN, action: 'training', sheet: 'Mesocycle 2', week: 2, day: 'Day 1 - Push',
  entries: [{ exercise: 'Bankdrücken', load: '62,5', repsActual: '9-9', notes: '=SUM(A1)' }],
  ...fields,
});

describe('doPost training', () => {
  it('schreibt leere Zellen und meldet je Feld', () => {
    const result = post(training());
    expect(result).toMatchObject({ ok: true, version: '13.5' });
    expect(result['results']).toEqual([{
      exercise: 'Bankdrücken', occurrence: 1, status: { load: 'written', repsActual: 'written', notes: 'written' },
    }]);
    // Zahl als Zahl, alles andere als Text: kein Datum aus 9-9, keine Formel aus =.
    expect(writes).toEqual([
      { sheet: 'Mesocycle 2', row: 5, column: 23, value: 62.5 },
      { sheet: 'Mesocycle 2', row: 5, column: 24, value: "'9-9" },
      { sheet: 'Mesocycle 2', row: 5, column: 26, value: "'=SUM(A1)" },
    ]);
  });

  it('ein zweiter Lauf schreibt nichts und meldet occupied', () => {
    post(training());
    writes.length = 0;
    const result = post(training());
    expect(writes).toEqual([]);
    expect((result['results'] as { status: unknown }[])[0]!.status)
      .toEqual({ load: 'occupied', repsActual: 'occupied', notes: 'occupied' });
  });

  it('falsches Token: unauthorized, keine Zelle aendert sich', () => {
    expect(post(training({ token: 'falsch' }))).toMatchObject({ ok: false, error: 'unauthorized' });
    expect(writes).toEqual([]);
  });

  it('das Token des Daily Import gilt nicht fuer training', () => {
    expect(post(training({ token: DAILY_TOKEN }))).toMatchObject({ ok: false, error: 'unauthorized' });
  });

  it('ohne Property TRAINING_TOKEN wird jede Anfrage abgelehnt', () => {
    delete properties['TRAINING_TOKEN'];
    expect(post(training())).toMatchObject({ ok: false, error: 'unauthorized' });
  });

  it('unbekannter Tab, Tag oder Woche bricht vor dem Schreiben ab', () => {
    expect(post(training({ sheet: 'Mesocycle 7' }))).toMatchObject({ ok: false, error: 'unknown_sheet' });
    expect(post(training({ day: 'Day 9' }))).toMatchObject({ ok: false, error: 'unknown_day' });
    expect(post(training({ week: 4 }))).toMatchObject({ ok: false, error: 'unknown_week' });
    expect(writes).toEqual([]);
  });

  it('eine unbekannte Uebung stoppt die anderen Eintraege nicht', () => {
    const result = post(training({
      entries: [{ exercise: 'Kniebeuge', load: '100' }, { exercise: 'Rudern Kabel', repsActual: '10' }],
    }));
    expect(result['results']).toEqual([
      { exercise: 'Kniebeuge', occurrence: 1, error: 'unknown_exercise' },
      { exercise: 'Rudern Kabel', occurrence: 1, status: { repsActual: 'written' } },
    ]);
    expect(writes).toEqual([{ sheet: 'Mesocycle 2', row: 7, column: 24, value: 10 }]);
  });

  it('Tab ohne Notes: Notes unknown_column, Rest geschrieben', () => {
    const result = post(training({ sheet: 'Mesocycle 1', entries: [{ exercise: 'Bankdrücken', load: '60', notes: 'x' }] }));
    expect((result['results'] as { status: unknown }[])[0]!.status).toEqual({ load: 'written', notes: 'unknown_column' });
    expect(writes).toHaveLength(1);
  });

  it('meldet locked, wenn ein anderer Lauf die Sperre haelt', () => {
    lockFree = false;
    expect(post(training())).toMatchObject({ ok: false, error: 'locked' });
    expect(writes).toEqual([]);
  });
});

describe('doPost daily', () => {
  const daily = (fields: Record<string, unknown> = {}) => ({
    token: DAILY_TOKEN, date: '11.1.2030', values: { Protein: 180, Steps: 9000 }, ...fields,
  });

  it('ohne action laeuft der Daily Import wie bisher', () => {
    const result = post(daily());
    expect(result).toMatchObject({ ok: true, written: ['Protein', 'Steps'], skipped: [] });
    expect(writes.map((w) => [w.sheet, w.row])).toEqual([['Daily Tracking', 9], ['Daily Tracking', 9]]);
  });

  it('das Token von training gilt nicht fuer daily', () => {
    expect(post(daily({ token: TRAINING_TOKEN, action: 'daily' }))).toMatchObject({ ok: false, error: 'unauthorized' });
  });

  it('unbekannter Kopf bricht ab, bevor etwas geschrieben wird', () => {
    expect(post(daily({ values: { Protein: 180, Puls: 60 } }))).toMatchObject({ ok: false, error: 'header_missing' });
    expect(writes).toEqual([]);
  });
});

describe('doPost allgemein', () => {
  it('oeffnet das Blatt aus SHEET_ID', () => {
    post(training());
    expect(openedIds).toEqual(['sheet-id-test']);
  });

  it('ohne SHEET_ID: not_configured, nichts geoeffnet', () => {
    delete properties['SHEET_ID'];
    expect(post(training())).toMatchObject({ ok: false, error: 'not_configured' });
    expect(openedIds).toEqual([]);
    expect(writes).toEqual([]);
  });

  it('falsches Token wird vor SHEET_ID geprueft', () => {
    delete properties['SHEET_ID'];
    expect(post(training({ token: 'falsch' }))).toMatchObject({ ok: false, error: 'unauthorized' });
  });

  it('unbekannte Aktion und kaputter Rumpf ergeben bad_request', () => {
    expect(post({ action: 'delete', token: TRAINING_TOKEN })).toMatchObject({ ok: false, error: 'bad_request' });
    expect(post('kein json')).toMatchObject({ ok: false, error: 'bad_request' });
  });

  it('ein Fehler im Tab wird zu internal ohne Details', () => {
    sheets['Mesocycle 2']!.getDataRange = () => { throw new Error('Zelle 62,5'); };
    expect(post(training())).toEqual({ ok: false, error: 'internal', detail: '', version: '13.5' });
  });
});
