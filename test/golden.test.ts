import { describe, it, expect } from 'vitest';

import { parseDaily, resolveDailyColumns } from '../src/parse/daily';
import { parseTraining } from '../src/parse/training';
import { avg, movingAvg } from '../src/analytics/smoothing';
import type { DailyEntry, SheetValues } from '../src/types';
import { hasFixtures, load } from './fixtures';

/**
 * Vergleich gegen die Ausgangsfassung.
 *
 * Die Golden Values stammen aus der urspruenglichen index.html, ausgefuehrt ueber
 * dieselben Fixtures. In Phase 1 mussten sie exakt reproduziert werden. Ab
 * Phase 2 sind Abweichungen erlaubt, aber nur die hier einzeln aufgefuehrten.
 * Jede weitere Abweichung ist ein Fehler und laesst diese Suite fallen.
 */

/** Nur die Felder, die diese Suite tatsaechlich liest. */
interface GoldenDaily {
  daily: (Record<string, unknown> & { dateObj: string })[];
  weekBlocks: { avgWeight: number | null }[];
  kpi: { badgeDays: string; movingAvgWeight: (number | null)[] };
}

interface GoldenTraining {
  mesocycle1: { exerciseCount: number; weekCount: number; currentWeek: number };
}


// Ohne lokale Testdaten bleiben die Werte leer und alle Suiten werden
// uebersprungen. Gelesen wird trotzdem beim Laden des Moduls, deshalb der Wächter.
const EMPTY = [] as SheetValues;
const dailyFixture = hasFixtures ? load<SheetValues>('test/fixtures/daily-tracking.json') : EMPTY;
const meso1Fixture = hasFixtures ? load<SheetValues>('test/fixtures/mesocycle-1.json') : EMPTY;
const meso2Fixture = hasFixtures ? load<SheetValues>('test/fixtures/mesocycle-2.json') : EMPTY;
const goldenDaily = hasFixtures
  ? load<GoldenDaily>('test/golden/daily.json')
  : ({ daily: [], weekBlocks: [], kpi: { badgeDays: '', movingAvgWeight: [] } } satisfies GoldenDaily);
const goldenTraining = hasFixtures
  ? load<GoldenTraining>('test/golden/training.json')
  : ({ mesocycle1: { exerciseCount: 0, weekCount: 0, currentWeek: 0 } } satisfies GoldenTraining);

/** Fester Stichtag, sonst haengt das Ergebnis am Ausfuehrungsdatum. */
const NOW = new Date(2026, 6, 29);

