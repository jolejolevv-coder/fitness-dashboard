import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { num } from '../src/parse/num';
import { parseLoad, markImplausible } from '../src/parse/load';
import { parseTrainingMarker, latestPosition } from '../src/parse/trainingday';
import { parseDaily } from '../src/parse/daily';
import { baselineLoad, parseTraining, usableLoad } from '../src/parse/training';
import { weightChange } from '../src/analytics/weight';
import type { DailyEntry, SheetValues } from '../src/types';

const root = join(import.meta.dirname, '..');
/** Fixtures und Golden Values sind lose geformt, deshalb `unknown` mit gezielter Umwandlung. */
function load<T>(p: string): T {
  return JSON.parse(readFileSync(join(root, p), 'utf8')) as T;
}
const dailyFixture = load<SheetValues>('test/fixtures/daily-tracking.json');
const meso1Fixture = load<SheetValues>('test/fixtures/mesocycle-1.json');
const NOW = new Date(2026, 6, 29);

describe('num', () => {
  it('erhaelt eine echte Null', () => {
    expect(num('0')).toBe(0);
    expect(num('0,0')).toBe(0);
  });

  it('liest die Zahl am Anfang statt alle Ziffern zusammenzuziehen', () => {
    expect(num('55x2')).toBe(55);
    expect(num('97,53 Kg')).toBe(97.53);
    expect(num('99.9')).toBe(99.9);
  });

  it('behandelt Platzhalter als fehlend', () => {
    for (const v of ['', '-', '?', '#REF!', '#N/A', 'kein Wert']) expect(num(v)).toBeNull();
  });
});

describe('parseLoad', () => {
  it('liest AxB als Gesamtlast', () => {
    expect(parseLoad('55x2').kg).toBe(110);
    expect(parseLoad('7,5x2').kg).toBe(15);
    expect(parseLoad('40 x 2').kg).toBe(80);
  });

  it('liest blanke Zahlen unveraendert', () => {
    expect(parseLoad('120').kg).toBe(120);
    expect(parseLoad('7,5').kg).toBe(7.5);
  });

  it('mittelt Bereiche und kennzeichnet sie als unsicher', () => {
    const range = parseLoad('40-50');
    expect(range.kg).toBe(45);
    expect(range.uncertain).toBe(true);
  });

  it('meldet Unlesbares statt zu raten', () => {
    expect(parseLoad('schwer').kind).toBe('unparsable');
    expect(parseLoad('schwer').kg).toBeNull();
  });

  it('markiert Ausreisser gegenueber dem Median derselben Uebung', () => {
    const loads = ['9', '80', '80', '80', '90', '90', '90'].map(parseLoad);
    expect(markImplausible(loads)).toEqual([true, false, false, false, false, false, false]);
  });

  it('markiert bei zu wenigen Werten nichts', () => {
    expect(markImplausible(['9', '90'].map(parseLoad))).toEqual([false, false]);
  });
});

describe('Trainingsmarker', () => {
  it('erkennt Trainingstage samt Woche und Mesozyklus', () => {
    expect(parseTrainingMarker('D1 W1 M1')).toMatchObject({ kind: 'training', day: 1, week: 1, mesocycle: 1 });
    expect(parseTrainingMarker('d4 w3  m2')).toMatchObject({ kind: 'training', day: 4, week: 3, mesocycle: 2 });
    expect(parseTrainingMarker('d1 w w5 m3')).toMatchObject({ kind: 'training', day: 1, week: 5, mesocycle: 3 });
  });

  it('zaehlt Rest nicht als Training', () => {
    expect(parseTrainingMarker('Rest').kind).toBe('rest');
    expect(parseTrainingMarker('rest').kind).toBe('rest');
    expect(parseTrainingMarker('').kind).toBe('rest');
  });

  it('haelt freien Text aus der Auswertung heraus', () => {
    expect(parseTrainingMarker('Tracker kaputt zur garantie eingesendet').kind).toBe('unknown');
  });

  it('bestimmt den juengsten Stand ohne Zukunft', () => {
    const entries = [
      { dateObj: new Date(2026, 6, 20), training: 'd1 w4 m2' },
      { dateObj: new Date(2026, 6, 27), training: 'd3 w5 m3' },
      { dateObj: new Date(2026, 7, 3), training: 'D1 W1 M2' },
    ];
    expect(latestPosition(entries, NOW)).toMatchObject({ mesocycle: 3, week: 5 });
  });
});

