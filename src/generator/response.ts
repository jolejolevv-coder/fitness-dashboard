import { GENERATED_MEAL_PREFIX } from '../config/generator';
import type { Ingredient, Meal, PrepCover, PrepSession, PrepStep, Rotation, Slot, Weekday } from '../nutrition/types';
import { PREP_DEVICES, SLOTS, WEEKDAYS } from '../nutrition/types';

/** Ein Vorschlag des Modells, noch ungeprueft gegen Ziele. Nie mit `addToSlot`. */
export interface Proposal {
  meals: Meal[];
  rotation: Rotation;
  prep: PrepSession[];
  wishlist: string[];
}

export type ParseResult = { ok: true; proposal: Proposal } | { ok: false; issues: string[] };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const isText = (value: unknown): value is string => typeof value === 'string' && value !== '';
const isOneOf = <T extends string>(list: readonly T[], value: unknown): value is T => list.some((entry) => entry === value);

/** Sammelt Funde mit Pfad, damit die Meldung die Stelle nennt. */
class Issues {
  readonly list: string[] = [];
  add(path: string, message: string): void {
    this.list.push(`${path}: ${message}`);
  }
}

function readArray(value: unknown, path: string, issues: Issues): unknown[] {
  if (Array.isArray(value)) return value;
  issues.add(path, 'Liste erwartet');
  return [];
}

function readIngredient(value: unknown, path: string, foodIds: ReadonlySet<string>, issues: Issues): Ingredient | null {
  if (!isRecord(value)) {
    issues.add(path, 'Objekt erwartet');
    return null;
  }
  const foodId = value['foodId'];
  const grams = value['grams'];
  let valid = true;
  if (!isText(foodId) || !foodIds.has(foodId)) {
    issues.add(path, `unbekannte Zutat ${String(foodId)}`);
    valid = false;
  }
  if (typeof grams !== 'number' || !Number.isInteger(grams) || grams < 0) {
    issues.add(path, `Gramm ungueltig ${String(grams)}`);
    valid = false;
  }
  return valid ? { foodId: foodId as string, grams: grams as number } : null;
}

function readMeal(value: unknown, path: string, foodIds: ReadonlySet<string>, issues: Issues): Meal | null {
  if (!isRecord(value)) {
    issues.add(path, 'Objekt erwartet');
    return null;
  }
  const id = value['id'];
  const slot = value['slot'];
  const name = value['name'];
  const before = issues.list.length;
  if (!isText(id) || !id.startsWith(GENERATED_MEAL_PREFIX)) issues.add(path, `Gericht ID ohne Praefix ${GENERATED_MEAL_PREFIX}: ${String(id)}`);
  if (!isOneOf(SLOTS, slot)) issues.add(path, `unbekannter Slot ${String(slot)}`);
  if (!isText(name)) issues.add(path, 'Name fehlt');
  const ingredients: Ingredient[] = [];
  readArray(value['ingredients'], `${path} Zutaten`, issues).forEach((raw, index) => {
    const ing = readIngredient(raw, `${path} Zutat ${index + 1}`, foodIds, issues);
    if (ing) ingredients.push(ing);
  });
  if (issues.list.length > before) return null;
  return { id: id as string, slot: slot as Slot, name: name as string, ingredients };
}

function readRotation(value: unknown, issues: Issues): Rotation | null {
  if (!isRecord(value)) {
    issues.add('Rotation', 'Objekt erwartet');
    return null;
  }
  const before = issues.list.length;
  const rotation = {} as Rotation;
  for (const day of WEEKDAYS) {
    const perDay = value[day];
    if (!isRecord(perDay)) {
      issues.add(`Rotation ${day}`, 'Objekt erwartet');
      continue;
    }
    const entry = {} as Record<Slot, string>;
    for (const slot of SLOTS) {
      const mealId = perDay[slot];
      if (isText(mealId)) entry[slot] = mealId;
      else issues.add(`Rotation ${day} ${slot}`, 'Gericht ID fehlt');
    }
    rotation[day] = entry;
  }
  return issues.list.length > before ? null : rotation;
}

