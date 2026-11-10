import type { DailyEntry } from '../types';
import { COACH_RULES as R } from '../config/coachRules';
import { refuse, tooFewDays, type Insight } from '../analytics/result';
import type { Plan } from '../parse/plan';
import { parseTrainingMarker } from '../parse/trainingday';
import type { KcalOpinion } from './calories';
import { show, windowOf } from './window';

/** Regeln B1 bis B4, siehe `docs/coach-regeln.md`. Reine Funktionen. */

export type DayType = 'low' | 'medium' | 'high';

export interface DayMacros {
  type: DayType;
  daysPerWeek: number;
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

export interface MacroPlan {
  /** Nur Tagestypen, die in der Woche vorkommen. */
  days: DayMacros[];
  weeklyAvgKcal: number;
  trainingDaysPerWeek: number;
}

export interface TrainingDays {
  perWeek: number;
  basisDays: number;
}

/** Trainingstage je Woche aus der Spalte `Trainingday`. */
export function trainingDaysPerWeek(daily: readonly DailyEntry[]): Insight<TrainingDays> {
  const marked = windowOf(daily, R.DAY_TYPE_WINDOW_DAYS, 0, (e) => parseTrainingMarker(e.training).kind === 'training')
    .map((e) => parseTrainingMarker(e.training).kind);
  if (marked.length < R.DAY_TYPE_MIN_DAYS) return tooFewDays(marked.length, R.DAY_TYPE_MIN_DAYS);
  const training = marked.filter((kind) => kind === 'training').length;
  const perWeek = Math.min(R.DAYS_PER_WEEK, Math.round((training / marked.length) * R.DAYS_PER_WEEK));
  if (perWeek < 1) return refuse(`Trainingstage 0 in ${marked.length} Tagen`);
  return { ok: true, perWeek, basisDays: marked.length };
}

/** Plantag mit den meisten Saetzen, dort liegt der High Day. */
export function hardestPlanDay(plan: Plan | null): string | null {
  if (!plan?.days.length) return null;
  const setsOf = (index: number): number => plan.days[index]!.exercises.reduce((sum, e) => sum + e.sets, 0);
  let best = 0;
  plan.days.forEach((_, index) => {
    if (setsOf(index) > setsOf(best)) best = index;
  });
  return plan.days[best]!.label || plan.days[best]!.tag;
}

function kcalOf(proteinG: number, carbsG: number, fatG: number): number {
  return proteinG * R.KCAL_PER_G_PROTEIN + carbsG * R.KCAL_PER_G_CARBS + fatG * R.KCAL_PER_G_FAT;
}

export interface MacroInput {
  opinion: Insight<KcalOpinion>;
  trainingDays: Insight<TrainingDays>;
  /** Aufbauphase: zwei High Days, Protein am unteren Ende. */
  surplus: boolean;
}

/**
 * B4: drei Tagestypen. Der Low Day ist fest bestimmt, die Carbs der
 * Trainingstage fuellen so auf, dass der Wochenschnitt die Kalorien aus A1 trifft.
 */
export function macroPlan(input: MacroInput): Insight<MacroPlan> {
  const { opinion, trainingDays, surplus } = input;
  if (!opinion.ok) return opinion;
  if (!trainingDays.ok) return trainingDays;

  const weight = opinion.weightKg;
  const proteinBase = weight * (surplus ? R.PROTEIN_G_PER_KG_SURPLUS : R.PROTEIN_G_PER_KG_DEFICIT);
  const proteinFloor = weight * R.PROTEIN_FLOOR_G_PER_KG;
  const training = trainingDays.perWeek;
  const highDays = Math.min(surplus ? R.HIGH_DAYS_PER_WEEK_BULK : R.HIGH_DAYS_PER_WEEK_CUT, training);
  const mediumDays = training - highDays;
  const lowDays = R.DAYS_PER_WEEK - training;
  const weekKcal = opinion.kcal * R.DAYS_PER_WEEK;

  const lowProtein = proteinBase * R.LOW_DAY_PROTEIN_FACTOR;
  const lowCarbs = weight * R.LOW_DAY_CARBS_G_PER_KG;
  const low: DayMacros = {
    type: 'low',
    daysPerWeek: lowDays,
    kcal: kcalOf(lowProtein, lowCarbs, R.LOW_DAY_FAT_G),
    proteinG: lowProtein,
    carbsG: lowCarbs,
    fatG: R.LOW_DAY_FAT_G,
  };

  // Low ist fest. Der Rest der Woche geht in die Carbs der Trainingstage, der
  // High Day bekommt davon das Vielfache eines Medium Day.
  const highProtein = Math.max(proteinBase * R.HIGH_DAY_PROTEIN_FACTOR, proteinFloor);
  const fixedKcal = lowDays * low.kcal
    + mediumDays * kcalOf(proteinBase, 0, R.MEDIUM_DAY_FAT_G)
    + highDays * kcalOf(highProtein, 0, R.HIGH_DAY_FAT_G);
  const carbUnits = mediumDays + highDays * R.HIGH_DAY_CARBS_FACTOR;
  const mediumCarbs = (weekKcal - fixedKcal) / (carbUnits * R.KCAL_PER_G_CARBS);
  if (mediumCarbs < lowCarbs) {
    return refuse(`Carbs Medium ${show(mediumCarbs, 0)} g unter Low ${show(lowCarbs, 0)} g`);
  }
  const highCarbs = mediumCarbs * R.HIGH_DAY_CARBS_FACTOR;

  const days: DayMacros[] = lowDays > 0 ? [low] : [];
  if (mediumDays > 0) {
    days.push({
      type: 'medium',
      daysPerWeek: mediumDays,
      kcal: kcalOf(proteinBase, mediumCarbs, R.MEDIUM_DAY_FAT_G),
      proteinG: proteinBase,
      carbsG: mediumCarbs,
      fatG: R.MEDIUM_DAY_FAT_G,
    });
  }
  days.push({
    type: 'high',
    daysPerWeek: highDays,
    kcal: kcalOf(highProtein, highCarbs, R.HIGH_DAY_FAT_G),
    proteinG: highProtein,
    carbsG: highCarbs,
    fatG: R.HIGH_DAY_FAT_G,
  });

  const weeklyAvgKcal = days.reduce((sum, d) => sum + d.kcal * d.daysPerWeek, 0) / R.DAYS_PER_WEEK;
  return { ok: true, days, weeklyAvgKcal, trainingDaysPerWeek: training };
}
