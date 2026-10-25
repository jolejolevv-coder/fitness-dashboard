import foodsJson from '../../data/foods.json';
import mealsJson from '../../data/meals.json';
import rotationJson from '../../data/rotation.json';
import shoppingItemsJson from '../../data/shopping_items.json';
import prepJson from '../../data/prep.json';
import type { Food, Meal, PrepSession, Rotation, ShoppingItem } from './types';
import { SLOTS, WEEKDAYS } from './types';

/**
 * Die gebuendelten Plandaten.
 *
 * Die JSON Dateien kennen ihre Typen nicht, daher die Zuweisung ueber `unknown`.
 * Ob die Daten in sich stimmig sind, prueft `validatePlan`.
 */
export const FOODS = foodsJson as unknown as Food[];
export const MEALS = mealsJson as unknown as Meal[];
export const ROTATION = rotationJson as unknown as Rotation;
export const SHOPPING_ITEMS = shoppingItemsJson as unknown as ShoppingItem[];
export const PREP_SESSIONS = prepJson as unknown as PrepSession[];

export interface PlanData {
  foods: Food[];
  meals: Meal[];
  rotation: Rotation;
  shoppingItems: ShoppingItem[];
  prep: PrepSession[];
}

export const PLAN: PlanData = {
  foods: FOODS,
  meals: MEALS,
  rotation: ROTATION,
  shoppingItems: SHOPPING_ITEMS,
  prep: PREP_SESSIONS,
};

export function indexById<T extends { id: string }>(list: readonly T[]): Map<string, T> {
  return new Map(list.map((entry) => [entry.id, entry]));
}

/**
 * Prueft die Querverweise zwischen den Dateien.
 *
 * Liefert Klartext je Fund, eine leere Liste bedeutet stimmig. Geworfen wird
 * nicht, damit die Oberflaeche die Funde anzeigen kann.
 */
export function validatePlan(plan: PlanData): string[] {
  const issues: string[] = [];
  const foodIds = new Set(plan.foods.map((f) => f.id));
  const mealIds = new Set(plan.meals.map((m) => m.id));
  const itemIds = new Set(plan.shoppingItems.map((i) => i.foodId));

  for (const meal of plan.meals) {
    for (const ing of meal.ingredients) {
      if (!foodIds.has(ing.foodId)) issues.push(`Gericht ${meal.id}: unbekannte Zutat ${ing.foodId}`);
    }
    if (meal.addToSlot && !foodIds.has(meal.addToSlot.foodId)) {
      issues.push(`Gericht ${meal.id}: unbekannter Zuschlag ${meal.addToSlot.foodId}`);
    }
  }

  for (const day of WEEKDAYS) {
    for (const slot of SLOTS) {
      const id = plan.rotation[day]?.[slot];
      if (!id || !mealIds.has(id)) issues.push(`Rotation ${day} ${slot}: unbekanntes Gericht ${id ?? 'leer'}`);
    }
  }

  for (const item of plan.shoppingItems) {
    if (!foodIds.has(item.foodId)) issues.push(`Einkauf: unbekannte Zutat ${item.foodId}`);
    if (item.unit === 'piece' && !item.gramsPerPiece) issues.push(`Einkauf ${item.foodId}: Stueckgewicht fehlt`);
  }

  // Jede Zutat, die ein Gericht nutzt, braucht einen Einkaufseintrag.
  const used = new Set(plan.meals.flatMap((m) => [...m.ingredients.map((i) => i.foodId), ...(m.addToSlot ? [m.addToSlot.foodId] : [])]));
  for (const id of used) {
    if (!itemIds.has(id)) issues.push(`Einkauf: kein Eintrag fuer ${id}`);
  }

  return issues;
}
