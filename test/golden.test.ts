import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { parseDaily, resolveDailyColumns } from '../src/parse/daily';
import { parseTraining } from '../src/parse/training';
import { avg, fmt, movingAvg } from '../src/analytics/smoothing';
import { avgRepsFromStr, epley1RM } from '../src/analytics/strength';
import type { SheetValues } from '../src/types';

/**
 * Diese Suite ist die Abnahme von Phase 1.
 *
 * Die Golden Values stammen aus der urspruenglichen index.html, ausgefuehrt ueber
 * dieselben Fixtures. Jede Abweichung ist ein Migrationsfehler, solange Phase 2
 * nicht begonnen hat. Ab Phase 2 wird jede bewusste Aenderung hier einzeln und
 * mit Begruendung nachgezogen.
 */

const root = join(import.meta.dirname, '..');
const load = (p: string): any => JSON.parse(readFileSync(join(root, p), 'utf8'));

const dailyFixture = load('test/fixtures/daily-tracking.json') as SheetValues;
const meso1Fixture = load('test/fixtures/mesocycle-1.json') as SheetValues;
const meso2Fixture = load('test/fixtures/mesocycle-2.json') as SheetValues;
const goldenDaily = load('test/golden/daily.json');
const goldenTraining = load('test/golden/training.json');

