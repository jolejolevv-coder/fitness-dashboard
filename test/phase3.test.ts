import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  daysDiffer,
  FALLBACK_GOALS,
  parseGoals,
  parseRateOfLoss,
  targetRateKgPerWeek,
} from '../src/parse/goals';
import type { SheetValues } from '../src/types';
import { hasFixtures, load, root } from './fixtures';

const EMPTY = [] as SheetValues;
const dailyFixture = hasFixtures ? load<SheetValues>('test/fixtures/daily-tracking.json') : EMPTY;
const meso1Fixture = hasFixtures ? load<SheetValues>('test/fixtures/mesocycle-1.json') : EMPTY;

describe.skipIf(!hasFixtures)('Vorgabeblock aus dem Sheet', () => {
  const goals = parseGoals(dailyFixture, meso1Fixture);

  it('liest den Wochenschnitt des Trainers', () => {
    expect(goals.average).toEqual({
      proteinG: 200,
      carbsG: 225,
      fatG: 60,
      fiberG: 40,
      caloriesKcal: 2300.5,
      proteinFeedings: 4,
      steps: 10000,
    });
  });

  it('liest High Day und Low Day getrennt', () => {
    expect(goals.highDay?.proteinG).toBe(200);
    expect(goals.lowDay?.proteinG).toBe(200);
    // In diesem Block sind beide gleich, das darf sich im naechsten aendern.
    expect(daysDiffer(goals)).toBe(false);
  });

  it('liest Stammdaten aus dem Kopfbereich', () => {
    expect(goals.startWeightKg).toBe(95);
    expect(goals.heightCm).toBe(182);
  });

  it('meldet nichts als fehlend', () => {
    expect(goals.missing).toEqual([]);
  });
});

describe('Rate of Loss', () => {
  it.skipIf(!hasFixtures)('liest ROL aus dem Mesocycle Tab', () => {
    expect(parseRateOfLoss(meso1Fixture)).toBe(0.25);
  });

  it('versteht Punkt, fehlenden Bindestrich und Grossschreibung', () => {
    expect(parseRateOfLoss([['ROL 0.4%']])).toBe(0.4);
    expect(parseRateOfLoss([['rol - 1,5 %']])).toBe(1.5);
  });

  it('liefert null, wenn nichts dasteht', () => {
    expect(parseRateOfLoss([['Gainingrate / Rate of Loss', '']])).toBeNull();
  });

  it('rechnet die Sollrate laufend aus dem aktuellen Gewicht', () => {
    expect(targetRateKgPerWeek(0.25, 89.8)).toBeCloseTo(-0.2245, 4);
    expect(targetRateKgPerWeek(0.25, 95)).toBeCloseTo(-0.2375, 4);
    expect(targetRateKgPerWeek(null, 90)).toBeNull();
    expect(targetRateKgPerWeek(0.25, null)).toBeNull();
  });
});

describe.skipIf(!hasFixtures)('Verhalten bei umgebautem Sheet', () => {
  it('faellt auf Rueckfallwerte zurueck und sagt es', () => {
    const withoutBlock = dailyFixture.map((row) => row.map((c) => (c === 'Day' ? 'Tag' : c)));
    const goals = parseGoals(withoutBlock, meso1Fixture);
    expect(goals.average).toEqual(FALLBACK_GOALS);
    expect(goals.missing).toContain('Vorgabeblock');
    // Die Rate steht in einem anderen Tab und bleibt lesbar.
    expect(goals.rateOfLossPct).toBe(0.25);
  });

  it('meldet eine einzelne unlesbare Zelle statt still zu rechnen', () => {
    const broken = dailyFixture.map((row) => (
      (row[1] ?? '') === 'Average' ? row.map((c, i) => (i === 6 ? 'weiss nicht' : c)) : row
    ));
    const goals = parseGoals(broken, meso1Fixture);
    expect(goals.missing).toContain('caloriesKcal');
    expect(goals.average.caloriesKcal).toBe(FALLBACK_GOALS.caloriesKcal);
    // Alles andere bleibt aus dem Sheet.
    expect(goals.average.proteinG).toBe(200);
  });

  it('meldet eine fehlende Rate, ohne den Rest zu verlieren', () => {
    const goals = parseGoals(dailyFixture, []);
    expect(goals.rateOfLossPct).toBeNull();
    expect(goals.missing).toEqual(['Rate of Loss']);
    expect(goals.average.proteinG).toBe(200);
  });
});

describe('Keine Zielwerte mehr im Code', () => {
  it('haelt Zielzahlen ausserhalb der Rueckfallwerte aus src heraus', () => {
    const sources = [
      'src/ui/dashboard.ts',
      'src/ui/training.ts',
      'src/main.ts',
      'src/parse/daily.ts',
      'src/parse/training.ts',
    ].map((p) => readFileSync(join(root, p), 'utf8'));

    for (const source of sources) {
      const code = source
        .split('\n')
        .filter((line) => !line.trim().startsWith('*') && !line.trim().startsWith('//'))
        .join('\n');
      expect(code).not.toMatch(/\b2300\b/);
      expect(code).not.toMatch(/\b225\b/);
      expect(code).not.toMatch(/proteinG:\s*200/);
    }
  });
});