function readCover(value: unknown, path: string, foodIds: ReadonlySet<string>, issues: Issues): PrepCover | null {
  if (!isRecord(value)) {
    issues.add(path, 'Objekt erwartet');
    return null;
  }
  const before = issues.list.length;
  const slot = value['slot'];
  if (!isOneOf(SLOTS, slot)) issues.add(path, `unbekannter Slot ${String(slot)}`);

  const days: Weekday[] = [];
  for (const day of readArray(value['days'], `${path} Tage`, issues)) {
    if (isOneOf(WEEKDAYS, day)) days.push(day);
    else issues.add(path, `unbekannter Tag ${String(day)}`);
  }
  const meals: string[] = [];
  for (const mealId of readArray(value['meals'], `${path} Gerichte`, issues)) {
    if (isText(mealId)) meals.push(mealId);
    else issues.add(path, 'Gericht ID ungueltig');
  }
  const foods: string[] = [];
  for (const foodId of readArray(value['foods'], `${path} Zutaten`, issues)) {
    if (isText(foodId) && foodIds.has(foodId)) foods.push(foodId);
    else issues.add(path, `unbekannte Zutat ${String(foodId)}`);
  }
  if (issues.list.length > before) return null;
  const cover: PrepCover = { slot: slot as Slot, days, meals };
  if (foods.length > 0) cover.foods = foods;
  return cover;
}

function readStep(value: unknown, path: string, foodIds: ReadonlySet<string>, issues: Issues): PrepStep | null {
  if (!isRecord(value)) {
    issues.add(path, 'Objekt erwartet');
    return null;
  }
  const before = issues.list.length;
  const title = value['title'];
  const device = value['device'];
  if (!isText(title)) issues.add(path, 'Titel fehlt');
  if (!isOneOf(PREP_DEVICES, device)) issues.add(path, `unbekanntes Geraet ${String(device)}`);
  const covers: PrepCover[] = [];
  readArray(value['covers'], `${path} Abdeckung`, issues).forEach((raw, index) => {
    const cover = readCover(raw, `${path} Abdeckung ${index + 1}`, foodIds, issues);
    if (cover) covers.push(cover);
  });
  if (issues.list.length > before) return null;
  return { title: title as string, device: device as PrepStep['device'], covers };
}

function readSession(value: unknown, path: string, foodIds: ReadonlySet<string>, issues: Issues): PrepSession | null {
  if (!isRecord(value)) {
    issues.add(path, 'Objekt erwartet');
    return null;
  }
  const before = issues.list.length;
  const id = value['id'];
  const title = value['title'];
  if (!isText(id)) issues.add(path, 'ID fehlt');
  if (!isText(title)) issues.add(path, 'Titel fehlt');
  const steps: PrepStep[] = [];
  readArray(value['steps'], `${path} Schritte`, issues).forEach((raw, index) => {
    const step = readStep(raw, `${path} Schritt ${index + 1}`, foodIds, issues);
    if (step) steps.push(step);
  });
  if (issues.list.length > before) return null;
  return { id: id as string, title: title as string, steps };
}

function readList<T>(
  value: unknown,
  path: string,
  issues: Issues,
  read: (raw: unknown, itemPath: string) => T | null,
): T[] {
  const result: T[] = [];
  readArray(value, path, issues).forEach((raw, index) => {
    const item = read(raw, `${path} ${index + 1}`);
    if (item) result.push(item);
  });
  return result;
}

/**
 * Liest die Modellantwort. Dem Schema wird nicht vertraut: jede Stelle wird
 * einzeln geprueft, jeder Fund steht in `issues`.
 */
export function parseProposal(data: unknown, foodIds: ReadonlySet<string>): ParseResult {
  if (!isRecord(data)) return { ok: false, issues: ['Antwort: Objekt erwartet'] };
  const issues = new Issues();

  const meals = readList(data['meals'], 'Gericht', issues, (raw, path) => readMeal(raw, path, foodIds, issues));
  // Doppelte IDs wuerden beim Nachschlagen still das letzte Gericht nehmen.
  const seen = new Set<string>();
  for (const meal of meals) {
    if (seen.has(meal.id)) issues.add('Gericht', `doppelte ID ${meal.id}`);
    seen.add(meal.id);
  }
  const rotation = readRotation(data['rotation'], issues);
  const prep = readList(data['prep'], 'Prep', issues, (raw, path) => readSession(raw, path, foodIds, issues));
  const wishlist: string[] = [];
  for (const entry of readArray(data['wishlist'], 'Wunschliste', issues)) {
    if (isText(entry)) wishlist.push(entry);
    else issues.add('Wunschliste', 'Text erwartet');
  }

  if (issues.list.length > 0 || !rotation) return { ok: false, issues: issues.list };
  return { ok: true, proposal: { meals, rotation, prep, wishlist } };
}
