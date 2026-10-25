import { describe, it, expect } from 'vitest';
import { PLAN, validatePlan } from '../src/nutrition/plan';
import type { PlanData } from '../src/nutrition/plan';
import type { Food, Meal, PrepSession, Rotation, ShoppingItem } from '../src/nutrition/types';
import { SLOTS, WEEKDAYS } from '../src/nutrition/types';
import type { DayGoals } from '../src/parse/goals';
import { DAY_TOLERANCE, GENERATED_MEAL_PREFIX, PREP_DAYS, TOKEN_PRICES } from '../src/config/generator';
import { allowedFoodIds, buildPlanSchema } from '../src/generator/schema';
import { buildPrompt } from '../src/generator/prompt';
import type { GeneratorInput } from '../src/generator/prompt';
import { parseProposal } from '../src/generator/response';
import type { Proposal } from '../src/generator/response';
import { checkProposal, goalsReadiness } from '../src/generator/check';
import { runCost } from '../src/generator/cost';
import { parseActivePlan, parseApiKey, parseExclusions, serializeActivePlan, serializeExclusions } from '../src/generator/state';

// ── Synthetische Daten mit bekanntem Ergebnis ───────────────────────────────
// Food f: 1 kcal je g, 0,1 g Protein, 0,05 g Fett. Eine Tagessumme von 2300 g f
// ergibt 2300 kcal, 230 g Protein, 115 g Fett.

const SYN_KCAL = 2300;
const SYN_PROTEIN = 230;
const SYN_FAT = 115;
const SLOT_GRAMS = [500, 600, 700, 500] as const;
const KCAL_OVER_BAND = DAY_TOLERANCE.kcalBand + 1;
const FAT_AT_BAND_G_PER_100 = 7;
const FAT_OVER_BAND_G_PER_100 = 7.2;
const SWAP_GRAMS = SLOT_GRAMS[0];

const foodF: Food = { id: 'f', name: 'Fuel', kind: 'food', kcal: 100, protein: 10, carbs: 20, fat: 5, fiber: 1 };
const foodH: Food = { ...foodF, id: 'h', name: 'Fatty', fat: FAT_AT_BAND_G_PER_100 };
const foodH2: Food = { ...foodF, id: 'h2', name: 'Fattier', fat: FAT_OVER_BAND_G_PER_100 };
const foodX: Food = { ...foodF, id: 'x', name: 'Excluded' };
const spice: Food = { id: 'salt', name: 'Salz', kind: 'spice' };
const noShop: Food = { ...foodF, id: 'noshop', name: 'Ohne Einkauf' };

const shop = (foodId: string): ShoppingItem => ({
  foodId, category: 'dry', unit: 'g', packSizesG: [500, 1000], pantry: false, stock: false, match: { include: [], exclude: [] },
});

const meal = (id: string, slot: Meal['slot'], foodId: string, grams: number): Meal => ({
  id, slot, name: `Gericht ${id}`, ingredients: [{ foodId, grams }],
});

const BASE_MEALS: Meal[] = SLOTS.map((slot, i) => meal(`g${i + 1}`, slot, 'f', SLOT_GRAMS[i]!));

function rotationOf(overrides: Partial<Record<(typeof WEEKDAYS)[number], Partial<Record<(typeof SLOTS)[number], string>>>> = {}): Rotation {
  const result = {} as Rotation;
  for (const day of WEEKDAYS) {
    result[day] = { M1: 'g1', M2: 'g2', M3: 'g3', M4: 'g4', ...overrides[day] };
  }
  return result;
}

const SYN_PREP: PrepSession[] = [
  {
    id: 'sunday', title: 'Sonntag',
    steps: [{ title: 'Kochen', device: 'Mikrowelle', covers: [{ slot: 'M1', days: ['Mo', 'Di'], meals: ['g1'], foods: ['f'] }] }],
  },
];

const base: PlanData = {
  foods: [foodF, foodH, foodH2, foodX, spice, noShop],
  meals: [],
  rotation: rotationOf(),
  shoppingItems: [shop('f'), shop('h'), shop('h2'), shop('x'), shop('salt')],
  prep: [],
};

const baseProposal = (): Proposal => ({ meals: [...BASE_MEALS], rotation: rotationOf(), prep: structuredClone(SYN_PREP), wishlist: [] });

const goals = (over: Partial<DayGoals> = {}): DayGoals => ({
  proteinG: SYN_PROTEIN, carbsG: null, fatG: SYN_FAT, fiberG: null, caloriesKcal: SYN_KCAL, proteinFeedings: null, steps: null, ...over,
});

