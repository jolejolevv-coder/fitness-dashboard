import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getLogbookAccess, saveLogbookAccess } from '../src/config/logbookAccess';
import { parsePlan } from '../src/parse/plan';
import { readLoggedHistory } from '../src/parse/trainingSets';
import {
  buildRows, defaultDay, doneCount, ensureSets, isRangeFull, loadSession, markSent, newSession, pruneSessions,
  rangeFor, rangeTop, saveSession, sessionId, KEEP_SENT_DAYS, type Session,
} from '../src/logbook/session';
import { flushPending, sendSession } from '../src/logbook/sync';

/** Logbuch Formular, Logik ohne DOM (Phase 20.2), synthetische Daten. */

class MemoryStorage {
  private items = new Map<string, string>();
  getItem(key: string): string | null { return this.items.get(key) ?? null; }
  setItem(key: string, value: string): void { this.items.set(key, value); }
  removeItem(key: string): void { this.items.delete(key); }
}

function fixture(name: string): string[][] {
  const url = new URL(`./fixtures/${name}.json`, import.meta.url);
  return (JSON.parse(readFileSync(url, 'utf8')) as { values: string[][] }).values;
}

const plan = parsePlan(fixture('plan/plan'));
const day1 = plan.days[0]!;
const [bench, fly] = day1.exercises as [typeof day1.exercises[0], typeof day1.exercises[0]];
const ACCESS = { endpoint: 'https://script.google.com/macros/s/x/exec', token: 't0k' };

function filledSession(): Session {
  const session = newSession('2026-11-05', 'Tag 1');
  ensureSets(session, bench);
  session.sets[bench.id] = [
    { kg: '70', reps: '7', done: true },
    { kg: '72.5', reps: '', done: true },
  ];
  session.sets[fly.id] = [{ kg: '20', reps: '12', done: false }];
  return session;
}

beforeEach(() => {
  vi.stubGlobal('localStorage', new MemoryStorage());
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Satzzeilen', () => {
  it('sendet nur abgehakte Saetze im Format des Logbuchs', () => {
    expect(buildRows(filledSession(), day1)).toEqual([
      ['2026-11-05', 'Tag 1', 'Bench Press', 'Chest', 1, 70, 7],
      ['2026-11-05', 'Tag 1', 'Bench Press', 'Chest', 2, 72.5, ''],
    ]);
  });

  it('liest kg mit Komma und bildet die Kennung', () => {
    const session = newSession('2026-11-05', 'Tag 1');
    session.sets[fly.id] = [{ kg: '7,5', reps: '12', done: true }];
    expect(buildRows(session, day1)[0]).toEqual(['2026-11-05', 'Tag 1', 'Cable Fly', 'Chest', 1, 7.5, 12]);
    expect(sessionId('2026-11-05', 'Tag 1')).toBe('2026-11-05_Tag-1');
  });

  it('fuellt Saetze auf die Plan Satzzahl und zaehlt den Fortschritt', () => {
    const session = filledSession();
    expect(ensureSets(session, bench)).toHaveLength(2);
    expect(doneCount(session, day1)).toEqual({ done: 2, total: 8 });
  });
});

describe('Range', () => {
  it('nimmt r1 fuer Satz 1 und r2 fuer die weiteren, ohne r2 r1', () => {
    expect(rangeFor(bench, 0)).toBe('5-7');
    expect(rangeFor(bench, 1)).toBe('6-9');
    expect(rangeFor(fly, 1)).toBe('9-12');
    expect(rangeTop('6-9')).toBe(9);
    expect(rangeTop('12')).toBe(12);
  });

  it('erkennt eine volle Range nur mit allen Saetzen am Ende', () => {
    const full = { date: '2026-11-03', sets: [{ kg: 70, reps: 7 }, { kg: 70, reps: 9 }] };
    expect(isRangeFull(bench, full)).toBe(true);
    expect(isRangeFull(bench, { ...full, sets: [{ kg: 70, reps: 7 }, { kg: 70, reps: 8 }] })).toBe(false);
    expect(isRangeFull(bench, { ...full, sets: [{ kg: 70, reps: 7 }] })).toBe(false);
    expect(isRangeFull(bench, null)).toBe(false);
  });
});

describe('Tageswahl', () => {
  it('waehlt den Tag nach dem Wochentag im Label', () => {
    expect(defaultDay(plan, new Date(2026, 10, 2), null)!.tag).toBe('Tag 1'); // Montag
    expect(defaultDay(plan, new Date(2026, 10, 4), null)!.tag).toBe('Tag 2'); // Mittwoch
  });

  it('nimmt sonst den Tag nach der letzten Einheit und kehrt am Ende um', () => {
    expect(defaultDay(plan, new Date(2026, 10, 3), 'Tag 1')!.tag).toBe('Tag 2'); // Dienstag
    expect(defaultDay(plan, new Date(2026, 10, 3), 'Tag 2')!.tag).toBe('Tag 1');
    expect(defaultDay(plan, new Date(2026, 10, 3), null)!.tag).toBe('Tag 1');
    expect(defaultDay({ days: [] }, new Date(), null)).toBeNull();
  });
});

