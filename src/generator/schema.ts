import type { PlanData } from '../nutrition/plan';
import { PREP_DEVICES, SLOTS, WEEKDAYS } from '../nutrition/types';

/** Lebensmittel, die das Modell nutzen darf: mit Einkaufseintrag, ohne Ausschluesse. */
export function allowedFoodIds(plan: PlanData, exclusions: ReadonlySet<string>): string[] {
  const shoppable = new Set(plan.shoppingItems.map((item) => item.foodId));
  return plan.foods
    .map((food) => food.id)
    .filter((id) => shoppable.has(id) && !exclusions.has(id))
    .sort();
}

type JsonSchema = Record<string, unknown>;

/** Objekt nach den Regeln der Structured Outputs: alles Pflicht, nichts zusaetzlich. */
function object(properties: Record<string, JsonSchema>): JsonSchema {
  return { type: 'object', properties, required: Object.keys(properties), additionalProperties: false };
}

const text = (): JsonSchema => ({ type: 'string' });
const list = (items: JsonSchema): JsonSchema => ({ type: 'array', items });
const choice = (values: readonly string[]): JsonSchema => ({ type: 'string', enum: [...values] });

function rotationSchema(): JsonSchema {
  const perSlot = object(Object.fromEntries(SLOTS.map((slot) => [slot, text()])));
  return object(Object.fromEntries(WEEKDAYS.map((day) => [day, perSlot])));
}

function coverSchema(foodIds: readonly string[]): JsonSchema {
  return object({
    slot: choice(SLOTS),
    days: list(choice(WEEKDAYS)),
    meals: list(text()),
    foods: list(choice(foodIds)),
  });
}

function prepSchema(foodIds: readonly string[]): JsonSchema {
  const step = object({ title: text(), device: choice(PREP_DEVICES), covers: list(coverSchema(foodIds)) });
  return object({ id: text(), title: text(), steps: list(step) });
}

function mealSchema(foodIds: readonly string[]): JsonSchema {
  const ingredient = object({ foodId: choice(foodIds), grams: { type: 'integer' } });
  return object({ id: text(), slot: choice(SLOTS), name: text(), ingredients: list(ingredient) });
}

/** JSON Schema fuer `output_config.format`. */
export function buildPlanSchema(foodIds: readonly string[]): JsonSchema {
  return object({
    meals: list(mealSchema(foodIds)),
    rotation: rotationSchema(),
    prep: list(prepSchema(foodIds)),
    wishlist: list(text()),
  });
}