describe('Tage ohne Waegung', () => {
  const { daily } = parseDaily(dailyFixture, undefined, NOW);
  const find = (date: string): DailyEntry | undefined => daily.find((d) => d.date === date);

  it('behaelt den 25.06., an dem nur Wellness und Schritte erfasst sind', () => {
    const entry = find('25.6.2026');
    expect(entry).toBeDefined();
    expect(entry!.weight).toBeNull();
    // Makros stehen an diesem Tag durchgaengig als `?` beziehungsweise `#VALUE!`.
    expect(entry!.protein).toBeNull();
    expect(entry!.calories).toBeNull();
    expect(entry!.steps).toBe(20023);
    expect(entry!.sleep).toBe(5);
    expect(entry!.energy).toBe(2);
  });

  it('behaelt den 26.06. samt vollstaendiger Makros und echter Null', () => {
    const entry = find('26.6.2026');
    expect(entry).toBeDefined();
    expect(entry!.weight).toBeNull();
    expect(entry!.protein).toBe(209);
    expect(entry!.calories).toBeCloseTo(2068.1, 4);
    // Null Gramm Obst und Gemuese, vorher zu null verfaelscht.
    expect(entry!.fv).toBe(0);
  });

  it('nimmt keine Zeilen mit Datum in der Zukunft auf', () => {
    expect(daily.some((d) => d.dateObj && d.dateObj > NOW)).toBe(false);
    expect(find('3.8.2026')).toBeUndefined();
  });

  it('liest Notizen aus beiden Spalten', () => {
    expect(find('28.7.2026')?.comment).not.toBe('');
  });
});

describe('Wochenbloecke', () => {
  const { weekBlocks } = parseDaily(dailyFixture, undefined, NOW);

  it('setzt im ersten Block kein Delta, weil dort das Wochenmittel steht', () => {
    expect(weekBlocks[0]!.delta).toBeNull();
    expect(weekBlocks[1]!.delta).toBeCloseTo(-0.06, 2);
  });
});

describe('Gesamtveraenderung des Gewichts', () => {
  it('vergleicht geglaettete Mittel statt zweier Einzelwaegungen', () => {
    const entries = [100, 99, 99, 98, 98, 97, 97, 95, 94, 94, 93, 93, 92, 92]
      .map((weight) => ({ weight }) as DailyEntry);
    const change = weightChange(entries)!;
    expect(change.window).toBe(7);
    expect(change.from).toBeCloseTo(98.29, 2);
    expect(change.to).toBeCloseTo(93.29, 2);
    expect(change.change).toBeCloseTo(-5, 2);
    expect(change.firstRaw).toBe(100);
    expect(change.lastRaw).toBe(92);
  });

  it('laesst die Fenster bei kurzen Reihen nicht ueberlappen', () => {
    const entries = [100, 98, 96, 94].map((weight) => ({ weight }) as DailyEntry);
    const change = weightChange(entries)!;
    expect(change.window).toBe(2);
    expect(change.from).toBe(99);
    expect(change.to).toBe(95);
  });
});

describe('Trainingsprogression', () => {
  const parsed = parseTraining(meso1Fixture)!;
  const calf = Object.values(parsed.exercises).filter((e) => e.name.startsWith('Standing Calf Raise'));

  it('rechnet 55x2 als 110 kg', () => {
    const withPerSide = Object.values(parsed.exercises)
      .flatMap((e) => e.weeks)
      .filter((w) => /x\s*2$/.test(w.loadRaw));
    expect(withPerSide.length).toBeGreaterThan(0);
    for (const week of withPerSide) {
      const perSide = parseFloat(week.loadRaw.replace(',', '.'));
      expect(week.load).toBeCloseTo(perSide * 2, 5);
    }
  });

  it('haelt den Tippfehler 9-9 aus der Progression heraus', () => {
    const affected = calf.find((e) => e.weeks.some((w) => w.loadRaw === '9-9'))!;
    expect(affected).toBeDefined();
    const week = affected.weeks.find((w) => w.loadRaw === '9-9')!;
    expect(week.implausible).toBe(true);
    expect(usableLoad(affected, affected.weeks.indexOf(week))).toBeNull();
    // Grundlage ist damit die erste brauchbare Woche, nicht die 9.
    expect(baselineLoad(affected)!.load).toBe(80);
  });

  it('unterscheidet gleichnamige Uebungen nach Trainingstag', () => {
    const days = new Set(calf.map((e) => e.day));
    expect(days.size).toBeGreaterThan(1);
    expect(calf.length).toBeGreaterThan(1);
  });

  it('meldet keine unlesbaren Lastzellen im Bestand', () => {
    expect(parsed.unparsableLoads).toEqual([]);
  });
});
