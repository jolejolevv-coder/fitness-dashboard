import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PlanData } from '../src/nutrition/plan';
import { OVERRIDES_KEY, PREP_DONE_KEY, SHOPPING_DONE_KEY } from '../src/nutrition/state';
import type { Food, Meal, Rotation, ShoppingItem, Slot } from '../src/nutrition/types';
import { SLOTS, WEEKDAYS } from '../src/nutrition/types';
import type { DayGoals } from '../src/parse/goals';
import { DAY_TOLERANCE, GENERATED_MEAL_PREFIX } from '../src/config/generator';
import { resolvePlanSource } from '../src/generator/source';
import { ACTIVE_PLAN_KEY, PLAN_STATE_KEYS, adoptActivePlan, resetToSeed, serializeActivePlan } from '../src/generator/state';
import type { ActivePlan } from '../src/generator/state';
import { getPlanSource, hasStoredPlan, onPlanSourceChange, returnToSeed } from '../src/ui/planSource';

// ── Synthetische Daten mit bekanntem Ergebnis ───────────────────────────────
// Food f: 1 kcal je g, 0,1 g Protein, 0,05 g Fett. Ein Tag mit 2300 g f ergibt
// 2300 kcal, 230 g Protein, 115 g Fett.

const DAY_KCAL = 2300;
const DAY_PROTEIN = 230;
const DAY_FAT = 115;
const SLOT_GRAMS: Record<Slot, number> = { M1: 500, M2: 600, M3: 700, M4: 500 };

const foodF: Food = { id: 'f', name: 'Fuel', kind: 'food', kcal: 100, protein: 10, carbs: 20, fat: 5, fiber: 1 };
const shopF: ShoppingItem = {
  foodId: 'f', category: 'dry', unit: 'g', packSizesG: [500], pantry: false, stock: false, match: { include: [], exclude: [] },
};

function meals(prefix: string): Meal[] {
  return SLOTS.map((slot) => ({ id: `${prefix}${slot}`, slot, name: `Gericht ${slot}`, ingredients: [{ foodId: 'f', grams: SLOT_GRAMS[slot] }] }));
}

function rotation(prefix: string): Rotation {
  return Object.fromEntries(WEEKDAYS.map((day) => [day, Object.fromEntries(SLOTS.map((slot) => [slot, `${prefix}${slot}`]))])) as Rotation;
}

const SEED: PlanData = { foods: [foodF], shoppingItems: [shopF], meals: meals('s'), rotation: rotation('s'), prep: [] };

const ACTIVE: ActivePlan = {
  meals: meals(GENERATED_MEAL_PREFIX),
  rotation: rotation(GENERATED_MEAL_PREFIX),
  prep: [],
  wishlist: [],
  createdAt: '2026-10-25T10:00:00Z',
  model: 'claude-opus-5-5',
};

const GOALS: DayGoals = {
  caloriesKcal: DAY_KCAL, proteinG: DAY_PROTEIN, fatG: DAY_FAT, carbsG: null, fiberG: null, proteinFeedings: null, steps: null,
};