describe('Ablage der Sitzung', () => {
  it('speichert sofort und markiert als offen', () => {
    const session = filledSession();
    saveSession('id1', session, 1000);
    expect(loadSession('id1')).toMatchObject({ pending: true, updated: 1000 });
  });

  it('markSent gilt nur, wenn sich nichts seit dem Senden geaendert hat', () => {
    const session = filledSession();
    saveSession('id1', session, 1000);
    saveSession('id1', session, 2000);
    expect(markSent('id1', 1000)).toBe(false);
    expect(loadSession('id1')!.pending).toBe(true);
    expect(markSent('id1', 2000)).toBe(true);
    expect(loadSession('id1')!.pending).toBe(false);
  });

  it('raeumt gesendete Sitzungen nach der Frist ab, offene nie', () => {
    const day = 864e5;
    saveSession('alt-gesendet', filledSession(), 0);
    markSent('alt-gesendet', 0);
    saveSession('alt-offen', filledSession(), 0);
    pruneSessions((KEEP_SENT_DAYS + 1) * day);
    expect(loadSession('alt-gesendet')).toBeNull();
    expect(loadSession('alt-offen')).not.toBeNull();
  });
});

describe('Senden', () => {
  const daysByTag = new Map(plan.days.map((d) => [d.tag, d]));

  it('schickt token, id, data und rows als text/plain ohne Content Type', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ json: () => Promise.resolve({ ok: true }) });
    vi.stubGlobal('fetch', fetchMock);
    const result = await sendSession(ACCESS, filledSession(), day1);
    expect(result).toEqual({ ok: true });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe(ACCESS.endpoint);
    expect(init.headers).toBeUndefined();
    const body = JSON.parse(init.body as string);
    expect(body.token).toBe('t0k');
    expect(body.id).toBe('2026-11-05_Tag-1');
    expect(body.rows).toHaveLength(2);
    expect(body.data.tag).toBe('Tag 1');
  });

  it('meldet Fehler des Scripts und Netzausfall, die Sitzung bleibt offen', async () => {
    saveSession('2026-11-05_Tag-1', filledSession(), 1000);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ json: () => Promise.resolve({ error: 'unauthorized' }) }));
    expect(await flushPending(ACCESS, daysByTag)).toMatchObject({ sent: 0, error: 'unauthorized', remaining: 1 });
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')));
    expect(await flushPending(ACCESS, daysByTag)).toMatchObject({ sent: 0, error: 'kein Netz', remaining: 1 });
    expect(loadSession('2026-11-05_Tag-1')!.pending).toBe(true);
  });

  it('sendet offene Sitzungen nach der Rueckkehr und schliesst sie ab', async () => {
    saveSession('2026-11-05_Tag-1', filledSession(), 1000);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ json: () => Promise.resolve({ ok: true }) }));
    expect(await flushPending(ACCESS, daysByTag)).toEqual({ sent: 1, error: null, remaining: 0 });
    expect(loadSession('2026-11-05_Tag-1')!.pending).toBe(false);
  });
});

describe('Zugang', () => {
  it('liegt unter eigenem Schluessel und verlangt eine Apps Script Adresse', () => {
    saveLogbookAccess('https://evil.example/', 'x');
    expect(getLogbookAccess()).toBeNull();
    saveLogbookAccess(ACCESS.endpoint, ACCESS.token);
    expect(getLogbookAccess()).toEqual(ACCESS);
    saveLogbookAccess('', '');
    expect(getLogbookAccess()).toBeNull();
  });
});

describe('Letztes Mal aus TrainingSets', () => {
  const header = ['id', 'date', 'tag', 'exercise', 'muscle', 'set', 'kg', 'reps'];
  const rows = [
    header,
    ['a', '2026-11-03', 'Tag 1', 'Bench Press', 'Chest', '1', '70', '7'],
    ['a', '2026-11-03', 'Tag 1', 'Bench Press', 'Chest', '2', '72,5', '8'],
    ['b', '2026-10-27', 'Tag 1', 'Bench Press', 'Chest', '1', '65', '9'],
    ['c', '2026-11-03', 'Tag 2', 'Bench Press', 'Chest', '1', '50', '10'],
    ['d', '2026-11-05', 'Tag 1', 'Bench Press', 'Chest', '1', '80', '5'],
  ];

  it('nimmt je Tag und Uebung die juengste Einheit in Satzreihenfolge', () => {
    const history = readLoggedHistory(rows, '2026-11-05');
    expect(history.last.get('Tag 1||Bench Press')).toEqual({
      date: '2026-11-03',
      sets: [{ kg: 70, reps: 7 }, { kg: 72.5, reps: 8 }],
    });
    expect(history.last.get('Tag 2||Bench Press')!.sets).toEqual([{ kg: 50, reps: 10 }]);
    expect(history.latest).toEqual({ date: '2026-11-03', tag: 'Tag 1' });
  });

  it('schliesst die laufende Einheit nur aus, wenn ihr Datum genannt wird', () => {
    expect(readLoggedHistory(rows).last.get('Tag 1||Bench Press')!.date).toBe('2026-11-05');
    expect(readLoggedHistory([]).latest).toBeNull();
  });
});
