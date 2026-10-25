import type { Ingredient, Meal, Rotation, Slot, Weekday } from './types';
import { SLOTS, WEEKDAYS } from './types';
import { indexById } from './plan';

/**
 * Aenderungen gegen die Standardrotation: Tausch je Tag und Slot, Riegel
 * Schalter je Tag. Das Speichern ist Sache der Oberflaeche.
 */
export interface Overrides {
  swaps: Partial<Record<Weekday, Partial<Record<Slot, string>>>>;
  bar: Partial<Record<Weekday, boolean>>;
}

export const NO_OVERRIDES: Overrides = { swaps: {}, bar: {} };

export interface PlannedSlot {
  slot: Slot;
  mealId: string;
  /** Zutaten des Gerichts plus Zuschlaege anderer Gerichte desselben Tages. */
  ingredients: Ingredient[];
}

export interface PlannedDay {
  day: Weekday;
  slots: PlannedSlot[];
  barActive: boolean;
}

export interface EffectivePlan {
  days: PlannedDay[];
  /** Overrides und Verweise, die nicht angewendet werden konnten. */
  issues: string[];
}

/** Das Gericht mit Zuschlag ist die Riegel Option. */
export function findBarMeal(meals: readonly Meal[]): Meal | null {
  return meals.find((m) => m.addToSlot !== undefined) ?? null;
}

function resolveMealId(
  day: Weekday,
  slot: Slot,
  rotation: Rotation,
  overrides: Overrides,
  byId: ReadonlyMap<string, Meal>,
  issues: string[],
): string {
  const swapId = overrides.swaps[day]?.[slot];
  if (swapId === undefined) return rotation[day][slot];
  const swapMeal = byId.get(swapId);
  if (swapMeal?.slot === slot) return swapId;
  issues.push(`Tausch ${day} ${slot}: ${swapId} passt nicht, Standard bleibt`);
  return rotation[day][slot];
}

function planDay(
  day: Weekday,
  rotation: Rotation,
  overrides: Overrides,
  meals: readonly Meal[],
  byId: ReadonlyMap<string, Meal>,
  issues: string[],
): PlannedDay {
  const barMeal = overrides.bar[day] ? findBarMeal(meals) : null;
  if (overrides.bar[day] && !barMeal) issues.push(`Riegel ${day}: kein Gericht mit Zuschlag vorhanden`);

  const chosen: { slot: Slot; meal: Meal }[] = [];
  for (const slot of SLOTS) {
    const mealId = barMeal && barMeal.slot === slot ? barMeal.id : resolveMealId(day, slot, rotation, overrides, byId, issues);
    const meal = byId.get(mealId);
    if (!meal) {
      issues.push(`Rotation ${day} ${slot}: unbekanntes Gericht ${mealId}`);
      continue;
    }
    chosen.push({ slot, meal });
  }

  const slots: PlannedSlot[] = chosen.map(({ slot, meal }) => ({
    slot,
    mealId: meal.id,
    ingredients: [...meal.ingredients],
  }));

  for (const { meal } of chosen) {
    const add = meal.addToSlot;
    if (!add) continue;
    const target = slots.find((s) => s.slot === add.slot);
    if (target) target.ingredients.push({ foodId: add.foodId, grams: add.grams });
    else issues.push(`Zuschlag ${meal.id}: Slot ${add.slot} am ${day} fehlt`);
  }

  return { day, slots, barActive: barMeal !== null };
}

/** Standardrotation plus Overrides, Tag fuer Tag. */
export function effectivePlan(rotation: Rotation, overrides: Overrides, meals: readonly Meal[]): EffectivePlan {
  const issues: string[] = [];
  const byId = indexById(meals);
  const days = WEEKDAYS.map((day) => planDay(day, rotation, overrides, meals, byId, issues));
  return { days, issues };
}