const NO_EXCLUSIONS: ReadonlySet<string> = new Set();
const run = (p: Proposal, g: DayGoals = goals(), ex: ReadonlySet<string> = NO_EXCLUSIONS) =>
  checkProposal(p, base, g, ex, DAY_TOLERANCE);

describe('checkProposal', () => {
  it('besteht, wenn jeder Tag genau auf dem Ziel liegt', () => {
    const result = run(baseProposal());
    expect(result.issues).toEqual([]);
    expect(result.passed).toBe(true);
    expect(result.days).toHaveLength(WEEKDAYS.length);
    expect(result.days[0]).toMatchObject({ day: 'Mo', kcal: SYN_KCAL, protein: SYN_PROTEIN, fat: SYN_FAT });
  });

  it('besteht knapp drin: kcal an der Bandgrenze', () => {
    const p = baseProposal();
    p.meals.push(meal('g1x', 'M1', 'f', SWAP_GRAMS + DAY_TOLERANCE.kcalBand));
    p.rotation = rotationOf({ Di: { M1: 'g1x' } });
    expect(run(p).passed).toBe(true);
  });

  it('reisst bei kcal Band plus 1 und nennt die Zahlenzeile', () => {
    const p = baseProposal();
    p.meals.push(meal('g1x', 'M1', 'f', SWAP_GRAMS + KCAL_OVER_BAND));
    p.rotation = rotationOf({ Di: { M1: 'g1x' } });
    const result = run(p);
    expect(result.passed).toBe(false);
    expect(result.issues).toContain(`Di kcal ${SYN_KCAL + KCAL_OVER_BAND} Ziel ${SYN_KCAL} ±${DAY_TOLERANCE.kcalBand}`);
  });

  it('reisst bei Proteinziel plus 1', () => {
    const result = run(baseProposal(), goals({ proteinG: SYN_PROTEIN + 1 }));
    expect(result.passed).toBe(false);
    expect(result.issues[0]).toBe(`Mo Protein ${SYN_PROTEIN} Ziel ${SYN_PROTEIN + 1}`);
  });

  it('besteht bei Fett an der Bandgrenze und reisst bei Band plus 1', () => {
    const atBand = baseProposal();
    atBand.meals.push(meal('g1h', 'M1', 'h', SWAP_GRAMS));
    atBand.rotation = rotationOf({ Mo: { M1: 'g1h' } });
    expect(run(atBand).passed).toBe(true);

    const over = baseProposal();
    over.meals.push(meal('g1h', 'M1', 'h2', SWAP_GRAMS));
    over.rotation = rotationOf({ Mo: { M1: 'g1h' } });
    const result = run(over);
    expect(result.passed).toBe(false);
    expect(result.issues).toContain(`Mo Fett ${SYN_FAT + DAY_TOLERANCE.fatBandG + 1} Ziel ${SYN_FAT} ±${DAY_TOLERANCE.fatBandG}`);
  });

  it('erkennt ausgeschlossene Zutaten', () => {
    const p = baseProposal();
    p.meals.push(meal('g1b', 'M1', 'x', SWAP_GRAMS));
    const result = run(p, goals(), new Set(['x']));
    expect(result.passed).toBe(false);
    expect(result.issues).toContain('Ausschluss x in g1b');
  });

  it('meldet unvollstaendige Ziele als Zahlenzeile ohne zu werfen', () => {
    const result = run(baseProposal(), goals({ fatG: null }));
    expect(result).toEqual({ passed: false, issues: ['Ziele 2 von 3'], days: [] });
  });

  it('meldet Rotation auf unbekanntes Gericht', () => {
    const result = run({ ...baseProposal(), rotation: rotationOf({ Mo: { M1: 'g9' } }) });
    expect(result.passed).toBe(false);
    expect(result.issues.some((i) => i.includes('g9'))).toBe(true);
  });

  it('meldet Zutat ohne Einkaufseintrag', () => {
    const p = baseProposal();
    p.meals.push(meal('g1n', 'M1', 'noshop', SWAP_GRAMS));
    expect(run(p).issues).toContain('Einkauf: kein Eintrag fuer noshop');
  });
});

describe('goalsReadiness', () => {
  it('zaehlt kcal, Protein und Fett', () => {
    expect(goalsReadiness(null)).toEqual({ available: 0, required: 3 });
    expect(goalsReadiness(goals({ proteinG: null, fatG: null }))).toEqual({ available: 1, required: 3 });
    expect(goalsReadiness(goals())).toEqual({ available: 3, required: 3 });
  });
});