const iso = (d: Date | null): string | null =>
  d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` : null;

const parsed = parseDaily(dailyFixture);

describe('Spaltenauflaesung', () => {
  it('findet alle Spalten des Daily Tracking', () => {
    const columns = resolveDailyColumns(dailyFixture);
    expect(columns).toMatchObject({
      date: 0, weight: 1, time: 2, protein: 4, carbs: 5, fat: 6, fiber: 7,
      fv: 8, calories: 9, note: 11, sleep: 12, sleepQ: 13, digestion: 14,
      stress: 16, energy: 17, steps: 18, training: 20,
    });
  });

  it('meldet eine fehlende Pflichtspalte, statt still weiterzurechnen', () => {
    const broken = dailyFixture.map((row) => row.map((c) => (c === 'Weight' ? 'Gewicht' : c)));
    expect(() => resolveDailyColumns(broken)).toThrow(/Kopfzeile|Weight/);
  });
});

describe('Daily Tracking gegen Golden Values', () => {
  it('erzeugt dieselbe Anzahl Eintraege und Wochenbloecke', () => {
    expect(parsed.daily.length).toBe(goldenDaily.daily.length);
    expect(parsed.weekBlocks.length).toBe(goldenDaily.weekBlocks.length);
  });

  it('erzeugt feldgleiche Tageseintraege', () => {
    const actual = parsed.daily.map((d) => ({ ...d, dateObj: iso(d.dateObj) }));
    expect(actual).toEqual(goldenDaily.daily);
  });

  it('erzeugt gleiche Wochenbloecke', () => {
    const actual = parsed.weekBlocks.map((b) => ({
      avgWeight: b.avgWeight,
      delta: b.delta,
      n: b.rows.length,
      from: iso(b.rows[0]?.dateObj ?? null),
      to: iso(b.rows[b.rows.length - 1]?.dateObj ?? null),
    }));
    expect(actual).toEqual(goldenDaily.weekBlocks);
  });
});

describe('Kennzahlen gegen Golden Values', () => {
  const rows = parsed.daily.filter((d) => d.weight !== null && !isNaN(d.weight));
  const first = rows[0]!.weight!;
  const last = rows[rows.length - 1]!.weight!;
  const pRows = rows.filter((r) => r.protein !== null);
  const cRows = rows.filter((r) => r.calories !== null);

  it('reproduziert die Kopfleiste', () => {
    expect(`${first.toFixed(1)} kg`).toBe(goldenDaily.kpi.badgeStart);
    expect(`${last.toFixed(1)} kg`).toBe(goldenDaily.kpi.badgeCurrent);
    expect(`${last - first < 0 ? '' : '+'}${(last - first).toFixed(1)} kg`).toBe(goldenDaily.kpi.badgeLoss);
    expect(`${rows.length} Tage`).toBe(goldenDaily.kpi.badgeDays);
  });

  it('reproduziert die Durchschnitte', () => {
    expect(avg(rows.map((r) => r.protein))).toBe(goldenDaily.kpi.avgProtein);
    expect(avg(rows.map((r) => r.carbs))).toBe(goldenDaily.kpi.avgCarbs);
    expect(avg(rows.map((r) => r.fat))).toBe(goldenDaily.kpi.avgFat);
    expect(`${fmt(avg(rows.map((r) => r.sleep)))}h`).toBe(goldenDaily.kpi.kpiSleep);
    expect(`${fmt(avg(rows.map((r) => r.energy)))}/5`).toBe(goldenDaily.kpi.kpiEnergy);
  });

  it('reproduziert die Compliance', () => {
    const p = pRows.length ? Math.round((pRows.filter((r) => r.protein! >= 200).length / pRows.length) * 100) : null;
    const c = cRows.length ? Math.round((cRows.filter((r) => r.calories! <= 2300).length / cRows.length) * 100) : null;
    expect(p).toBe(goldenDaily.kpi.proteinCompliance);
    expect(c).toBe(goldenDaily.kpi.calCompliance);
  });

  it('reproduziert das gleitende Mittel', () => {
    expect(movingAvg(rows.map((r) => r.weight))).toEqual(goldenDaily.kpi.movingAvgWeight);
  });
});

describe('Trainingstag gegen Ruhetag', () => {
  it('reproduziert die Auswertung', () => {
    const sorted = [...parsed.daily].filter((r) => r.dateObj).sort((a, b) => a.dateObj!.getTime() - b.dateObj!.getTime());
    const tE: number[] = [], tS: number[] = [], rE: number[] = [], rS: number[] = [];
    for (let i = 0; i < sorted.length - 1; i++) {
      const today = sorted[i]!, next = sorted[i + 1]!;
      if ((next.dateObj!.getTime() - today.dateObj!.getTime()) / 864e5 > 2) continue;
      const isTrain = Boolean(today.training && today.training.trim() && today.training.trim() !== '-');
      const energy = isTrain ? tE : rE;
      const sleep = isTrain ? tS : rS;
      if (next.energy !== null) energy.push(next.energy);
      if (next.sleep !== null) sleep.push(next.sleep);
    }
    expect({
      trainEnergy: avg(tE), trainSleep: avg(tS), restEnergy: avg(rE), restSleep: avg(rS),
      nTrain: tE.length, nRest: rE.length,
    }).toEqual(goldenDaily.correlation);
  });
});

describe('Mesocycle Tabs gegen Golden Values', () => {
  for (const [key, fixture] of [['mesocycle1', meso1Fixture], ['mesocycle2', meso2Fixture]] as const) {
    it(`reproduziert ${key}`, () => {
      const actual = parseTraining(fixture);
      const golden = goldenTraining[key];
      if (golden === null) {
        expect(actual).toBeNull();
        return;
      }
      expect(actual).not.toBeNull();
      expect(actual!.weekCount).toBe(golden.weekCount);
      expect(actual!.currentWeek).toBe(golden.currentWeek);
      expect(Object.keys(actual!.exercises).length).toBe(golden.exerciseCount);

      const shaped = Object.fromEntries(
        Object.entries(actual!.exercises).map(([name, ex]) => [name, {
          day: ex.day,
          muscleGroup: ex.muscleGroup,
          weeks: ex.weeks.map((w) => ({
            load: w.load,
            sets: w.sets,
            repsActual: w.repsActual,
            oneRM: w.load && avgRepsFromStr(w.repsActual) ? epley1RM(w.load, avgRepsFromStr(w.repsActual)) : null,
          })),
        }]),
      );
      expect(shaped).toEqual(golden.exercises);
    });
  }
});
