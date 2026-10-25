import type { DayTolerance } from '../config/generator';
import { GENERATED_MEAL_PREFIX } from '../config/generator';
import type { Food, PrepDevice, ShoppingItem, Weekday } from '../nutrition/types';
import { SLOTS, WEEKDAYS } from '../nutrition/types';

export interface PromptGoals {
  caloriesKcal: number;
  proteinG: number;
  fatG: number;
  carbsG: number | null;
  fiberG: number | null;
}

/** Aktuell guenstigstes Angebot eines Lebensmittels. */
export interface FoodOffer {
  foodId: string;
  pricePerKg: number;
  store: string;
}

export interface GeneratorInput {
  goals: PromptGoals;
  /** Erlaubte Lebensmittel, Ausschluesse sind schon entfernt. */
  foods: readonly Food[];
  shoppingItems: readonly ShoppingItem[];
  offers?: readonly FoodOffer[];
  devices: readonly PrepDevice[];
  prepDays: readonly Weekday[];
  tolerance: DayTolerance;
  wish: string;
}

const byId = <T extends { id: string }>(a: T, b: T): number => a.id.localeCompare(b.id);

function foodLine(food: Food, packs: readonly number[] | undefined, offer: FoodOffer | undefined): string {
  const parts = [`${food.id} | ${food.name} | ${food.kind}`];
  if (food.kind !== 'spice') {
    parts.push(`per 100 g: kcal ${food.kcal}, protein ${food.protein}, carbs ${food.carbs}, fat ${food.fat}, fiber ${food.fiber}`);
  }
  if (packs && packs.length > 0) parts.push(`packs g: ${[...packs].sort((a, b) => a - b).join(', ')}`);
  if (offer) parts.push(`offer: ${offer.pricePerKg} EUR/kg at ${offer.store}`);
  return parts.join(' | ');
}

function goalLines(goals: PromptGoals, tolerance: DayTolerance): string[] {
  const lines = [
    `kcal: ${goals.caloriesKcal} per day, tolerance plus or minus ${tolerance.kcalBand}`,
    `protein: at least ${goals.proteinG} g per day`,
    `fat: ${goals.fatG} g per day, tolerance plus or minus ${tolerance.fatBandG} g`,
  ];
  if (goals.carbsG !== null) lines.push(`carbs: ${goals.carbsG} g per day (informational, not checked)`);
  if (goals.fiberG !== null) lines.push(`fiber: ${goals.fiberG} g per day (informational, not checked)`);
  return lines;
}

function systemPrompt(): string {
  return [
    'You design a weekly meal plan with meal prep sessions for one person.',
    'Output must match the given JSON schema. Meal names and prep titles are written in German, everything else is machine readable.',
  ].join('\n');
}

function userPrompt(input: GeneratorInput): string {
  const packsByFood = new Map(input.shoppingItems.map((item) => [item.foodId, item.packSizesG]));
  const offerByFood = new Map((input.offers ?? []).map((offer) => [offer.foodId, offer]));
  const foods = [...input.foods].sort(byId).map((f) => foodLine(f, packsByFood.get(f.id), offerByFood.get(f.id)));
  const wish = input.wish.trim();

  return [
    'Daily goals, every single day of the week must meet them:',
    ...goalLines(input.goals, input.tolerance),
    '',
    'Rules:',
    '- Use only the food ids from the list below. Never invent an id.',
    '- Spices and herbs (kind spice) carry grams 0. Sauces count with their grams.',
    `- Every new meal id starts with the prefix "${GENERATED_MEAL_PREFIX}" and is unique.`,
    `- Meal slots are ${SLOTS.join(', ')}. Each meal belongs to exactly one slot.`,
    `- The rotation fills every day (${WEEKDAYS.join(', ')}) and every slot with a meal of that slot.`,
    '- Each day must be within the goal tolerance. Compute the day totals from the per 100 g values before answering.',
    `- Prep sessions take place on ${input.prepDays.join(' and ')}. They cover the cooked components of the meals, with the days they serve.`,
    `- Prep devices: ${input.devices.join(', ')}. Each step names exactly one of them.`,
    '- Each prep cover lists a slot, days, the meal ids of that slot, and optionally the food ids that are prepared. Foods must be ingredients of the listed meals.',
    '- Prefer foods with a current offer and pack sizes that fit the weekly demand, without breaking the goals.',
    '- Ingredients the person might want but that are not in the list go to the wishlist as plain names. Do not put them into meals.',
    '',
    'Allowed foods (id | name | kind | nutrition | packs | offer):',
    ...foods,
    '',
    wish === '' ? 'Wishes: none' : `Wishes: ${wish}`,
  ].join('\n');
}

export function buildPrompt(input: GeneratorInput): { system: string; user: string } {
  return { system: systemPrompt(), user: userPrompt(input) };
}