describe('validatePlan Prep', () => {
  const withPrep = (prep: PrepSession[]) => ({ ...base, meals: BASE_MEALS, prep });
  const cover = (over: Record<string, unknown>) => [
    { id: 's', title: 'S', steps: [{ title: 'T', device: 'Airfryer' as const, covers: [{ slot: 'M1' as const, days: ['Mo' as const], meals: ['g1'], ...over }] }] },
  ];

  it('akzeptiert stimmige Prep', () => {
    expect(validatePlan(withPrep(SYN_PREP))).toEqual([]);
  });

  it('meldet ein unbekanntes Gericht', () => {
    const issues = validatePlan(withPrep(cover({ meals: ['g99'] })));
    expect(issues).toEqual(['Prep s T: unbekanntes Gericht g99']);
  });

  it('meldet einen falschen Slot', () => {
    const issues = validatePlan(withPrep(cover({ slot: 'M2' })));
    expect(issues).toEqual(['Prep s T: Gericht g1 ist M1, nicht M2']);
  });

  it('meldet einen unbekannten Tag und eine fremde Zutat', () => {
    expect(validatePlan(withPrep(cover({ days: ['Xx'] })))).toEqual(['Prep s T: unbekannter Tag Xx']);
    expect(validatePlan(withPrep(cover({ foods: ['h'] })))).toEqual(['Prep s T: Zutat h steckt in keinem der Gerichte']);
  });

  it('lassen die Seed Prep unveraendert bestehen', () => {
    expect(validatePlan(PLAN)).toEqual([]);
  });
});

// ── Schema ───────────────────────────────────────────────────────────────────

type Json = Record<string, unknown>;

function collectObjects(node: unknown, found: Json[] = []): Json[] {
  if (Array.isArray(node)) node.forEach((n) => collectObjects(n, found));
  else if (typeof node === 'object' && node !== null) {
    const rec = node as Json;
    if (rec['type'] === 'object') found.push(rec);
    Object.values(rec).forEach((n) => collectObjects(n, found));
  }
  return found;
}

describe('Schema', () => {
  it('erlaubt nur Lebensmittel mit Einkaufseintrag ohne Ausschluesse, sortiert', () => {
    expect(allowedFoodIds(base, new Set(['x']))).toEqual(['f', 'h', 'h2', 'salt']);
    expect(allowedFoodIds(base, NO_EXCLUSIONS)).not.toContain('noshop');
  });

  it('traegt die Ausschluesse nicht im enum und sperrt jedes Objekt', () => {
    const ids = allowedFoodIds(base, new Set(['x']));
    const schema = buildPlanSchema(ids);
    const text = JSON.stringify(schema);
    expect(text).not.toContain('"x"');
    expect(text).toContain('"h2"');
    const objects = collectObjects(schema);
    expect(objects.length).toBeGreaterThan(0);
    for (const obj of objects) {
      expect(obj['additionalProperties']).toBe(false);
      expect([...(obj['required'] as string[])].sort()).toEqual(Object.keys(obj['properties'] as Json).sort());
    }
    expect(text).not.toMatch(/minimum|maximum|pattern|minItems/);
  });
});

// ── Antwort lesen ────────────────────────────────────────────────────────────

const FOOD_IDS: ReadonlySet<string> = new Set(['f', 'h', 'salt']);

function rawResponse(): Record<string, unknown> {
  return JSON.parse(JSON.stringify({ ...baseProposal(), wishlist: ['Quark'] })) as Record<string, unknown>;
}

