import { describe, it, expect } from 'vitest';
import { toCsv } from '../src/ui/export';
import { deviationPct } from '../src/ui/metrics';
import type { DailyEntry } from '../src/types';

function entry(values: Partial<DailyEntry> = {}): DailyEntry {
  return {
    date: '7.5.2026', dateObj: new Date(2026, 4, 7), weight: null, time: '',
    protein: null, carbs: null, fat: null, fiber: null, fv: null, calories: null,
    comment: '', sleep: null, sleepQ: null, digestion: null, stress: null,
    energy: null, steps: null, training: '',
    ...values,
  };
}

describe('CSV Ausgabe', () => {
  it('schreibt eine Kopfzeile und eine Zeile je Tag', () => {
    const csv = toCsv([entry(), entry({ date: '8.5.2026' })]);
    const lines = csv.split('\r\n');
    expect(lines).toHaveLength(3);
    expect(lines[0]).toContain('Datum;Gewicht');
  });

  it('nutzt Dezimalkomma, damit eine deutsche Tabellenkalkulation es liest', () => {
    const csv = toCsv([entry({ weight: 89.7, calories: 2300.5 })]);
    expect(csv).toContain('89,7');
    expect(csv).toContain('2300,5');
  });

  it('laesst fehlende Werte leer statt sie zu erfinden', () => {
    const csv = toCsv([entry({ weight: null })]);
    const fields = csv.split('\r\n')[1]!.split(';');
    expect(fields[1]).toBe('');
  });

  it('maskiert Semikolon, Anfuehrungszeichen und Zeilenumbrueche in Notizen', () => {
    const csv = toCsv([entry({ comment: 'War "gut"; trotzdem\nmüde' })]);
    expect(csv).toContain('"War ""gut""; trotzdem\nmüde"');
  });

  it('beginnt mit einem Byte Order Mark, sonst zerlegt Excel die Umlaute', () => {
    expect(toCsv([]).startsWith('﻿')).toBe(true);
  });

  it('behaelt eine echte Null', () => {
    const csv = toCsv([entry({ fv: 0 })]);
    const fields = csv.split('\r\n')[1]!.split(';');
    expect(fields[7]).toBe('0');
  });
});

describe('Abweichung vom Ziel', () => {
  it('zaehlt Ueberschreiten positiv, wo mehr besser ist', () => {
    expect(deviationPct(210, 200, 'atLeast')).toBeCloseTo(5, 6);
    expect(deviationPct(10777, 10000, 'atLeast')).toBeCloseTo(7.77, 2);
  });

  it('zaehlt Unterschreiten positiv, wo weniger besser ist', () => {
    expect(deviationPct(2282, 2300.5, 'atMost')).toBeCloseTo(0.8, 1);
    expect(deviationPct(2500, 2300.5, 'atMost')).toBeLessThan(0);
  });

  it('meldet null, wenn der Schnitt genau auf dem Ziel liegt', () => {
    expect(deviationPct(200, 200, 'atLeast')).toBe(0);
    expect(deviationPct(200, 200, 'atMost')).toBe(-0);
  });
});

describe('Zielgewicht', () => {
  /** Minimaler localStorage Ersatz, damit der Test ohne Browser laeuft. */
  function withStorage(initial: Record<string, string>): void {
    const store = new Map(Object.entries(initial));
    (globalThis as { localStorage?: unknown }).localStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    };
  }

  it('nutzt die Vorgabe, solange nichts gespeichert wurde', async () => {
    withStorage({});
    const { getTargets, DEFAULT_TARGET_WEIGHT_KG } = await import('../src/config/targets');
    expect(getTargets().targetWeightKg).toBe(DEFAULT_TARGET_WEIGHT_KG);
  });

  it('respektiert einen gespeicherten Wert', async () => {
    withStorage({ fitness_targets_v1: JSON.stringify({ targetWeightKg: 78 }) });
    const { getTargets } = await import('../src/config/targets');
    expect(getTargets().targetWeightKg).toBe(78);
  });

  it('respektiert ein ausdruecklich geleertes Ziel', async () => {
    withStorage({ fitness_targets_v1: JSON.stringify({ targetWeightKg: null }) });
    const { getTargets } = await import('../src/config/targets');
    expect(getTargets().targetWeightKg).toBeNull();
  });
});
