import { describe, it, expect } from 'vitest';
import { toCsv } from '../src/ui/export';
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
