import type { DayGoals } from '../parse/goals';
import type { Food, Macros } from './types';
import { addMacros, sumIngredients, ZERO_MACROS } from './macros';
import { indexById } from './plan';
import type { EffectivePlan, PlannedDay } from './rotation';

export function dayMacros(day: PlannedDay, foods: readonly Food[]): Macros {
  const byId = indexById(foods);
  return day.slots.reduce((sum, slot) => addMacros(sum, sumIngredients(slot.ingredients, byId)), ZERO_MACROS);
}

export function weekMacros(plan: EffectivePlan, foods: readonly Food[]): Macros {
  return plan.days.reduce((sum, day) => addMacros(sum, dayMacros(day, foods)), ZERO_MACROS);
}

export interface GoalComparison {
  actual: number;
  goal: number;
  /** actual minus goal, positiv heisst drueber. */
  diff: number;
}

export interface DayGoalComparison {
  caloriesKcal: GoalComparison | null;
  proteinG: GoalComparison | null;
  carbsG: GoalComparison | null;
  fatG: GoalComparison | null;
  fiberG: GoalComparison | null;
}

/** Fehlt das Ziel, gibt es keinen Vergleich. Ein Ersatzwert wird nie eingesetzt. */
function compare(actual: number, goal: number | null): GoalComparison | null {
  if (goal === null) return null;
  return { actual, goal, diff: actual - goal };
}

export function compareToGoals(totals: Macros, goals: DayGoals): DayGoalComparison {
  return {
    caloriesKcal: compare(totals.kcal, goals.caloriesKcal),
    proteinG: compare(totals.protein, goals.proteinG),
    carbsG: compare(totals.carbs, goals.carbsG),
    fatG: compare(totals.fat, goals.fatG),
    fiberG: compare(totals.fiber, goals.fiberG),
  };
}