describe('parseProposal', () => {
  it('liest eine gueltige Antwort', () => {
    const result = parseProposal(rawResponse(), FOOD_IDS);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.proposal.meals).toHaveLength(BASE_MEALS.length);
      expect(result.proposal.wishlist).toEqual(['Quark']);
    }
  });

  it('macht leere foods zu fehlendem Feld', () => {
    const raw = rawResponse() as { prep: { steps: { covers: { foods?: string[] }[] }[] }[] };
    raw.prep[0]!.steps[0]!.covers[0]!.foods = [];
    const result = parseProposal(raw, FOOD_IDS);
    expect(result.ok).toBe(true);
    if (result.ok) expect('foods' in result.proposal.prep[0]!.steps[0]!.covers[0]!).toBe(false);
  });

  const mutate = (fn: (raw: { meals: Record<string, unknown>[] }) => void) => {
    const raw = rawResponse() as { meals: Record<string, unknown>[] };
    fn(raw);
    return parseProposal(raw, FOOD_IDS);
  };

  it('weist einen falschen Slot ab', () => {
    expect(mutate((r) => { r.meals[0]!['slot'] = 'M9'; }).ok).toBe(false);
  });

  it('weist eine unbekannte Zutat ab', () => {
    const result = mutate((r) => { r.meals[0]!['ingredients'] = [{ foodId: 'zzz', grams: 10 }]; });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues.join()).toContain('zzz');
  });

  it('weist eine ID ohne Praefix ab', () => {
    const result = mutate((r) => { r.meals[0]!['id'] = `m${GENERATED_MEAL_PREFIX}1`; });
    expect(result.ok).toBe(false);
  });

  it('weist doppelte Gericht IDs ab', () => {
    const result = mutate((r) => { r.meals[1]!['id'] = r.meals[0]!['id']; });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues.join()).toContain('doppelte ID');
  });

  it('weist negative und gebrochene Gramm ab', () => {
    expect(mutate((r) => { r.meals[0]!['ingredients'] = [{ foodId: 'f', grams: -1 }]; }).ok).toBe(false);
    expect(mutate((r) => { r.meals[0]!['ingredients'] = [{ foodId: 'f', grams: 1.5 }]; }).ok).toBe(false);
  });

  it('weist falsches Geraet, falschen Tag und fehlende Rotation ab', () => {
    const raw = rawResponse() as { prep: { steps: { device: string; covers: { days: string[] }[] }[] }[]; rotation: Record<string, unknown> };
    raw.prep[0]!.steps[0]!.device = 'Herd';
    raw.prep[0]!.steps[0]!.covers[0]!.days = ['Xx'];
    delete raw.rotation['So'];
    const result = parseProposal(raw, FOOD_IDS);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues.length).toBeGreaterThanOrEqual(3);
  });

  it('weist Nicht Objekte ab, ohne zu werfen', () => {
    expect(parseProposal(null, FOOD_IDS).ok).toBe(false);
    expect(parseProposal([], FOOD_IDS).ok).toBe(false);
  });

  it('liest den umbenannten Seed Plan', () => {
    const rename = (id: string) => `${GENERATED_MEAL_PREFIX}${id}`;
    const seed = {
      meals: PLAN.meals.map((m) => ({ id: rename(m.id), slot: m.slot, name: m.name, ingredients: m.ingredients })),
      rotation: Object.fromEntries(WEEKDAYS.map((d) => [d, Object.fromEntries(SLOTS.map((s) => [s, rename(PLAN.rotation[d][s])]))])),
      prep: PLAN.prep.map((s) => ({
        ...s,
        steps: s.steps.map((st) => ({ ...st, covers: st.covers.map((c) => ({ ...c, meals: c.meals.map(rename) })) })),
      })),
      wishlist: [],
    };
    const result = parseProposal(seed, new Set(PLAN.foods.map((f) => f.id)));
    expect(result.ok).toBe(true);
    if (result.ok) {
      const plan: PlanData = { ...PLAN, ...result.proposal };
      expect(validatePlan(plan)).toEqual([]);
    }
  });
});

// ── Prompt ───────────────────────────────────────────────────────────────────

const PROMPT_GOAL_KCAL = 2412;
const PROMPT_GOAL_PROTEIN = 187;
const PROMPT_GOAL_FAT = 63;

function promptInput(foods: Food[] = [foodH, foodF, spice]): GeneratorInput {
  return {
    goals: { caloriesKcal: PROMPT_GOAL_KCAL, proteinG: PROMPT_GOAL_PROTEIN, fatG: PROMPT_GOAL_FAT, carbsG: null, fiberG: 41 },
    foods,
    shoppingItems: [shop('f'), shop('h')],
    offers: [{ foodId: 'f', pricePerKg: 3.49, store: 'Aldi' }],
    devices: ['Airfryer', 'Mikrowelle'],
    prepDays: PREP_DAYS,
    tolerance: DAY_TOLERANCE,
    wish: '  mehr Reis  ',
  };
}

