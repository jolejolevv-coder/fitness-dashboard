import type { Food, ShoppingCategory, ShoppingItem } from './types';
import type { EffectivePlan } from './rotation';
import { indexById } from './plan';

/** Reihenfolge und Beschriftung der Gruppen in der Einkaufsliste. */
export const CATEGORY_ORDER: readonly ShoppingCategory[] = [
  'meat_fish',
  'chilled',
  'produce',
  'frozen',
  'dry',
  'spices_sauces',
];

export const CATEGORY_LABELS: Record<ShoppingCategory, string> = {
  meat_fish: 'Fleisch und Fisch',
  chilled: 'Kühlregal',
  produce: 'Obst und Gemüse',
  frozen: 'Tiefkühl',
  dry: 'Trockenware',
  spices_sauces: 'Gewürze und Soßen',
};

/**
 * Wie viel Unterdeckung bei Packungen noch als gedeckt gilt, als Anteil des
 * Bedarfs. 640 g Kidneybohnen sind mit drei Dosen zu je 213 g gedeckt, obwohl
 * 639 g rechnerisch ein Gramm fehlen. Ohne Toleranz stuende dort eine vierte Dose.
 * 8 Prozent entsprechen der Einkaufsliste im Plan Dokument: Hack 840 g mit zwei
 * Packungen zu 400 g, Aufschnitt 260 g mit zwei zu 120 g, Zucchini 1320 g mit
 * fuenf Stueck. Der Rest wird beim Portionieren ausgeglichen.
 */
export const PACK_SHORTFALL_TOLERANCE = 0.08;

/** Rundungsrauschen bei Gleitkommasummen, etwa 10 Eier zu 50 g. */
const EPSILON = 1e-9;

export interface ShoppingLine {
  foodId: string;
  name: string;
  category: ShoppingCategory;
  /** Wochenbedarf in g. Gewuerze tragen 0. */
  neededG: number;
  /** Stueck, nur bei Einheit `piece`. */
  pieces: number | null;
  packSizeG: number | null;
  packs: number | null;
  /** Einzukaufende Menge in g nach Rundung, null bei Gewuerzen. */
  buyG: number | null;
  pantry: boolean;
  isSpice: boolean;
}

export interface ShoppingGroup {
  category: ShoppingCategory;
  label: string;
  lines: ShoppingLine[];
}

export interface ShoppingList {
  groups: ShoppingGroup[];
  /** Zutaten im Bedarf ohne Eintrag in `shopping_items.json`. */
  missingItems: string[];
}

/** Wochenbedarf je Zutat in g, aus allen Slots der effektiven Rotation. */
export function weeklyDemand(plan: EffectivePlan): Map<string, number> {
  const demand = new Map<string, number>();
  for (const day of plan.days) {
    for (const slot of day.slots) {
      for (const ing of slot.ingredients) {
        demand.set(ing.foodId, (demand.get(ing.foodId) ?? 0) + ing.grams);
      }
    }
  }
  return demand;
}

interface PackChoice {
  packSizeG: number;
  packs: number;
}

/** Packungsgroesse mit der geringsten Ueberkauf Menge, bei Gleichstand die mit weniger Packungen. */
export function roundToPacks(neededG: number, packSizesG: readonly number[]): PackChoice | null {
  let best: (PackChoice & { total: number }) | null = null;
  for (const size of packSizesG) {
    const packs = Math.max(1, Math.ceil((neededG * (1 - PACK_SHORTFALL_TOLERANCE)) / size - EPSILON));
    const total = packs * size;
    if (!best || total < best.total || (total === best.total && packs < best.packs)) {
      best = { packSizeG: size, packs, total };
    }
  }
  return best ? { packSizeG: best.packSizeG, packs: best.packs } : null;
}

function buildLine(item: ShoppingItem, food: Food, neededG: number): ShoppingLine {
  const base = {
    foodId: item.foodId,
    name: food.name,
    category: item.category,
    neededG,
    pantry: item.pantry,
    isSpice: food.kind === 'spice',
  };

  if (food.kind === 'spice') {
    return { ...base, pieces: null, packSizeG: null, packs: null, buyG: null };
  }
  if (item.unit === 'piece') {
    const perPiece = item.gramsPerPiece ?? 0;
    const pieces = Math.max(1, Math.ceil((neededG * (1 - PACK_SHORTFALL_TOLERANCE)) / perPiece - EPSILON));
    return { ...base, pieces, packSizeG: null, packs: null, buyG: pieces * perPiece };
  }
  const choice = roundToPacks(neededG, item.packSizesG);
  if (choice) {
    return { ...base, pieces: null, packSizeG: choice.packSizeG, packs: choice.packs, buyG: choice.packSizeG * choice.packs };
  }
  return { ...base, pieces: null, packSizeG: null, packs: null, buyG: Math.ceil(neededG - EPSILON) };
}

/**
 * Einkaufsliste aus dem Wochenbedarf: Lagerware entfaellt, der Rest wird auf
 * Packungen oder Stueck gerundet und nach Kategorie gruppiert. Die Reihenfolge
 * innerhalb einer Gruppe folgt `shopping_items.json`.
 */
export function buildShoppingList(
  demand: ReadonlyMap<string, number>,
  items: readonly ShoppingItem[],
  foods: readonly Food[],
): ShoppingList {
  const foodsById = indexById(foods);
  const itemsById = new Map(items.map((i) => [i.foodId, i]));
  const missingItems = [...demand.keys()].filter((id) => !itemsById.has(id));

  const lines: ShoppingLine[] = [];
  for (const item of items) {
    const neededG = demand.get(item.foodId);
    const food = foodsById.get(item.foodId);
    if (neededG === undefined || !food || item.stock) continue;
    lines.push(buildLine(item, food, neededG));
  }

  const groups = CATEGORY_ORDER.map((category) => ({
    category,
    label: CATEGORY_LABELS[category],
    lines: lines.filter((l) => l.category === category),
  })).filter((g) => g.lines.length > 0);

  return { groups, missingItems };
}
