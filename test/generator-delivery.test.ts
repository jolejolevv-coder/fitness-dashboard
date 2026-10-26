import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DAY_TOLERANCE, PREP_DAYS } from '../src/config/generator';
import { CSP_CONNECT_HOSTS, CSP_DIRECTIVES, buildCsp, cspMetaTag } from '../src/config/csp';
import { PLAN, validatePlan } from '../src/nutrition/plan';
import type { PlanData } from '../src/nutrition/plan';
import type { Meal, PrepSession, Rotation } from '../src/nutrition/types';
import { PREP_DEVICES } from '../src/nutrition/types';
import type { DayGoals } from '../src/parse/goals';
import type { Offer } from '../scripts/prices/types';
import { EXPORT_FILE_NAMES, exportPlanFiles } from '../src/generator/export';
import { buildGeneratorInput, currentOffers, generateReadiness } from '../src/generator/input';
import { allowedFoodIds } from '../src/generator/schema';

const GOALS: DayGoals = {
  proteinG: 200, carbsG: 220, fatG: 70, fiberG: 35, caloriesKcal: 2320, proteinFeedings: null, steps: null,
};
const KEY = 'test-key';
const NONE: ReadonlySet<string> = new Set();
const TODAY = '2026-10-25';

function fileText(name: string): string {
  return readFileSync(new URL(`../data/${name}`, import.meta.url), 'utf8');
}

/** Seed ohne Riegel Option, so wie ein Vorschlag aussieht. */
const SEED_PROPOSAL = {
  meals: PLAN.meals.filter((meal) => !meal.addToSlot),
  rotation: PLAN.rotation,
  prep: PLAN.prep,
};

describe('exportPlanFiles', () => {
  const files = exportPlanFiles(SEED_PROPOSAL);
  const byName = new Map(files.map((file) => [file.name, file.content]));

  it('liefert drei Dateien mit den Namen der Seed Dateien', () => {
    expect(files.map((file) => file.name)).toEqual([EXPORT_FILE_NAMES.meals, EXPORT_FILE_NAMES.rotation, EXPORT_FILE_NAMES.prep]);
  });

  it('formatiert Rotation und Prep zeichengleich wie die Seed Dateien', () => {
    expect(byName.get(EXPORT_FILE_NAMES.rotation)).toBe(fileText('rotation.json'));
    expect(byName.get(EXPORT_FILE_NAMES.prep)).toBe(fileText('prep.json'));
  });

  it('formatiert Gerichte wie die Seed Datei', () => {
    const seedMeals = (JSON.parse(fileText('meals.json')) as Meal[]).filter((meal) => !meal.addToSlot);
    expect(byName.get(EXPORT_FILE_NAMES.meals)).toBe(`${JSON.stringify(seedMeals, null, 2)}\n`);
  });

  it('besteht eingelesen validatePlan als Seed Daten', () => {
    const plan: PlanData = {
      foods: PLAN.foods,
      shoppingItems: PLAN.shoppingItems,
      meals: JSON.parse(byName.get(EXPORT_FILE_NAMES.meals) ?? '') as Meal[],
      rotation: JSON.parse(byName.get(EXPORT_FILE_NAMES.rotation) ?? '') as Rotation,
      prep: JSON.parse(byName.get(EXPORT_FILE_NAMES.prep) ?? '') as PrepSession[],
    };
    expect(validatePlan(plan)).toEqual([]);
  });

  it('ordnet Tage und Slots fest, egal in welcher Reihenfolge die Antwort sie liefert', () => {
    const reversed = Object.fromEntries(Object.entries(PLAN.rotation).reverse()) as Rotation;
    const [, rotation] = exportPlanFiles({ ...SEED_PROPOSAL, rotation: reversed });
    expect(rotation?.content).toBe(fileText('rotation.json'));
  });

  it('laesst addToSlot weg', () => {
    const [meals] = exportPlanFiles({ ...SEED_PROPOSAL, meals: PLAN.meals });
    expect(meals?.content).not.toContain('addToSlot');
  });
});

describe('CSP', () => {
  const policy = buildCsp();
  const directive = (name: string): string[] =>
    policy.split('; ').find((part) => part.startsWith(`${name} `))?.split(' ').slice(1) ?? [];

  it('erlaubt Verbindungen nur zu self, Sheets und Anthropic', () => {
    expect(directive('connect-src')).toEqual(["'self'", 'https://sheets.googleapis.com', 'https://api.anthropic.com']);
    expect(CSP_CONNECT_HOSTS).toHaveLength(2);
  });

  it('laedt Skripte nur von self, ohne unsafe-inline und unsafe-eval', () => {
    expect(directive('script-src')).toEqual(["'self'"]);
    expect(policy).not.toContain('unsafe-eval');
  });

  it('erlaubt Inline Styles', () => {
    expect(directive('style-src')).toEqual(["'self'", "'unsafe-inline'"]);
  });

  it('setzt default-src und object-src', () => {
    expect(directive('default-src')).toEqual(["'self'"]);
    expect(directive('object-src')).toEqual(["'none'"]);
  });

  it('erlaubt Service Worker und Manifest nur von self', () => {
    expect(directive('worker-src')).toEqual(["'self'"]);
    expect(directive('manifest-src')).toEqual(["'self'"]);
  });

  it('hat genau die Direktiven vor Phase 12 plus worker-src und manifest-src', () => {
    expect(Object.keys(CSP_DIRECTIVES)).toEqual([
      'default-src', 'script-src', 'style-src', 'img-src', 'font-src', 'connect-src',
      'object-src', 'base-uri', 'form-action', 'worker-src', 'manifest-src',
    ]);
    expect(directive('img-src')).toEqual(["'self'", 'data:', 'blob:']);
    expect(directive('font-src')).toEqual(["'self'"]);
    expect(directive('base-uri')).toEqual(["'self'"]);
    expect(directive('form-action')).toEqual(["'none'"]);
  });

  it('steht als meta Element mit dem ganzen Policy Text', () => {
    expect(cspMetaTag()).toBe(`<meta http-equiv="Content-Security-Policy" content="${policy}">`);
    expect(policy).not.toContain('"');
  });
});