const iso = (d: Date | null): string | null =>
  d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` : null;

const parsed = hasFixtures ? parseDaily(dailyFixture, undefined, NOW) : { daily: [], weekBlocks: [] };

/**
 * Tage, die neu hinzukommen, weil ein fehlendes Gewicht die Zeile nicht mehr
 * verwirft. Am 25. und 26.06. steht ein `?` in der Gewichtsspalte, am 28. und
 * 29.07. war zum Exportzeitpunkt noch nicht gewogen.
 */
const EXPECTED_NEW_DAYS = ['2026-06-25', '2026-06-26', '2026-07-28', '2026-07-29'];

/** Einzelne Felder, die sich an bestehenden Tagen aendern duerfen. */
const EXPECTED_FIELD_CHANGES = [
  { date: '2026-07-06', field: 'digestion', before: null, after: 0, reason: 'echte Null bleibt erhalten' },
];

describe.skipIf(!hasFixtures)('Spaltenauflaesung', () => {
  it('findet alle Spalten des Daily Tracking, einschliesslich der zweiten Notizspalte', () => {
    expect(resolveDailyColumns(dailyFixture)).toMatchObject({
      date: 0, weight: 1, time: 2, protein: 4, carbs: 5, fat: 6, fiber: 7,
      fv: 8, calories: 9, note: 11, comments: 28, sleep: 12, sleepQ: 13,
      digestion: 14, stress: 16, energy: 17, steps: 18, training: 20,
    });
  });

  it('meldet eine fehlende Pflichtspalte, statt still weiterzurechnen', () => {
    const broken = dailyFixture.map((row) => row.map((c) => (c === 'Weight' ? 'Gewicht' : c)));
    expect(() => resolveDailyColumns(broken)).toThrow(/Kopfzeile|Weight/);
  });
});

describe.skipIf(!hasFixtures)('Abweichungen gegenueber der Ausgangsfassung', () => {
  const actual = new Map(parsed.daily.map((d) => [iso(d.dateObj)!, d]));
  const previous = new Map(goldenDaily.daily.map((d) => [d.dateObj, d]));

  it('fuegt genau die erwarteten Tage hinzu und entfernt keinen', () => {
    expect([...actual.keys()].filter((k) => !previous.has(k)).sort()).toEqual(EXPECTED_NEW_DAYS);
    expect([...previous.keys()].filter((k) => !actual.has(k))).toEqual([]);
  });

  it('aendert an bestehenden Tagen nur die aufgefuehrten Felder', () => {
    const changes: { date: string; field: string; before: unknown; after: unknown }[] = [];
    for (const [date, before] of previous) {
      const after = actual.get(date);
      if (!after) continue;
      for (const field of Object.keys(before)) {
        if (field === 'dateObj') continue;
        const a = (before as Record<string, unknown>)[field];
        const b = (after as unknown as Record<string, unknown>)[field];
        if (JSON.stringify(a) !== JSON.stringify(b)) changes.push({ date, field, before: a, after: b });
      }
    }
    expect(changes).toEqual(EXPECTED_FIELD_CHANGES.map(({ date, field, before, after }) => ({ date, field, before, after })));
  });
});

describe.skipIf(!hasFixtures)('Unveraendert gegenueber der Ausgangsfassung', () => {
  const weighed = parsed.daily.filter((d) => d.weight !== null && !isNaN(d.weight));

  it('haelt die Anzahl der Waegungen', () => {
    expect(`${weighed.length} Tage`).toBe(goldenDaily.kpi.badgeDays);
  });

  it('haelt das gleitende Mittel des Gewichts', () => {
    expect(movingAvg(weighed.map((r) => r.weight))).toEqual(goldenDaily.kpi.movingAvgWeight);
  });

  it('haelt die Wochenmittel aus dem Sheet', () => {
    expect(parsed.weekBlocks.map((b) => b.avgWeight)).toEqual(goldenDaily.weekBlocks.map((b) => b.avgWeight));
  });
});

describe.skipIf(!hasFixtures)('Mesocycle Tabs', () => {
  it('behaelt gleichnamige Uebungen verschiedener Trainingstage', () => {
    const actual = parseTraining(meso1Fixture)!;
    expect(Object.keys(actual.exercises).length).toBeGreaterThan(goldenTraining.mesocycle1.exerciseCount);
    expect(Object.keys(actual.exercises).length).toBe(36);
    expect(actual.weekCount).toBe(goldenTraining.mesocycle1.weekCount);
    expect(actual.currentWeek).toBe(goldenTraining.mesocycle1.currentWeek);
  });

  it('erkennt den noch leeren Folgeblock weiterhin als leer', () => {
    const actual = parseTraining(meso2Fixture);
    expect(actual?.currentWeek ?? 0).toBe(0);
    expect(Object.keys(actual?.exercises ?? {})).toEqual([]);
  });
});

describe.skipIf(!hasFixtures)('Kennzahlen ueber alle erfassten Tage', () => {
  const all: readonly DailyEntry[] = parsed.daily;

  it('rechnet Ernaehrung und Wellness nicht mehr nur ueber Tage mit Waegung', () => {
    const weighed = all.filter((d) => d.weight !== null);
    expect(avg(all.map((r) => r.protein))).not.toBe(avg(weighed.map((r) => r.protein)));
    expect(all.length).toBe(weighed.length + EXPECTED_NEW_DAYS.length);
  });
});
