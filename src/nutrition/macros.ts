import type { Food, Ingredient, Macros, Meal } from './types';
import { indexById } from './plan';

const GRAMS_PER_REFERENCE = 100;

export const ZERO_MACROS: Macros = { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };

export function addMacros(a: Macros, b: Macros): Macros {
  return {
    kcal: a.kcal + b.kcal,
    protein: a.protein + b.protein,
    carbs: a.carbs + b.carbs,
    fat: a.fat + b.fat,
    fiber: a.fiber + b.fiber,
  };
}

/** Naehrwerte je 100 g, oder null bei Gewuerzen. Fehlen sie sonst, ist die Datei kaputt. */
function per100g(food: Food): Macros | null {
  if (food.kind === 'spice') return null;
  const { kcal, protein, carbs, fat, fiber } = food;
  if (kcal === undefined || protein === undefined || carbs === undefined || fat === undefined || fiber === undefined) {
    throw new Error(`Naehrwerte fehlen fuer ${food.id}`);
  }
  return { kcal, protein, carbs, fat, fiber };
}

export function ingredientMacros(ingredient: Ingredient, foods: ReadonlyMap<string, Food>): Macros {
  const food = foods.get(ingredient.foodId);
  if (!food) throw new Error(`Unbekannte Zutat ${ingredient.foodId}`);
  const base = per100g(food);
  if (!base) return ZERO_MACROS;
  const factor = ingredient.grams / GRAMS_PER_REFERENCE;
  return {
    kcal: base.kcal * factor,
    protein: base.protein * factor,
    carbs: base.carbs * factor,
    fat: base.fat * factor,
    fiber: base.fiber * factor,
  };
}

export function sumIngredients(ingredients: readonly Ingredient[], foods: ReadonlyMap<string, Food>): Macros {
  return ingredients.reduce((sum, ing) => addMacros(sum, ingredientMacros(ing, foods)), ZERO_MACROS);
}

/** Makros der eigenen Zutaten, ohne Zuschlag auf ein anderes Gericht. */
export function mealMacros(meal: Meal, foods: readonly Food[]): Macros {
  return sumIngredients(meal.ingredients, indexById(foods));
}

/** Makros des Zuschlags, den das Gericht auf einen anderen Slot legt. */
export function addOnMacros(meal: Meal, foods: readonly Food[]): Macros {
  if (!meal.addToSlot) return ZERO_MACROS;
  return ingredientMacros(meal.addToSlot, indexById(foods));
}

/** Gericht samt Zuschlag, also was ein Tag durch dieses Gericht insgesamt bekommt. */
export function mealMacrosWithAddOn(meal: Meal, foods: readonly Food[]): Macros {
  return addMacros(mealMacros(meal, foods), addOnMacros(meal, foods));
}
