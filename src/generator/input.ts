import type { DayTolerance } from '../config/generator';
import { PREP_DAYS } from '../config/generator';
import type { PlanData } from '../nutrition/plan';
import { cheapestOffer } from '../nutrition/prices';
import { PREP_DEVICES } from '../nutrition/types';
import type { DayGoals } from '../parse/goals';
import type { Offer } from '../../scripts/prices/types';
import { goalsReadiness } from './check';
import type { FoodOffer, GeneratorInput } from './prompt';
import { allowedFoodIds } from './schema';

/**
 * Eingaben fuer einen Lauf und ob der Knopf ihn ausloesen darf. Reine
 * Funktionen, die Oberflaeche liefert Speicherstand und Sheet Ziele.
 */

export interface GenerateReadiness {
  enabled: boolean;
  /** Eine Zahlenzeile je fehlender Voraussetzung, leer wenn der Knopf frei ist. */
  reasons: string[];
}

export function generateReadiness(
  apiKey: string | null,
  goals: DayGoals | null,
  plan: PlanData,
  exclusions: ReadonlySet<string>,
): GenerateReadiness {
  const reasons: string[] = [];
  if (apiKey === null) reasons.push('API Key 0 von 1');

  const readiness = goalsReadiness(goals);
  if (readiness.available < readiness.required) reasons.push(`Ziele ${readiness.available} von ${readiness.required}`);

  const allowed = allowedFoodIds(plan, NO_EXCLUSIONS).length;
  if (allowedFoodIds(plan, exclusions).length === 0) reasons.push(`Lebensmittel 0 von ${allowed}`);

  return { enabled: reasons.length === 0, reasons };
}

const NO_EXCLUSIONS: ReadonlySet<string> = new Set();

/** Guenstigstes gueltiges Angebot je erlaubtem Lebensmittel. Ohne Grundpreis kein Eintrag. */
export function currentOffers(offers: readonly Offer[], foodIds: readonly string[], today: string): FoodOffer[] {
  const result: FoodOffer[] = [];
  for (const foodId of foodIds) {
    const offer = cheapestOffer(offers, foodId, today);
    if (offer && offer.price_per_kg !== null) result.push({ foodId, pricePerKg: offer.price_per_kg, store: offer.store });
  }
  return result;
}

export interface InputSources {
  plan: PlanData;
  goals: DayGoals | null;
  exclusions: ReadonlySet<string>;
  wish: string;
  /** Angebote aus `prices.json`, `null` ohne Preisdatei. */
  offers: readonly Offer[] | null;
  today: string;
  tolerance: DayTolerance;
}

/** `null`, solange eines der Pflichtziele fehlt. */
export function buildGeneratorInput(sources: InputSources): GeneratorInput | null {
  const goals = sources.goals;
  if (!goals || goals.caloriesKcal === null || goals.proteinG === null || goals.fatG === null) return null;

  const allowed = new Set(allowedFoodIds(sources.plan, sources.exclusions));
  const foods = sources.plan.foods.filter((food) => allowed.has(food.id));
  const shoppingItems = sources.plan.shoppingItems.filter((item) => allowed.has(item.foodId));
  const offers = sources.offers ? currentOffers(sources.offers, [...allowed].sort(), sources.today) : [];

  return {
    goals: {
      caloriesKcal: goals.caloriesKcal,
      proteinG: goals.proteinG,
      fatG: goals.fatG,
      carbsG: goals.carbsG,
      fiberG: goals.fiberG,
    },
    foods,
    shoppingItems,
    offers,
    devices: PREP_DEVICES,
    prepDays: PREP_DAYS,
    tolerance: sources.tolerance,
    wish: sources.wish,
  };
}
