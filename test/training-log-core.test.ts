import { readFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';
import { describe, expect, it } from 'vitest';

/**
 * Tests der Kernlogik von Training eintragen (Phase 13.2).
 *
 * Wie im Apps Script Editor teilen sich daily-import-core.js und
 * training-log-core.js einen globalen Namensraum, deshalb laufen beide in
 * denselben vm Kontext.
 *
 * Die Tabs unter test/fixtures/training-log/ sind synthetisch, alle Werte
 * erfunden. Sie bilden den Aufbau eines Mesocycle Tabs nach, siehe
 * specs/sheet-structure.md: Kopfzeile je Tag, Wochenbloecke ueber `Excercise`
 * mit Abstand 12, dann 11, zweimal `Reps` (Soll vor, Ist nach `Load`).
 */

type Failure = { ok: false; error: string; detail: string };
type Entry = { exercise: string; occurrence: number; load?: string; repsActual?: string; notes?: string };
type Columns = { exercise: number; load: number; repsActual: number; notes: number | null };
type Status = Partial<Record<'load' | 'repsActual' | 'notes', string>>;

interface Core {
  validateTrainingRequest(rawBody: unknown, expectedToken: unknown):
    { ok: true; sheet: string; week: number; day: string; entries: Entry[] } | Failure;
  findDayHeader(grid: string[][], day: string): { ok: true; row: number } | Failure;
  findWeekBlock(headerCells: string[], week: number): { ok: true; columns: Columns } | Failure;
  findExerciseRow(grid: string[][], headerRow: number, exerciseColumn: number, exercise: string, occurrence: number):
    { ok: true; row: number } | Failure;
  planTrainingWrites(rowDisplay: string[], rowFormulas: string[], columns: Columns, entry: Partial<Entry>):
    { ok: true; writes: { field: string; column: number; value: string }[]; status: Status };
}

interface Tab {
  description: string;
  formulas: Record<string, Record<string, string>>;
  display: string[][];
}

function loadCore(): Core {
  const context = createContext({});
  for (const file of ['daily-import-core.js', 'training-log-core.js']) {
    const source = readFileSync(new URL(`../apps-script/${file}`, import.meta.url), 'utf8');
    runInContext(source, context, { filename: file });
  }
  return context as unknown as Core;
}

function loadTab(name: string): Tab {
  const url = new URL(`./fixtures/training-log/${name}.json`, import.meta.url);
  return JSON.parse(readFileSync(url, 'utf8')) as Tab;
}

function formulaRow(tab: Tab, row: number): string[] {
  const cells = tab.formulas[String(row)] ?? {};
  const width = tab.display[row - 1]!.length;
  return Array.from({ length: width }, (_, column) => cells[String(column)] ?? '');
}

function expectOk<T extends { ok: boolean }>(result: T | Failure): T {
  if (!result.ok) throw new Error(`expected ok, got ${(result as Failure).error}: ${(result as Failure).detail}`);
  return result as T;
}

function expectError(result: { ok: boolean }, code: string): void {
  expect(result.ok).toBe(false);
  expect((result as Failure).error).toBe(code);
}

const core = loadCore();
const TOKEN = 'training-token-0123456789abcdef';
const withNotes = loadTab('with-notes');
const withoutNotes = loadTab('without-notes');

/** Kompletter Weg von Tag, Woche und Uebung bis zur Zeile, wie ihn die Huelle geht. */
function locate(tab: Tab, day: string, week: number, exercise: string, occurrence = 1) {
  const header = expectOk(core.findDayHeader(tab.display, day));
  const block = expectOk(core.findWeekBlock(tab.display[header.row - 1]!, week));
  const row = expectOk(core.findExerciseRow(tab.display, header.row, block.columns.exercise, exercise, occurrence));
  return { columns: block.columns, row: row.row };
}

describe('validateTrainingRequest', () => {
  const valid = {
    token: TOKEN, action: 'training', sheet: 'Mesocycle 2', week: 3, day: 'Day 1 - Push',
    entries: [{ exercise: 'Bankdrücken', load: '55x2', repsActual: '10,9,8', notes: '' }],
  };
  const send = (fields: Record<string, unknown>) => core.validateTrainingRequest(JSON.stringify({ ...valid, ...fields }), TOKEN);

  it('nimmt eine gueltige Anfrage an und verwirft leere Felder', () => {
    const result = expectOk(send({}));
    expect(result.week).toBe(3);
    expect(result.entries).toEqual([{ exercise: 'Bankdrücken', occurrence: 1, load: '55x2', repsActual: '10,9,8' }]);
  });

  it('prueft das Token vor allem anderen', () => {
    expectError(send({ token: 'falsch', week: 'x' }), 'unauthorized');
    expectError(core.validateTrainingRequest(JSON.stringify(valid), ''), 'unauthorized');
  });

  it('lehnt Tabs ausserhalb von Mesocycle N ab', () => {
    expectError(send({ sheet: 'Daily Tracking' }), 'unknown_sheet');
  });

  it('verlangt Woche, Tag und Eintraege', () => {
    expectError(send({ week: 0 }), 'bad_request');
    expectError(send({ week: 1.5 }), 'bad_request');
    expectError(send({ day: ' ' }), 'bad_request');
    expectError(send({ entries: [] }), 'bad_request');
    expectError(core.validateTrainingRequest('kein json', TOKEN), 'bad_request');
  });

  it('verlangt je Eintrag mindestens ein Feld und haelt die Hoechstlaengen', () => {
    expectError(send({ entries: [{ exercise: 'Bankdrücken', load: ' ' }] }), 'bad_request');
    expectError(send({ entries: [{ exercise: 'Bankdrücken', load: 'x'.repeat(21) }] }), 'bad_request');
    expectError(send({ entries: [{ exercise: 'Bankdrücken', notes: 'x'.repeat(201) }] }), 'bad_request');
    expectError(send({ entries: [{ exercise: 'Bankdrücken', load: 60 }] }), 'bad_request');
    expectError(send({ entries: [{ exercise: 'Bankdrücken', load: '60', occurrence: 0 }] }), 'bad_request');
  });
});

describe('findDayHeader', () => {
  it('findet die Kopfzeile des Tages', () => {
    expect(expectOk(core.findDayHeader(withNotes.display, 'Day 2 - Beine')).row).toBe(9);
  });

  it('meldet einen unbekannten Tag', () => {
    expectError(core.findDayHeader(withNotes.display, 'Day 7'), 'unknown_day');
  });
});

describe('findWeekBlock', () => {
  const header = withNotes.display[3]!;

  it('liest Load, Reps Ist und Notes ueber die Koepfe, trotz wechselndem Abstand', () => {
    expect(expectOk(core.findWeekBlock(header, 1)).columns).toEqual({ exercise: 4, load: 10, repsActual: 11, notes: 13 });
    expect(expectOk(core.findWeekBlock(header, 2)).columns).toEqual({ exercise: 16, load: 22, repsActual: 23, notes: 25 });
    expect(expectOk(core.findWeekBlock(header, 3)).columns).toEqual({ exercise: 27, load: 33, repsActual: 34, notes: 36 });
  });

  it('liefert Notes als null, wenn der Tab die Spalte nicht hat', () => {
    expect(expectOk(core.findWeekBlock(withoutNotes.display[3]!, 2)).columns.notes).toBeNull();
  });

  it('meldet eine Woche ausserhalb der Bloecke', () => {
    expectError(core.findWeekBlock(header, 0), 'unknown_week');
    expectError(core.findWeekBlock(header, 4), 'unknown_week');
  });

  it('meldet eine fehlende Spalte Load statt zu raten', () => {
    const broken = header.map((cell, column) => (column === 22 ? 'Last' : cell));
    expectError(core.findWeekBlock(broken, 2), 'unknown_column');
  });
});

describe('findExerciseRow', () => {
  it('findet die Uebung nur unter dem gewaehlten Tag', () => {
    expect(locate(withNotes, 'Day 1 - Push', 1, 'Rudern Kabel').row).toBe(7);
    expect(locate(withNotes, 'Day 2 - Beine', 1, 'Rudern Kabel').row).toBe(11);
  });

  it('waehlt bei doppelter Uebung das n te Vorkommen', () => {
    expect(locate(withNotes, 'Day 1 - Push', 1, 'Bankdrücken', 2).row).toBe(6);
  });

  it('meldet eine Uebung, die am Tag nicht vorkommt', () => {
    const header = expectOk(core.findDayHeader(withNotes.display, 'Day 1 - Push'));
    expectError(core.findExerciseRow(withNotes.display, header.row, 4, 'Kniebeuge', 1), 'unknown_exercise');
    expectError(core.findExerciseRow(withNotes.display, header.row, 4, 'Bankdrücken', 3), 'unknown_exercise');
  });
});

describe('planTrainingWrites', () => {
  function plan(tab: Tab, day: string, week: number, entry: Partial<Entry> & { exercise: string }) {
    const { columns, row } = locate(tab, day, week, entry.exercise, entry.occurrence ?? 1);
    return core.planTrainingWrites(tab.display[row - 1]!, formulaRow(tab, row), columns, entry);
  }

  it('schreibt nur leere Zellen', () => {
    const result = plan(withNotes, 'Day 1 - Push', 2, { exercise: 'Bankdrücken', load: '62,5', repsActual: '8,7', notes: 'gut' });
    expect(result.writes).toEqual([
      { field: 'load', column: 22, value: '62,5' },
      { field: 'repsActual', column: 23, value: '8,7' },
      { field: 'notes', column: 25, value: 'gut' },
    ]);
    expect(result.status).toEqual({ load: 'written', repsActual: 'written', notes: 'written' });
  });

  it('laesst belegte Zellen stehen und meldet occupied', () => {
    const result = plan(withNotes, 'Day 1 - Push', 1, { exercise: 'Bankdrücken', load: '70', repsActual: '6', notes: 'neu' });
    expect(result.writes).toEqual([{ field: 'notes', column: 13, value: 'neu' }]);
    expect(result.status).toEqual({ load: 'occupied', repsActual: 'occupied', notes: 'written' });
  });

  it('behandelt eine Formel ohne Anzeige als belegt', () => {
    const result = plan(withNotes, 'Day 1 - Push', 2, { exercise: 'Rudern Kabel', load: '50' });
    expect(result.writes).toEqual([]);
    expect(result.status).toEqual({ load: 'occupied' });
  });

  it('meldet Notes ohne Spalte als unknown_column und schreibt den Rest', () => {
    const result = plan(withoutNotes, 'Day 2 - Beine', 1, { exercise: 'Kniebeuge', load: '100', notes: 'tief' });
    expect(result.writes).toEqual([{ field: 'load', column: 10, value: '100' }]);
    expect(result.status).toEqual({ load: 'written', notes: 'unknown_column' });
  });

  it('beruehrt keine Spalte ausserhalb von Load, Reps Ist und Notes der Woche', () => {
    const { columns } = locate(withNotes, 'Day 1 - Push', 3, 'Bankdrücken', 2);
    const result = plan(withNotes, 'Day 1 - Push', 3, { exercise: 'Bankdrücken', occurrence: 2, load: '1', repsActual: '2', notes: '3' });
    const allowed = [columns.load, columns.repsActual, columns.notes];
    for (const write of result.writes) expect(allowed).toContain(write.column);
  });
});