describe('generateReadiness', () => {
  it('ist frei mit Key und allen drei Zielen', () => {
    expect(generateReadiness(KEY, GOALS, PLAN, NONE)).toEqual({ enabled: true, reasons: [] });
  });

  it('nennt den fehlenden Key als Zahlenzeile', () => {
    expect(generateReadiness(null, GOALS, PLAN, NONE)).toEqual({ enabled: false, reasons: ['API Key 0 von 1'] });
  });

  it('nennt fehlende Ziele als Zahlenzeile', () => {
    expect(generateReadiness(KEY, { ...GOALS, fatG: null }, PLAN, NONE)).toEqual({ enabled: false, reasons: ['Ziele 2 von 3'] });
    expect(generateReadiness(KEY, null, PLAN, NONE).reasons).toEqual(['Ziele 0 von 3']);
  });

  it('zaehlt KH und Ballaststoffe nicht als Pflicht', () => {
    expect(generateReadiness(KEY, { ...GOALS, carbsG: null, fiberG: null }, PLAN, NONE).enabled).toBe(true);
  });

  it('nennt alle Gruende zugleich', () => {
    expect(generateReadiness(null, null, PLAN, NONE).reasons).toEqual(['API Key 0 von 1', 'Ziele 0 von 3']);
  });

  it('sperrt, wenn alles ausgeschlossen ist', () => {
    const all = new Set(allowedFoodIds(PLAN, NONE));
    expect(generateReadiness(KEY, GOALS, PLAN, all).reasons).toEqual([`Lebensmittel 0 von ${all.size}`]);
  });
});

function offer(foodId: string, pricePerKg: number | null, validTo: string, store = 'Lidl'): Offer {
  return {
    food_id: foodId, store, product: foodId, size_g: 500, price_eur: 1, regular_price_eur: null,
    price_per_kg: pricePerKg, valid_days: null, valid_from: '2026-10-20', valid_to: validTo, condition: null,
  } as Offer;
}

describe('buildGeneratorInput', () => {
  const sources = { plan: PLAN, goals: GOALS, exclusions: NONE, wish: '', offers: null, today: TODAY, tolerance: DAY_TOLERANCE };

  it('ist null ohne vollstaendige Ziele', () => {
    expect(buildGeneratorInput({ ...sources, goals: null })).toBeNull();
    expect(buildGeneratorInput({ ...sources, goals: { ...GOALS, proteinG: null } })).toBeNull();
  });

  it('uebergibt nur Ziele, keine weiteren Sheet Werte', () => {
    expect(buildGeneratorInput(sources)?.goals).toEqual({ caloriesKcal: 2320, proteinG: 200, fatG: 70, carbsG: 220, fiberG: 35 });
  });

  it('laesst Ausschluesse bei Lebensmitteln und Einkauf weg', () => {
    const excluded = allowedFoodIds(PLAN, NONE)[0] ?? '';
    const input = buildGeneratorInput({ ...sources, exclusions: new Set([excluded]) });
    expect(input?.foods.map((food) => food.id)).not.toContain(excluded);
    expect(input?.shoppingItems.map((item) => item.foodId)).not.toContain(excluded);
    expect(input?.foods).toHaveLength(allowedFoodIds(PLAN, NONE).length - 1);
  });

  it('setzt Geraete, Prep Tage, Toleranz und Wunsch', () => {
    const input = buildGeneratorInput({ ...sources, wish: 'mehr Fisch' });
    expect(input?.devices).toEqual(PREP_DEVICES);
    expect(input?.prepDays).toEqual(PREP_DAYS);
    expect(input?.tolerance).toBe(DAY_TOLERANCE);
    expect(input?.wish).toBe('mehr Fisch');
  });

  it('nimmt das guenstigste gueltige Angebot mit Grundpreis', () => {
    const offers = [offer('oats', 3, '2026-10-30'), offer('oats', 2, '2026-10-30', 'Aldi'), offer('oats', 1, '2026-10-24'), offer('rice', null, '2026-10-30')];
    expect(currentOffers(offers, ['oats', 'rice'], TODAY)).toEqual([{ foodId: 'oats', pricePerKg: 2, store: 'Aldi' }]);
  });
});
