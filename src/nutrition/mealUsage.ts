import type { PlannedDay } from './rotation';
import type { Ingredient } from './types';

/** Ein Gericht im aktiven Wochenplan: Zutaten je Portion und Summe der Woche. */
export interface MealUsage {
  /** Wie oft das Gericht in der Woche vorkommt. */
  portions: number;
  /** Zutaten einer Portion, aus dem ersten Vorkommen. Leer, wenn das Gericht nicht vorkommt. */
  perPortion: Ingredient[];
  /** Gramm je Zutat ueber alle Vorkommen der Woche, in der Reihenfolge des ersten Auftretens. */
  weekTotal: Ingredient[];
}

/** Zutaten eines Gerichts im aktiven Plan, je Portion und als Wochensumme. */
export function mealUsage(days: readonly PlannedDay[], mealId: string): MealUsage {
  const occurrences = days.flatMap((day) => day.slots.filter((slot) => slot.mealId === mealId));
  const first = occurrences[0];
  if (!first) return { portions: 0, perPortion: [], weekTotal: [] };

  const totals = new Map<string, number>();
  for (const occurrence of occurrences) {
    for (const ing of occurrence.ingredients) totals.set(ing.foodId, (totals.get(ing.foodId) ?? 0) + ing.grams);
  }
  return {
    portions: occurrences.length,
    perPortion: first.ingredients.map((ing) => ({ ...ing })),
    weekTotal: [...totals].map(([foodId, grams]) => ({ foodId, grams })),
  };
}
