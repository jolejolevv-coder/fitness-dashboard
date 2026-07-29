import type { Exercise, ExerciseWeek, ParsedTraining, SheetValues } from '../types';
import { num } from './num';
import { markImplausible, parseLoad, type ParsedLoad } from './load';

/**
 * Zerlegt einen Mesocycle Tab.
 *
 * Der Tab wiederholt denselben Spaltenblock je Trainingswoche. Die Bloecke
 * werden ueber Zellen mit dem Inhalt `Excercise` gefunden, Schreibfehler im
 * Original. Der Abstand zwischen den Bloecken ist nicht konstant, in
 * `Mesocycle 1` betraegt er zuerst 12 und danach 11 Spalten.
 */

/** Beschriftung, die einen Wochenblock einleitet. Schreibfehler stammt aus der Vorlage. */
const WEEK_BLOCK_MARKER = 'Excercise';

/** Ab so vielen gefundenen Markierungen gilt eine Zeile als Kopfzeile. */
const MIN_WEEK_BLOCKS = 3;

/** Versatz innerhalb eines Wochenblocks, relativ zur Markierung. */
const OFFSET_SETS = 2;
const OFFSET_LOAD = 6;
const OFFSET_REPS_ACTUAL = 7;

const MUSCLE_GROUP_COLUMN = 1;
const EXERCISE_NAME_COLUMN = 2;

const NON_EXERCISE_LABELS = ['Excercise', 'Muscle group', 'Exercise'];
const DAY_PATTERN = /^Day \d/i;

/** Trennt Trainingstag und Uebungsnamen im Schluessel. */
export const KEY_SEPARATOR = '||';

export function exerciseKey(day: string, name: string): string {
  return `${day}${KEY_SEPARATOR}${name}`;
}

function findWeekOffsets(rows: SheetValues): number[] | null {
  for (const row of rows) {
    if (!row) continue;
    const offsets: number[] = [];
    for (let c = 0; c < row.length; c++) {
      if ((row[c] ?? '').trim() === WEEK_BLOCK_MARKER) offsets.push(c);
    }
    if (offsets.length >= MIN_WEEK_BLOCKS) return offsets;
  }
  return null;
}

export function parseTraining(rows: SheetValues): ParsedTraining | null {
  const weekOffsets = findWeekOffsets(rows);
  if (!weekOffsets) return null;

  const exercises: Record<string, Exercise> = {};
  const unparsableLoads: string[] = [];
  let currentDay = '';

  for (const row of rows) {
    if (!row) continue;
    const groupCell = (row[MUSCLE_GROUP_COLUMN] ?? '').trim();

    if (DAY_PATTERN.test(groupCell)) {
      currentDay = groupCell;
      continue;
    }

    const name = (row[EXERCISE_NAME_COLUMN] ?? '').trim();
    if (!name || !groupCell) continue;
    if (NON_EXERCISE_LABELS.includes(name)) continue;
    if (groupCell === 'Muscle group') continue;

    const loads: ParsedLoad[] = weekOffsets.map((start) => parseLoad(row[start + OFFSET_LOAD]));
    if (loads.every((l) => l.kg === null)) continue;

    for (const load of loads) {
      if (load.kind === 'unparsable') unparsableLoads.push(load.raw);
    }

    const implausible = markImplausible(loads);
    const weeks: ExerciseWeek[] = weekOffsets.map((start, index) => ({
      load: loads[index]!.kg,
      sets: num(row[start + OFFSET_SETS]) ?? 0,
      repsActual: (row[start + OFFSET_REPS_ACTUAL] ?? '').trim(),
      loadRaw: loads[index]!.raw,
      uncertain: loads[index]!.uncertain,
      implausible: implausible[index]!,
    }));

    // PHASE 2: Schluessel aus Trainingstag und Name. Vorher gewann je Name der
    // erste Treffer, wodurch acht von 36 Varianten in Mesocycle 1 verschwanden.
    // Kommt dieselbe Uebung am selben Tag mehrfach vor, werden die Vorkommen
    // durchnummeriert, statt sie zu verwerfen.
    let key = exerciseKey(currentDay, name);
    let occurrence = 2;
    while (exercises[key]) {
      key = exerciseKey(currentDay, `${name} (${occurrence})`);
      occurrence++;
    }

    exercises[key] = {
      key,
      name: key.split(KEY_SEPARATOR)[1] ?? name,
      day: currentDay,
      muscleGroup: groupCell,
      weeks,
    };
  }

  let currentWeek = 0;
  for (const exercise of Object.values(exercises)) {
    for (let w = 0; w < exercise.weeks.length; w++) {
      if (exercise.weeks[w]!.load !== null) currentWeek = Math.max(currentWeek, w + 1);
    }
  }

  return { exercises, weekCount: weekOffsets.length, currentWeek, unparsableLoads };
}

/** Last einer Woche, ohne als unplausibel markierte Werte. */
export function usableLoad(exercise: Exercise, weekIndex: number): number | null {
  const week = exercise.weeks[weekIndex];
  if (!week || week.implausible) return null;
  return week.load;
}

/** Erste Woche mit brauchbarer Last, Grundlage jeder Progressionsangabe. */
export function baselineLoad(exercise: Exercise): { week: number; load: number } | null {
  for (let w = 0; w < exercise.weeks.length; w++) {
    const load = usableLoad(exercise, w);
    if (load !== null && load > 0) return { week: w, load };
  }
  return null;
}
