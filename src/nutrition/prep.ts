import type { Food, PrepCover, PrepDevice, PrepSession, Weekday } from './types';
import type { EffectivePlan } from './rotation';
import { indexById } from './plan';

export interface PrepUse {
  mealId: string;
  days: Weekday[];
  /** Null bei Gewuerzen. */
  grams: number | null;
}

export interface PrepLine {
  foodId: string;
  name: string;
  /** Gesamtmenge ueber alle Gerichte des Schritts, null bei Gewuerzen. */
  grams: number | null;
  uses: PrepUse[];
}

export interface PrepStepResult {
  /** Aus `prep.json`, fehlt bei generierten Plaenen. */
  id?: string;
  title: string;
  device: PrepDevice;
  lines: PrepLine[];
}

export interface PrepSessionResult {
  id: string;
  title: string;
  steps: PrepStepResult[];
}

/** Gramm je Zutat und Gericht, ueber die Tage einer Abdeckung gesammelt. */
function collectCover(cover: PrepCover, plan: EffectivePlan): Map<string, Map<string, { days: Weekday[]; grams: number }>> {
  const byFood = new Map<string, Map<string, { days: Weekday[]; grams: number }>>();
  for (const dayName of cover.days) {
    const slot = plan.days.find((d) => d.day === dayName)?.slots.find((s) => s.slot === cover.slot);
    if (!slot || !cover.meals.includes(slot.mealId)) continue;
    for (const ing of slot.ingredients) {
      if (cover.foods && !cover.foods.includes(ing.foodId)) continue;
      const perMeal = byFood.get(ing.foodId) ?? new Map();
      const entry = perMeal.get(slot.mealId) ?? { days: [], grams: 0 };
      entry.days.push(dayName);
      entry.grams += ing.grams;
      perMeal.set(slot.mealId, entry);
      byFood.set(ing.foodId, perMeal);
    }
  }
  return byFood;
}

function buildStep(step: PrepSession['steps'][number], plan: EffectivePlan, foods: ReadonlyMap<string, Food>): PrepStepResult {
  const lines = new Map<string, PrepLine>();
  for (const cover of step.covers) {
    for (const [foodId, perMeal] of collectCover(cover, plan)) {
      const food = foods.get(foodId);
      const isSpice = food?.kind === 'spice';
      const line = lines.get(foodId) ?? { foodId, name: food?.name ?? foodId, grams: isSpice ? null : 0, uses: [] };
      for (const [mealId, entry] of perMeal) {
        line.uses.push({ mealId, days: entry.days, grams: isSpice ? null : entry.grams });
        if (!isSpice) line.grams = (line.grams ?? 0) + entry.grams;
      }
      lines.set(foodId, line);
    }
  }
  return { ...(step.id ? { id: step.id } : {}), title: step.title, device: step.device, lines: [...lines.values()] };
}

/**
 * Prep Sessions mit Mengen aus der effektiven Rotation. Mengen werden nie aus
 * der Datei gelesen, ein Tausch oder Riegel Schalter wirkt also sofort.
 */
export function buildPrep(sessions: readonly PrepSession[], plan: EffectivePlan, foods: readonly Food[]): PrepSessionResult[] {
  const byId = indexById(foods);
  return sessions.map((session) => ({
    id: session.id,
    title: session.title,
    steps: session.steps.map((step) => buildStep(step, plan, byId)),
  }));
}
