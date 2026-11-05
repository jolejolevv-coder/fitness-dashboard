import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { MissingColumnsError } from '../src/parse/columns';
import { baselineLoad } from '../src/parse/training';
import { parseSetDate, parseTrainingSets } from '../src/parse/trainingSets';

/**
 * Parser fuer den Tab `TrainingSets` des Gym Logbuchs (Phase 18.1).
 *
 * Die Fixture ist synthetisch. Wochen: 02.11. (W1), 09.11. (W2), 16.11. (W3,
 * leer), 23.11. (W4, mit einem Sonntag am 29.11.).
 */

function loadRows(): string[][] {
  const url = new URL('./fixtures/training-sets/training-sets.json', import.meta.url);
  return (JSON.parse(readFileSync(url, 'utf8')) as { values: string[][] }).values;
}

const rows = loadRows();
const parsed = parseTrainingSets(rows)!;

describe('parseTrainingSets', () => {
  it('zaehlt Kalenderwochen ab der ersten Einheit', () => {
    expect(parsed.weekCount).toBe(4);
    expect(parsed.currentWeek).toBe(4);
  });

  it('trennt denselben Uebungsnamen an zwei Trainingstagen', () => {
    expect(Object.keys(parsed.exercises).sort()).toEqual([
      'Tag 1||Pull Ups',
      'Tag 2||Leg Extensions',
      'Tag 2||Leg Press',
      'Tag 4||Leg Extensions',
    ]);
    const day4 = parsed.exercises['Tag 4||Leg Extensions']!;
    expect(day4.name).toBe('Leg Extensions');
    expect(day4.day).toBe('Tag 4');
    expect(day4.muscleGroup).toBe('Quads');
  });

  it('nimmt den schwersten Satz als Last und die Wdh nach Satznummer', () => {
    const week1 = parsed.exercises['Tag 2||Leg Extensions']!.weeks[0]!;
    expect(week1.load).toBe(55);
    expect(week1.sets).toBe(3);
    expect(week1.repsActual).toBe('10-9-9');
  });

  it('liest Kommazahlen', () => {
    expect(parsed.exercises['Tag 4||Leg Extensions']!.weeks[0]!.load).toBe(7.5);
    expect(parsed.exercises['Tag 2||Leg Extensions']!.weeks[1]!.load).toBe(57.5);
  });

  it('zaehlt Saetze ohne Wdh, ohne kg oder ohne Datum nicht', () => {
    const press = parsed.exercises['Tag 2||Leg Press']!.weeks[0]!;
    expect(press).toMatchObject({ load: 120, sets: 1, repsActual: '10' });
    // Ohne Datum faellt der 90 kg Satz weg, sonst waere er die Last.
    expect(parsed.exercises['Tag 4||Leg Extensions']!.weeks[0]).toMatchObject({ load: 7.5, sets: 2, repsActual: '12-12' });
    expect(parsed.exercises['Tag 4||Lat Pulldown']).toBeUndefined();
  });

  it('nimmt Saetze und Wdh aus der Einheit mit dem schwersten Satz', () => {
    const week2 = parsed.exercises['Tag 2||Leg Extensions']!.weeks[1]!;
    expect(week2).toMatchObject({ load: 57.5, sets: 2, repsActual: '10-9' });
  });

  it('liest auch das Datum im deutschen Format', () => {
    expect(parsed.exercises['Tag 4||Leg Extensions']!.weeks[1]!.load).toBe(10);
  });

  it('laesst Wochen ohne Einheit leer', () => {
    const week3 = parsed.exercises['Tag 2||Leg Extensions']!.weeks[2]!;
    expect(week3).toMatchObject({ load: null, sets: 0, repsActual: '' });
    expect(parsed.exercises['Tag 2||Leg Extensions']!.weeks[3]).toMatchObject({ load: 60, repsActual: '8-8-7' });
  });

  it('ordnet einen Sonntag der laufenden Woche zu und behaelt 0 kg', () => {
    const pullUps = parsed.exercises['Tag 1||Pull Ups']!;
    expect(pullUps.weeks.map((week) => week.load)).toEqual([null, null, null, 0]);
    expect(baselineLoad(pullUps)).toBeNull();
  });

  it('jede Uebung hat so viele Wochen wie der Zeitraum', () => {
    for (const exercise of Object.values(parsed.exercises)) expect(exercise.weeks).toHaveLength(4);
  });

  it('findet Spalten ueber die Kopfzeile, nicht ueber die Reihenfolge', () => {
    const order = [7, 6, 0, 1, 2, 3, 4, 5];
    const shuffled = rows.map((row) => order.map((index) => row[index] ?? ''));
    expect(parseTrainingSets(shuffled)).toEqual(parsed);
  });

  it.each(['date', 'tag', 'exercise', 'kg', 'reps'])('meldet die fehlende Spalte %s', (column) => {
    const without = rows.map((row) => row.filter((_, index) => rows[0]![index] !== column));
    expect(() => parseTrainingSets(without)).toThrow(MissingColumnsError);
    expect(() => parseTrainingSets(without)).toThrow(column);
  });

  it('kommt ohne muscle und set aus', () => {
    const lean = rows.map((row) => row.filter((_, index) => !['muscle', 'set'].includes(rows[0]![index]!)));
    const result = parseTrainingSets(lean)!;
    expect(result.exercises['Tag 2||Leg Extensions']!.muscleGroup).toBe('');
    // Ohne Satznummer gilt die Zeilenfolge.
    expect(result.exercises['Tag 2||Leg Extensions']!.weeks[0]!.repsActual).toBe('9-10-9');
  });

  it('liefert null ohne Zeilen oder ohne gueltigen Satz', () => {
    expect(parseTrainingSets([])).toBeNull();
    expect(parseTrainingSets([rows[0]!])).toBeNull();
  });
});

describe('parseSetDate', () => {
  it('liest ISO und deutsches Format, sonst null', () => {
    expect(parseSetDate('2026-11-05')).toEqual(new Date(2026, 10, 5));
    expect(parseSetDate('5.11.2026')).toEqual(new Date(2026, 10, 5));
    expect(parseSetDate('')).toBeNull();
    expect(parseSetDate('gestern')).toBeNull();
  });
});
