import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { MissingColumnsError } from '../src/parse/columns';
import { generalTextFor, parsePlan, parsePlanSettings, parseWarmupStep, PlanError } from '../src/parse/plan';

/** Parser fuer die Tabs `Plan` und `PlanSettings` (Phase 20.1), synthetische Fixture. */

function loadRows(name: string): string[][] {
  const url = new URL(`./fixtures/plan/${name}.json`, import.meta.url);
  return (JSON.parse(readFileSync(url, 'utf8')) as { values: string[][] }).values;
}

const planRows = loadRows('plan');
const plan = parsePlan(planRows);
const settings = parsePlanSettings(loadRows('plan-settings'));

describe('parsePlan', () => {
  it('bildet Tage in der Reihenfolge des ersten Auftretens', () => {
    expect(plan.days.map((d) => d.tag)).toEqual(['Tag 1', 'Tag 2']);
    expect(plan.days[0]!.label).toBe('Montag · Upper A');
    expect(plan.days[0]!.exercises.map((e) => e.name)).toEqual(['Bench Press', 'Cable Fly', 'Rear Fly', 'Curl']);
  });

  it('liest Zahlen, Ranges und Supersatz', () => {
    const [bench, fly, rear, curl] = plan.days[0]!.exercises;
    expect(bench).toMatchObject({ id: 'bench', sets: 2, r1: '5-7', r2: '6-9', rest: 150, ss: '', lastLoad: '70' });
    expect(fly).toMatchObject({ r2: '', ss: 'A1', rest: 90 });
    expect(rear).toMatchObject({ ss: 'B1', lastLoad: '', tip: 'Neu' });
    expect(curl!.rest).toBeNull();
  });

  it('liest Spalten ueber die Kopfzeile, auch bei anderer Reihenfolge', () => {
    const shuffled = planRows.map((row) => [...row].reverse());
    const reordered = parsePlan(shuffled);
    expect(reordered.days[0]!.exercises[0]).toMatchObject({ name: 'Bench Press', sets: 2, r1: '5-7' });
  });

  it('meldet eine fehlende Spalte sichtbar', () => {
    const withoutRest = planRows.map((row) => row.filter((_, i) => planRows[0]![i] !== 'rest'));
    expect(() => parsePlan(withoutRest)).toThrow(MissingColumnsError);
    try {
      parsePlan(withoutRest);
    } catch (error) {
      expect((error as MissingColumnsError).missing).toEqual(['rest']);
    }
  });

  it('weist eine Satzzahl ohne Zahl mit Zeilennummer ab', () => {
    const broken = planRows.map((row) => [...row]);
    broken[2]![planRows[0]!.indexOf('sets')] = 'drei';
    expect(() => parsePlan(broken)).toThrow(PlanError);
    expect(() => parsePlan(broken)).toThrow('Zeile 3');
  });

  it('uebergeht leere Zeilen und liefert ohne Zeilen keine Tage', () => {
    expect(parsePlan([planRows[0]!, [], ['', '', '', '']]).days).toEqual([]);
  });
});

describe('parsePlanSettings', () => {
  it('liest Aufwaermstufen, Lastschritt und Regionen', () => {
    expect(settings.warmupFirst).toEqual([{ factor: 0.5, reps: 8 }, { factor: 0.75, reps: 3 }]);
    expect(settings.warmupRegion).toEqual({ factor: 0.6, reps: 5 });
    expect(settings.loadStep).toBe(2.5);
    expect(settings.noWarmupRegions).toEqual(['abs']);
    expect(settings.regions['Rear Delts']).toBe('pull');
    expect(settings.rangeFullText).toBe('Range voll');
  });

  it('waehlt den allgemeinen Text nach dem Tageslabel', () => {
    expect(generalTextFor(settings, 'Montag · Upper A')).toBe('Allgemein oben');
    expect(generalTextFor(settings, 'Mittwoch · Lower A')).toBe('Allgemein unten');
    expect(generalTextFor(settings, 'Freitag · Core')).toBeNull();
  });

  it('schaltet fehlende oder kaputte Schluessel ab, statt zu raten', () => {
    const empty = parsePlanSettings([]);
    expect(empty).toMatchObject({ warmupFirst: [], warmupRegion: null, loadStep: null, rangeFullText: null });
    const broken = parsePlanSettings([['warmup_first', '0.5x8, kaputt'], ['load_step', '0'], ['warmup_region', 'x']]);
    expect(broken).toMatchObject({ warmupFirst: [], warmupRegion: null, loadStep: null });
  });

  it('akzeptiert Komma und Malzeichen in Stufen', () => {
    expect(parseWarmupStep('0,75 × 3')).toEqual({ factor: 0.75, reps: 3 });
    expect(parseWarmupStep('75%')).toBeNull();
  });
});
