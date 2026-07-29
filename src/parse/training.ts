import type { Exercise, ExerciseWeek, ParsedTraining, SheetValues } from '../types';
import { num } from './num';

/**
 * Zerlegt einen Mesocycle Tab.
 *
 * Der Tab wiederholt denselben Spaltenblock je Trainingswoche. Die Bloecke
 * werden ueber Zellen mit dem Inhalt `Excercise` gefunden, Schreibfehler im
 * Original. Der Abstand zwischen den Bloecken ist nicht konstant, in
 * `Mesocycle 1` betraegt er zuerst 12 und danach 11 Spalten. Feste Abstaende
 * sind deshalb unzulaessig.
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
  let currentDay = '';

  for (const row of rows) {
    if (!row) continue;
    const groupCell = (row[MUSCLE_GROUP_COLUMN] ?? '').trim();

    if (DAY_PATTERN.test(groupCell)) {
      currentDay = groupCell;
      continue;
    }

    const exerciseName = (row[EXERCISE_NAME_COLUMN] ?? '').trim();
    if (!exerciseName || !groupCell) continue;
    if (NON_EXERCISE_LABELS.includes(exerciseName)) continue;
    if (DAY_PATTERN.test(groupCell) || groupCell === 'Muscle group') continue;

    const weeks: ExerciseWeek[] = weekOffsets.map((start) => ({
      load: num(row[start + OFFSET_LOAD]),
      sets: num(row[start + OFFSET_SETS]) ?? 0,
      repsActual: (row[start + OFFSET_REPS_ACTUAL] ?? '').trim(),
    }));

    if (weeks.every((w) => w.load === null)) continue;
    // Ein Uebungsname kann mehrfach vorkommen. Der erste Treffer gewinnt.
    if (!exercises[exerciseName]) {
      exercises[exerciseName] = { day: currentDay, muscleGroup: groupCell, weeks };
    }
  }

  let currentWeek = 0;
  for (const exercise of Object.values(exercises)) {
    for (let w = 0; w < exercise.weeks.length; w++) {
      if (exercise.weeks[w]!.load !== null) currentWeek = Math.max(currentWeek, w + 1);
    }
  }

  return { exercises, weekCount: weekOffsets.length, currentWeek };
}
