import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getLogAccess, isValidEndpoint, saveLogAccess } from '../src/config/logAccess';
import { clearDraft, draftKey, entryKey, loadDraft, saveField } from '../src/log/draft';
import { buildEntries, isLocked, MAX_LENGTH } from '../src/log/send';
import { firstOpenWeek, readLogTab, type LogExercise } from '../src/log/tab';

/**
 * Tests der App Seite von Training eintragen (Phase 13.4).
 *
 * Die Tabs unter test/fixtures/training-log/ sind dieselben synthetischen Tabs
 * wie fuer das Script. So lesen App und Script nachweislich dieselben Zeilen.
 */

function loadRows(name: string): string[][] {
  const url = new URL(`./fixtures/training-log/${name}.json`, import.meta.url);
  return (JSON.parse(readFileSync(url, 'utf8')) as { display: string[][] }).display;
}

class MemoryStorage {
  private items = new Map<string, string>();
  getItem(key: string): string | null { return this.items.get(key) ?? null; }
  setItem(key: string, value: string): void { this.items.set(key, value); }
  removeItem(key: string): void { this.items.delete(key); }
}

const withNotes = readLogTab(loadRows('with-notes'))!;
const withoutNotes = readLogTab(loadRows('without-notes'))!;

describe('readLogTab', () => {
  it('findet die Tage ueber ihre Kopfzeilen', () => {
    expect(withNotes.days.map((day) => day.label)).toEqual(['Day 1 - Push', 'Day 2 - Beine']);
    expect(withNotes.weekCount).toBe(3);
  });

  it('liest Soll und Ist der ersten Woche, doppelte Uebung mit occurrence', () => {
    const week = withNotes.days[0]!.weeks[0]!;
    expect(week.map((e) => [e.name, e.occurrence])).toEqual([['Bankdrücken', 1], ['Bankdrücken', 2], ['Rudern Kabel', 1]]);
    expect(week[0]).toEqual({
      name: 'Bankdrücken', occurrence: 1, sets: '2', repsTarget: '6-8', rir: '2', tempo: '3-1-X-0',
      load: '60', repsActual: '8,8', notes: '',
    });
  });

  it('endet an der ersten leeren Zeile, Summenzeilen darunter zaehlen nicht', () => {
    const rows = loadRows('with-notes').map((row) => [...row]);
    const summary = rows[7]!.map(() => '');
    summary[4] = 'Satzzahl';
    summary[11] = '6';
    rows[7] = rows[7]!.map(() => '');
    rows.splice(8, 0, summary);
    const week = readLogTab(rows)!.days[0]!.weeks[0]!;
    expect(week.map((e) => e.name)).toEqual(['Bankdrücken', 'Bankdrücken', 'Rudern Kabel']);
  });

  it('liefert Notes als null, wenn der Tab die Spalte nicht hat', () => {
    expect(withoutNotes.days[0]!.weeks[1]![0]!.notes).toBeNull();
  });

  it('gibt null ohne Kopfzeile mit Wochenbloecken', () => {
    expect(readLogTab([['Date', 'Weight'], ['1.1.2030', '80']])).toBeNull();
  });

  it('markiert einen Block ohne Load als null statt zu raten', () => {
    const rows = loadRows('with-notes').map((row) => [...row]);
    rows[3]![22] = 'Last';
    expect(readLogTab(rows)!.days[0]!.weeks[1]).toBeNull();
  });
});

describe('firstOpenWeek', () => {
  it('waehlt die erste Woche ohne Reps Ist', () => {
    expect(firstOpenWeek(withNotes.days[0]!)).toBe(1);
    expect(firstOpenWeek(withNotes.days[1]!)).toBe(0);
  });

  it('waehlt die letzte Woche, wenn alle eingetragen sind', () => {
    const done = { label: 'X', weeks: [[exercise({ repsActual: '8' })], [exercise({ repsActual: '9' })]] };
    expect(firstOpenWeek(done)).toBe(1);
  });
});

function exercise(fields: Partial<LogExercise> = {}): LogExercise {
  return {
    name: 'Bankdrücken', occurrence: 1, sets: '2', repsTarget: '6-8', rir: '2', tempo: '',
    load: '', repsActual: '', notes: '', ...fields,
  };
}

