import type { Exercise, ParsedTraining } from '../types';
import { COACH_RULES as R } from '../config/coachRules';
import { refuse, type Insight } from '../analytics/result';
import { avgRepsFromStr, epley1RM } from '../analytics/strength';
import type { RecoverySignal } from './recovery';
import { mean } from './window';

/** Regeln C1 bis C4, siehe `docs/coach-regeln.md`. Reine Funktionen. */

export interface MuscleLoad {
  muscle: string;
  /** Trainingstage je Woche, Mittel des Fensters. */
  daysPerWeek: number;
  /** Saetze je Woche, Mittel des Fensters. */
  setsPerWeek: number;
  belowFrequency: boolean;
  belowSets: boolean;
}

export interface MuscleLoads {
  muscles: MuscleLoad[];
  basisWeeks: number;
}

/** Wochenindizes des Fensters, in denen irgendeine Uebung geloggt ist. */
function loggedWeeks(training: ParsedTraining): number[] {
  const end = training.currentWeek;
  const start = Math.max(0, end - R.TRAINING_WINDOW_WEEKS);
  const exercises = Object.values(training.exercises);
  const weeks: number[] = [];
  for (let week = start; week < end; week++) {
    if (exercises.some((e) => (e.weeks[week]?.sets ?? 0) > 0)) weeks.push(week);
  }
  return weeks;
}

/** C1 und C3: Frequenz und Wochensaetze je Muskelgruppe. */
export function muscleLoads(training: ParsedTraining | null): Insight<MuscleLoads> {
  if (!training) return refuse(`Basis 0 von ${R.TRAINING_MIN_WEEKS} Wochen`);
  const weeks = loggedWeeks(training);
  if (weeks.length < R.TRAINING_MIN_WEEKS) return refuse(`Basis ${weeks.length} von ${R.TRAINING_MIN_WEEKS} Wochen`);

  const byMuscle = new Map<string, Exercise[]>();
  for (const exercise of Object.values(training.exercises)) {
    const muscle = exercise.muscleGroup.trim();
    if (!muscle) continue;
    byMuscle.set(muscle, [...(byMuscle.get(muscle) ?? []), exercise]);
  }

  const muscles: MuscleLoad[] = [];
  for (const [muscle, exercises] of byMuscle) {
    const days = weeks.map((week) => new Set(exercises.filter((e) => (e.weeks[week]?.sets ?? 0) > 0).map((e) => e.day)).size);
    const sets = weeks.map((week) => exercises.reduce((sum, e) => sum + (e.weeks[week]?.sets ?? 0), 0));
    const daysPerWeek = mean(days);
    const setsPerWeek = mean(sets);
    if (setsPerWeek === 0) continue;
    muscles.push({
      muscle,
      daysPerWeek,
      setsPerWeek,
      belowFrequency: daysPerWeek < R.FREQUENCY_TARGET_PER_WEEK,
      belowSets: setsPerWeek < R.MIN_WEEKLY_SETS,
    });
  }
  muscles.sort((a, b) => a.daysPerWeek - b.daysPerWeek || a.muscle.localeCompare(b.muscle));
  return { ok: true, muscles, basisWeeks: weeks.length };
}

export interface ExerciseProgress {
  key: string;
  name: string;
  day: string;
  /** Geloggte Wochen in Folge ohne neuen Bestwert. */
  stalledWeeks: number;
  /** Veraenderung des geschaetzten 1RM zur vorigen geloggten Woche in Prozent. */
  changePct: number;
  stalled: boolean;
  regressing: boolean;
}

export interface Progression {
  /** Nur bewertbare Uebungen, stehende und ruecklaeufige zuerst. */
  exercises: ExerciseProgress[];
  /** Anteil ruecklaeufiger Uebungen, 0 bis 1. */
  regressingShare: number;
  rated: number;
}

function estimates(exercise: Exercise): number[] {
  const values: number[] = [];
  for (const week of exercise.weeks) {
    if (week.implausible) continue;
    const value = epley1RM(week.load, avgRepsFromStr(week.repsActual));
    if (value !== null) values.push(value);
  }
  return values;
}

/** C2: Progression je Uebung ueber das geschaetzte 1RM. */
export function progression(training: ParsedTraining | null): Insight<Progression> {
  const exercises: ExerciseProgress[] = [];
  for (const exercise of Object.values(training?.exercises ?? {})) {
    const values = estimates(exercise);
    if (values.length < R.PROGRESSION_STALL_WEEKS) continue;
    const last = values[values.length - 1]!;
    const previous = values[values.length - 2]!;
    const stalledWeeks = values.length - 1 - values.lastIndexOf(Math.max(...values));
    const changePct = ((last - previous) / previous) * 100;
    exercises.push({
      key: exercise.key,
      name: exercise.name,
      day: exercise.day,
      stalledWeeks,
      changePct,
      stalled: stalledWeeks >= R.PROGRESSION_STALL_WEEKS,
      regressing: changePct <= -R.REGRESSION_PCT,
    });
  }
  if (!exercises.length) return refuse(`Keine Übung mit ${R.PROGRESSION_STALL_WEEKS} geloggten Wochen`);

  exercises.sort((a, b) => Number(b.regressing) - Number(a.regressing) || b.stalledWeeks - a.stalledWeeks);
  const regressing = exercises.filter((e) => e.regressing).length;
  return { ok: true, exercises, regressingShare: regressing / exercises.length, rated: exercises.length };
}

export interface Deload {
  signal: boolean;
  regressingShare: number;
  rated: number;
}

/** C4: Deload nur nach Symptomen, also Kraftrueckgang plus Erholungssignal. */
export function deload(progress: Insight<Progression>, recovery: Insight<RecoverySignal>): Insight<Deload> {
  if (!progress.ok) return progress;
  if (progress.rated < R.DELOAD_MIN_EXERCISES) return refuse(`Basis ${progress.rated} von ${R.DELOAD_MIN_EXERCISES} Übungen`);
  if (!recovery.ok) return recovery;
  const signal = progress.regressingShare >= R.DELOAD_REGRESSION_SHARE && recovery.active;
  return { ok: true, signal, regressingShare: progress.regressingShare, rated: progress.rated };
}