describe('resolvePlanSource', () => {
  it('liefert ohne gespeicherten Plan den Seed ohne Fund', () => {
    const source = resolvePlanSource(null, SEED, GOALS, DAY_TOLERANCE);
    expect(source.kind).toBe('seed');
    expect(source.plan).toBe(SEED);
    expect(source.issues).toEqual([]);
  });

  it('liefert einen gueltigen Plan mit Lebensmitteln und Einkauf des Seeds', () => {
    const source = resolvePlanSource(serializeActivePlan(ACTIVE), SEED, GOALS, DAY_TOLERANCE);
    expect(source.kind).toBe('active');
    expect(source.issues).toEqual([]);
    expect(source.plan.meals.map((m) => m.id)).toEqual(['gM1', 'gM2', 'gM3', 'gM4']);
    expect(source.plan.rotation.Mo.M1).toBe('gM1');
    expect(source.plan.foods).toBe(SEED.foods);
    expect(source.plan.shoppingItems).toBe(SEED.shoppingItems);
    if (source.kind === 'active') expect(source.active.model).toBe('claude-opus-5-5');
  });

  it('nimmt den Seed, wenn der Plan unlesbar ist', () => {
    const source = resolvePlanSource('{kaputt', SEED, GOALS, DAY_TOLERANCE);
    expect(source.kind).toBe('seed');
    expect(source.issues).toEqual(['Gespeicherter Plan nicht geladen: unlesbar']);
  });

  it('nimmt den Seed, wenn der Plan eine unbekannte Zutat nennt', () => {
    const broken = { ...ACTIVE, meals: ACTIVE.meals.map((m) => ({ ...m, ingredients: [{ foodId: 'weg', grams: 1 }] })) };
    const source = resolvePlanSource(serializeActivePlan(broken), SEED, GOALS, DAY_TOLERANCE);
    expect(source.kind).toBe('seed');
    expect(source.issues).toEqual(['Gespeicherter Plan nicht geladen: unlesbar']);
  });

  it('nimmt den Seed, wenn ein Verweis ins Leere zeigt', () => {
    const broken = { ...ACTIVE, rotation: { ...ACTIVE.rotation, So: { ...ACTIVE.rotation.So, M4: 'gX' } } };
    const source = resolvePlanSource(serializeActivePlan(broken), SEED, GOALS, DAY_TOLERANCE);
    expect(source.kind).toBe('seed');
    expect(source.issues).toContain('Gespeicherter Plan nicht geladen: Rotation So M4: unbekanntes Gericht gX');
  });

  it('nimmt den Seed mit Zahlenzeile, wenn ein Tag das Ziel reisst', () => {
    const goals = { ...GOALS, proteinG: DAY_PROTEIN + 1 };
    const source = resolvePlanSource(serializeActivePlan(ACTIVE), SEED, goals, DAY_TOLERANCE);
    expect(source.kind).toBe('seed');
    expect(source.issues).toHaveLength(WEEKDAYS.length);
    expect(source.issues[0]).toBe(`Gespeicherter Plan nicht geladen: Mo Protein ${DAY_PROTEIN} Ziel ${DAY_PROTEIN + 1}`);
  });

  it('haelt den Plan am Rand des kcal Bands und verwirft ihn knapp darueber', () => {
    const atBand = { ...GOALS, caloriesKcal: DAY_KCAL - DAY_TOLERANCE.kcalBand };
    const overBand = { ...GOALS, caloriesKcal: DAY_KCAL - DAY_TOLERANCE.kcalBand - 1 };
    expect(resolvePlanSource(serializeActivePlan(ACTIVE), SEED, atBand, DAY_TOLERANCE).kind).toBe('active');
    expect(resolvePlanSource(serializeActivePlan(ACTIVE), SEED, overBand, DAY_TOLERANCE).kind).toBe('seed');
  });

  it('nimmt ohne Ziele den Seed und nennt die Datenlage', () => {
    const source = resolvePlanSource(serializeActivePlan(ACTIVE), SEED, null, DAY_TOLERANCE);
    expect(source.kind).toBe('seed');
    expect(source.issues).toEqual(['Gespeicherter Plan nicht geladen: Ziele 0 von 3']);
  });

  it('nimmt mit unvollstaendigen Zielen den Seed', () => {
    const source = resolvePlanSource(serializeActivePlan(ACTIVE), SEED, { ...GOALS, fatG: null }, DAY_TOLERANCE);
    expect(source.kind).toBe('seed');
    expect(source.issues).toEqual(['Gespeicherter Plan nicht geladen: Ziele 2 von 3']);
  });
});

// ── Speicher ────────────────────────────────────────────────────────────────

class MemoryStorage {
  private readonly data = new Map<string, string>();
  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.data.set(key, value);
  }
  removeItem(key: string): void {
    this.data.delete(key);
  }
}

describe('Uebernahme und Rueckkehr zum Seed', () => {
  let storage: MemoryStorage;

  beforeEach(() => {
    storage = new MemoryStorage();
    vi.stubGlobal('localStorage', storage);
    storage.setItem(OVERRIDES_KEY, '{"swaps":{"Mo":{"M1":"m1b"}},"bar":{}}');
    storage.setItem(PREP_DONE_KEY, '["so|0|f"]');
    storage.setItem(SHOPPING_DONE_KEY, '["f"]');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('leeren genau Overrides, Prep und Einkauf', () => {
    expect([...PLAN_STATE_KEYS].sort()).toEqual([OVERRIDES_KEY, PREP_DONE_KEY, SHOPPING_DONE_KEY].sort());
  });

  it('Uebernahme speichert den Plan und leert den Zustand', () => {
    adoptActivePlan(ACTIVE);
    expect(storage.getItem(ACTIVE_PLAN_KEY)).toBe(serializeActivePlan(ACTIVE));
    for (const key of PLAN_STATE_KEYS) expect(storage.getItem(key)).toBeNull();
  });

  it('Rueckkehr zum Seed loescht Plan und Zustand', () => {
    adoptActivePlan(ACTIVE);
    storage.setItem(SHOPPING_DONE_KEY, '["f"]');
    resetToSeed();
    expect(storage.getItem(ACTIVE_PLAN_KEY)).toBeNull();
    for (const key of PLAN_STATE_KEYS) expect(storage.getItem(key)).toBeNull();
  });

  it('meldet den Wechsel an die Reiter und stellt den Seed her', () => {
    storage.setItem(ACTIVE_PLAN_KEY, serializeActivePlan(ACTIVE));
    expect(hasStoredPlan()).toBe(true);
    const listener = vi.fn();
    onPlanSourceChange(listener);
    returnToSeed();
    expect(listener).toHaveBeenCalledOnce();
    expect(hasStoredPlan()).toBe(false);
    expect(getPlanSource(GOALS).kind).toBe('seed');
    expect(getPlanSource(GOALS).issues).toEqual([]);
  });

  it('ohne Speicher laeuft alles weiter', () => {
    vi.stubGlobal('localStorage', undefined);
    expect(() => resetToSeed()).not.toThrow();
    expect(hasStoredPlan()).toBe(false);
  });
});