describe('buildPrompt', () => {
  it('ist deterministisch und unabhaengig von der Eingabereihenfolge', () => {
    const a = buildPrompt(promptInput([foodH, foodF, spice]));
    const b = buildPrompt(promptInput([spice, foodF, foodH]));
    expect(a).toEqual(b);
  });

  it('enthaelt Ziele, Toleranzen, Praefix, Angebot und Wunsch aus der Eingabe', () => {
    const { user, system } = buildPrompt(promptInput());
    for (const needle of [
      String(PROMPT_GOAL_KCAL), String(PROMPT_GOAL_PROTEIN), String(PROMPT_GOAL_FAT), '41',
      `plus or minus ${DAY_TOLERANCE.kcalBand}`, `"${GENERATED_MEAL_PREFIX}"`, '3.49 EUR/kg at Aldi', 'packs g: 500, 1000', 'mehr Reis',
    ]) {
      expect(user).toContain(needle);
    }
    expect(user).not.toContain('carbs:');
    expect(system.length).toBeGreaterThan(0);
  });

  it('macht Wuensche verbindlich und laesst ausgeschlossene Lebensmittel ganz weg', () => {
    const { user } = buildPrompt({ ...promptInput(), wish: 'vegetarisch' });
    expect(user).toContain('Wishes (binding): vegetarisch');
    expect(user).toContain('binding requirements, not suggestions');
    expect(user).toContain('never use those foods anywhere');
  });

  it('nennt nur uebergebene Lebensmittel', () => {
    const { user } = buildPrompt(promptInput());
    expect(user).not.toContain('x | Excluded');
  });
});

// ── Kosten ───────────────────────────────────────────────────────────────────

describe('runCost', () => {
  it('rechnet Opus aus allen vier Tokenarten', () => {
    const cost = runCost(
      { input_tokens: 12_000, output_tokens: 10_000, cache_read_input_tokens: 5_000, cache_creation_input_tokens: 1_000 },
      'claude-opus-5-5',
      TOKEN_PRICES,
    );
    // 12000*4 + 10000*20 + 5000*0.2 + 1000*5 = 254000 je Million
    expect(cost.usd).toBeCloseTo(0.254, 10);
    expect(cost).toMatchObject({ inputTokens: 12_000, outputTokens: 10_000, cacheReadTokens: 5_000, cacheWriteTokens: 1_000 });
  });

  it('zaehlt fehlende und null Cache Felder als 0', () => {
    const cost = runCost({ input_tokens: 1_000_000, output_tokens: 0, cache_read_input_tokens: null }, 'claude-opus-5-5', TOKEN_PRICES);
    expect(cost.usd).toBe(4);
    expect(cost.cacheReadTokens).toBe(0);
    expect(cost.cacheWriteTokens).toBe(0);
  });

  it('liefert bei unbekanntem Modell keinen Betrag', () => {
    const cost = runCost({ input_tokens: 10, output_tokens: 10 }, 'claude-unknown', TOKEN_PRICES);
    expect(cost.usd).toBeNull();
    expect(cost.inputTokens).toBe(10);
  });
});

// ── Zustand ──────────────────────────────────────────────────────────────────

describe('Zustand', () => {
  it('Ausschluesse laufen als sortierte Liste hin und zurueck', () => {
    const raw = serializeExclusions(new Set(['b', 'a']));
    expect(raw).toBe('["a","b"]');
    expect([...parseExclusions(raw)]).toEqual(['a', 'b']);
  });

  it('Ausschluesse verwerfen Muell', () => {
    expect(parseExclusions(null).size).toBe(0);
    expect(parseExclusions('{kaputt').size).toBe(0);
    expect(parseExclusions('{"a":1}').size).toBe(0);
    expect([...parseExclusions('["a",1,"",null]')]).toEqual(['a']);
  });

  it('API Key wird getrimmt, leer ist null', () => {
    expect(parseApiKey('  sk-test  ')).toBe('sk-test');
    expect(parseApiKey('   ')).toBeNull();
    expect(parseApiKey(null)).toBeNull();
  });

  it('aktiver Plan laeuft hin und zurueck', () => {
    const plan = { ...baseProposal(), createdAt: '2026-10-25T10:00:00Z', model: 'claude-opus-5-5' };
    const back = parseActivePlan(serializeActivePlan(plan), FOOD_IDS);
    expect(back).toEqual(plan);
  });

  it('aktiver Plan verwirft Unbrauchbares', () => {
    const plan = { ...baseProposal(), createdAt: '2026-10-25T10:00:00Z', model: 'm' };
    const raw = serializeActivePlan(plan);
    expect(parseActivePlan(null, FOOD_IDS)).toBeNull();
    expect(parseActivePlan('kaputt', FOOD_IDS)).toBeNull();
    expect(parseActivePlan('[]', FOOD_IDS)).toBeNull();
    expect(parseActivePlan(serializeActivePlan({ ...plan, createdAt: '' }), FOOD_IDS)).toBeNull();
    expect(parseActivePlan(raw, new Set(['salt']))).toBeNull();
  });
});