describe('buildEntries', () => {
  it('nimmt nur gefuellte Felder leerer Zellen', () => {
    const exercises = [exercise({ load: '60' }), exercise({ occurrence: 2 }), exercise({ name: 'Rudern Kabel' })];
    const draft = {
      [entryKey('Bankdrücken', 1)]: { load: '70', repsActual: ' 8,8 ' },
      [entryKey('Bankdrücken', 2)]: { notes: 'gut' },
      [entryKey('Rudern Kabel', 1)]: { load: '  ' },
    };
    expect(buildEntries(exercises, draft)).toEqual([
      { exercise: 'Bankdrücken', occurrence: 1, repsActual: '8,8' },
      { exercise: 'Bankdrücken', occurrence: 2, notes: 'gut' },
    ]);
  });

  it('sendet Notes nie ohne Spalte und kuerzt auf die Hoechstlaenge', () => {
    const draft = { [entryKey('Bankdrücken', 1)]: { notes: 'x', load: '9'.repeat(30) } };
    expect(buildEntries([exercise({ notes: null })], draft)).toEqual([
      { exercise: 'Bankdrücken', occurrence: 1, load: '9'.repeat(MAX_LENGTH.load) },
    ]);
  });

  it('sperrt belegte Felder und fehlende Spalten', () => {
    expect(isLocked(exercise({ load: '60' }), 'load')).toBe(true);
    expect(isLocked(exercise({ notes: null }), 'notes')).toBe(true);
    expect(isLocked(exercise(), 'repsActual')).toBe(false);
  });
});

describe('Entwurf und Zugang im localStorage', () => {
  let storage: MemoryStorage;

  beforeEach(() => {
    storage = new MemoryStorage();
    vi.stubGlobal('localStorage', storage);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('haelt Felder je Tab, Woche und Tag und entfernt leere', () => {
    const key = draftKey('Mesocycle 2', 2, 'Day 1 - Push');
    saveField(key, entryKey('Bankdrücken', 1), 'load', '62,5');
    saveField(key, entryKey('Bankdrücken', 1), 'repsActual', '8');
    expect(loadDraft(key)).toEqual({ 'Bankdrücken#1': { load: '62,5', repsActual: '8' } });
    expect(loadDraft(draftKey('Mesocycle 2', 3, 'Day 1 - Push'))).toEqual({});

    saveField(key, entryKey('Bankdrücken', 1), 'load', '');
    saveField(key, entryKey('Bankdrücken', 1), 'repsActual', ' ');
    expect(loadDraft(key)).toEqual({});
    expect(storage.getItem('fitness_log_draft_v1')).toBe('{}');
  });

  it('leert den Entwurf eines Tags, andere bleiben', () => {
    const sent = draftKey('Mesocycle 2', 1, 'Day 1 - Push');
    const other = draftKey('Mesocycle 2', 1, 'Day 2 - Beine');
    saveField(sent, 'Bankdrücken#1', 'load', '60');
    saveField(other, 'Kniebeuge#1', 'load', '100');
    clearDraft(sent);
    expect(loadDraft(sent)).toEqual({});
    expect(loadDraft(other)).toEqual({ 'Kniebeuge#1': { load: '100' } });
  });

  it('nimmt als Endpunkt nur Web Apps von Apps Script', () => {
    expect(isValidEndpoint('https://script.google.com/macros/s/ID/exec')).toBe(true);
    expect(isValidEndpoint('https://script.google.com.example.com/x')).toBe(false);
    expect(isValidEndpoint('http://script.google.com/macros/s/ID/exec')).toBe(false);
    expect(isValidEndpoint('https://example.com/exec')).toBe(false);
  });

  it('gibt Zugang nur mit gueltigem Endpunkt und Token heraus', () => {
    expect(getLogAccess()).toBeNull();
    saveLogAccess('https://script.google.com/macros/s/ID/exec', 'token');
    expect(getLogAccess()).toEqual({ endpoint: 'https://script.google.com/macros/s/ID/exec', token: 'token' });
    saveLogAccess('https://example.com/exec', 'token');
    expect(getLogAccess()).toBeNull();
    saveLogAccess('', '');
    expect(storage.getItem('fitness_log_access_v1')).toBeNull();
  });
});
