import { describe, it, expect } from 'vitest';
import { FOODS, MEALS, PLAN, PREP_SESSIONS, ROTATION, SHOPPING_ITEMS, indexById, validatePlan } from '../src/nutrition/plan';
import { addOnMacros, mealMacros, mealMacrosWithAddOn } from '../src/nutrition/macros';
import { NO_OVERRIDES, effectivePlan } from '../src/nutrition/rotation';
import type { Overrides } from '../src/nutrition/rotation';
import { compareToGoals, dayMacros, weekMacros } from '../src/nutrition/totals';
import { buildShoppingList, roundToPacks, weeklyDemand } from '../src/nutrition/shopping';
import { buildPrep } from '../src/nutrition/prep';
import type { DayGoals } from '../src/parse/goals';
import type { Macros, Meal, Weekday } from '../src/nutrition/types';
import { WEEKDAYS } from '../src/nutrition/types';

const KCAL_TOLERANCE = 2;
const GRAM_TOLERANCE = 1;

/** Zielwerte nur als Testerwartung, im Rechencode steht keiner. */
const EXPECTED_DAY_KCAL = 2300;
const DAY_KCAL_BAND = 40;
const EXPECTED_MIN_PROTEIN = 200;

const meal = (id: string): Meal => MEALS.find((m) => m.id === id)!;

function expectMacros(actual: Macros, kcal: number, p: number, c: number, f: number) {
  expect(Math.abs(actual.kcal - kcal)).toBeLessThanOrEqual(KCAL_TOLERANCE);
  expect(Math.abs(actual.protein - p)).toBeLessThanOrEqual(GRAM_TOLERANCE);
  expect(Math.abs(actual.carbs - c)).toBeLessThanOrEqual(GRAM_TOLERANCE);
  expect(Math.abs(actual.fat - f)).toBeLessThanOrEqual(GRAM_TOLERANCE);
}

const standard = effectivePlan(ROTATION, NO_OVERRIDES, MEALS);

describe('Plandaten', () => {
  it('sind in sich stimmig', () => {
    expect(validatePlan(PLAN)).toEqual([]);
  });

  it('halten Gewuerze ohne Naehrwerte und Soßen mit Naehrwerten', () => {
    const spice = FOODS.filter((f) => f.kind === 'spice');
    expect(spice).toHaveLength(17);
    expect(spice.every((f) => f.kcal === undefined)).toBe(true);
    expect(FOODS.filter((f) => f.kind === 'sauce').map((f) => f.id).sort()).toEqual(['mustard', 'soy_sauce', 'sriracha']);
  });

  it('melden eine unbekannte Zutat', () => {
    const broken = { ...PLAN, meals: [{ ...meal('m1a'), ingredients: [{ foodId: 'nope', grams: 1 }] }, ...MEALS.slice(1)] };
    expect(validatePlan(broken).some((i) => i.includes('nope'))).toBe(true);
  });
});

describe('Makros je Gericht', () => {
  // Handoff Abschnitt 4. Soßen sind dort nicht enthalten und werden aufgeschlagen
  // (m1c Senf 5 g, m2a Sojasauce 15 g, m3a Sriracha 5 g, m3b Senf 10 g).
  const SAUCE_ADD = {
    m1c: { kcal: 4.5, p: 0.3, c: 0.2, f: 0.25 },
    m2a: { kcal: 9, p: 1.2, c: 0.9, f: 0 },
    m3a: { kcal: 5, p: 0.1, c: 0.95, f: 0.05 },
    m3b: { kcal: 9, p: 0.6, c: 0.4, f: 0.5 },
  } as const;
  const HANDOFF: [string, number, number, number, number][] = [
    ['m1b', 571, 51, 38, 21],
    ['m1c', 571, 47, 50, 19],
    ['m2a', 695, 64, 69, 17],
    ['m2b', 710, 65, 67, 17],
    ['m3a', 452, 49, 34, 12],
    ['m3b', 445, 40, 41, 12],
    ['m4a', 597, 50, 49, 21],
    ['m4b', 595, 51, 54, 18],
  ];

  it.each(HANDOFF)('%s stimmt mit dem Handoff ueberein', (id, kcal, p, c, f) => {
    const add = SAUCE_ADD[id as keyof typeof SAUCE_ADD] ?? { kcal: 0, p: 0, c: 0, f: 0 };
    expectMacros(mealMacros(meal(id), FOODS), kcal + add.kcal, p + add.p, c + add.c, f + add.f);
  });

  it('m1a mit Wasser, 80 g Hafer und 35 g Whey, ist neu gerechnet', () => {
    // 297,6 + 133 + 45 + 93,75 kcal
    expectMacros(mealMacros(meal('m1a'), FOODS), 569.4, 41.8, 57.6, 15.7);
  });

  it('m3r samt Zuschlag ergibt 419 kcal und 38,6 g Protein', () => {
    const total = mealMacrosWithAddOn(meal('m3r'), FOODS);
    expect(Math.abs(total.kcal - 419)).toBeLessThanOrEqual(KCAL_TOLERANCE);
    expect(Math.abs(total.protein - 38.6)).toBeLessThanOrEqual(GRAM_TOLERANCE);
  });

  it('m3r trennt Eigenanteil und Zuschlag', () => {
    expect(addOnMacros(meal('m3r'), FOODS).protein).toBeCloseTo(11.75, 2);
    expect(addOnMacros(meal('m1a'), FOODS).kcal).toBe(0);
  });

  it('Gewuerze veraendern die Makros nicht', () => {
    const plain = { ...meal('m1b'), ingredients: meal('m1b').ingredients.filter((i) => i.grams > 0) };
    expect(mealMacros(plain, FOODS)).toEqual(mealMacros(meal('m1b'), FOODS));
  });
});

describe('Tage der Standardrotation', () => {
  const kcalOf = (day: Weekday) => dayMacros(standard.days.find((d) => d.day === day)!, FOODS).kcal;

  it('haben keine Auffaelligkeiten in der Aufloesung', () => {
    expect(standard.issues).toEqual([]);
  });

  it.each(WEEKDAYS)('%s liegt im Kalorienband', (day) => {
    expect(Math.abs(kcalOf(day) - EXPECTED_DAY_KCAL)).toBeLessThanOrEqual(DAY_KCAL_BAND);
  });

  it('jeder Tag liegt ueber dem Proteinziel', () => {
    for (const day of standard.days) {
      expect(dayMacros(day, FOODS).protein).toBeGreaterThanOrEqual(EXPECTED_MIN_PROTEIN);
    }
  });

  it('summieren sich zur Wochensumme', () => {
    const sum = standard.days.reduce((s, d) => s + dayMacros(d, FOODS).kcal, 0);
    expect(weekMacros(standard, FOODS).kcal).toBeCloseTo(sum, 6);
  });
});

describe('Effektive Rotation', () => {
  const mealAt = (plan: ReturnType<typeof effectivePlan>, day: Weekday, slot: string) =>
    plan.days.find((d) => d.day === day)!.slots.find((s) => s.slot === slot)!;

  it('uebernimmt ohne Overrides die Standardrotation', () => {
    expect(mealAt(standard, 'Mo', 'M1').mealId).toBe('m1a');
    expect(mealAt(standard, 'So', 'M4').mealId).toBe('m4a');
  });

  it('tauscht ein Gericht je Tag und Slot', () => {
    const overrides: Overrides = { swaps: { Di: { M2: 'm2b' } }, bar: {} };
    const plan = effectivePlan(ROTATION, overrides, MEALS);
    expect(mealAt(plan, 'Di', 'M2').mealId).toBe('m2b');
    expect(mealAt(plan, 'Mi', 'M2').mealId).toBe('m2a');
    expect(plan.issues).toEqual([]);
  });

  it('weist einen Tausch in den falschen Slot ab und sagt es', () => {
    const plan = effectivePlan(ROTATION, { swaps: { Di: { M2: 'm4a' } }, bar: {} }, MEALS);
    expect(mealAt(plan, 'Di', 'M2').mealId).toBe('m2a');
    expect(plan.issues).toHaveLength(1);
  });

  it('ersetzt mit dem Riegel Schalter M3 und legt 50 g Haehnchen auf M2', () => {
    const plan = effectivePlan(ROTATION, { swaps: {}, bar: { Mo: true } }, MEALS);
    const monday = plan.days.find((d) => d.day === 'Mo')!;
    expect(monday.barActive).toBe(true);
    expect(mealAt(plan, 'Mo', 'M3').mealId).toBe('m3r');
    const chicken = mealAt(plan, 'Mo', 'M2').ingredients.filter((i) => i.foodId === 'chicken_breast');
    expect(chicken.reduce((s, i) => s + i.grams, 0)).toBe(185 + 50);
    expect(plan.days.find((d) => d.day === 'Di')!.barActive).toBe(false);
  });

  it('kostet den Tag mit Riegel genau Riegel minus Wrap plus Haehnchen', () => {
    const withBar = effectivePlan(ROTATION, { swaps: {}, bar: { Mo: true } }, MEALS);
    const delta = dayMacros(withBar.days[0]!, FOODS).kcal - dayMacros(standard.days[0]!, FOODS).kcal;
    const expected = mealMacrosWithAddOn(meal('m3r'), FOODS).kcal - mealMacros(meal('m3a'), FOODS).kcal;
    expect(delta).toBeCloseTo(expected, 6);
  });
});

describe('Tagessumme gegen Ziel', () => {
  const goals: DayGoals = {
    proteinG: 200, carbsG: null, fatG: null, fiberG: 40, caloriesKcal: 2300, proteinFeedings: null, steps: null,
  };
  const totals: Macros = { kcal: 2320, protein: 205, carbs: 230, fat: 66, fiber: 38 };

  it('vergleicht, was ein Ziel hat', () => {
    const result = compareToGoals(totals, goals);
    expect(result.caloriesKcal).toEqual({ actual: 2320, goal: 2300, diff: 20 });
    expect(result.proteinG?.diff).toBe(5);
    expect(result.fiberG?.diff).toBe(-2);
  });

  it('vergleicht nicht, wenn das Ziel fehlt', () => {
    expect(compareToGoals(totals, goals).fatG).toBeNull();
  });
});

describe('Einkaufsliste der Standardwoche', () => {
  const demand = weeklyDemand(standard);
  const list = buildShoppingList(demand, SHOPPING_ITEMS, FOODS);
  const lines = list.groups.flatMap((g) => g.lines);
  const line = (id: string) => lines.find((l) => l.foodId === id)!;

  const NEEDED: [string, number][] = [
    ['chicken_breast', 1035], ['turkey_breast', 560], ['beef_mince_5', 840], ['salmon_frozen', 450],
    ['tuna_natural', 330], ['turkey_coldcut', 260], ['skyr', 990], ['cottage_cheese', 360],
    ['eatlean_cheese', 120], ['oats', 240], ['basmati', 365], ['kidney_beans', 640], ['passata', 1200],
    ['olive_oil', 139],
  ];

  it.each(NEEDED)('Bedarf %s ist %i g', (id, grams) => {
    expect(line(id).neededG).toBe(grams);
  });

  it('rechnet Eier auf 10 Stueck und Kartoffeln auf rund 1,9 kg', () => {
    expect(line('egg_m').pieces).toBe(10);
    expect(Math.abs(line('potato').neededG - 1900)).toBeLessThanOrEqual(50);
  });

  it('enthaelt keine Milch und keine Lagerware', () => {
    for (const id of ['milk_15', 'protein_bar', 'peanut_butter', 'whey_vanilla']) {
      expect(lines.some((l) => l.foodId === id)).toBe(false);
    }
    expect(list.missingItems).toEqual([]);
  });

  it('rundet auf Packungen', () => {
    expect(line('chicken_breast')).toMatchObject({ packs: 2, packSizeG: 600, buyG: 1200 });
    expect(line('broccoli')).toMatchObject({ packs: 2 });
    expect(line('kidney_beans')).toMatchObject({ packs: 3 });
    expect(line('beef_mince_5')).toMatchObject({ packs: 2 });
    expect(line('turkey_coldcut')).toMatchObject({ packs: 2 });
    expect(line('zucchini')).toMatchObject({ pieces: 5 });
  });

  it('rundet Stueckware auf ganze Stueck', () => {
    expect(line('wholegrain_wrap').pieces).toBe(6);
    expect(line('avocado').pieces).toBe(2);
  });

  it('markiert Vorrat und fuehrt Gewuerze ohne Menge', () => {
    expect(line('chicken_breast').pantry).toBe(false);
    expect(line('olive_oil').pantry).toBe(true);
    expect(line('curry')).toMatchObject({ isSpice: true, pantry: true, buyG: null, neededG: 0 });
    expect(line('mustard').neededG).toBe(40);
  });

  it('gruppiert nach Kategorie in fester Reihenfolge', () => {
    expect(list.groups.map((g) => g.category)).toEqual(['meat_fish', 'chilled', 'produce', 'frozen', 'dry', 'spices_sauces']);
  });

  it('nimmt den Riegel Tag mit: mehr Haehnchen, kein Wrap', () => {
    const plan = effectivePlan(ROTATION, { swaps: {}, bar: { Mo: true } }, MEALS);
    const withBar = buildShoppingList(weeklyDemand(plan), SHOPPING_ITEMS, FOODS).groups.flatMap((g) => g.lines);
    expect(withBar.find((l) => l.foodId === 'chicken_breast')!.neededG).toBe(1035 - 120 + 50);
    expect(withBar.find((l) => l.foodId === 'wholegrain_wrap')!.pieces).toBe(5);
  });

  it('meldet Zutaten ohne Einkaufseintrag', () => {
    const missing = buildShoppingList(new Map([['ghost', 5]]), SHOPPING_ITEMS, FOODS);
    expect(missing.missingItems).toEqual(['ghost']);
  });

  it('roundToPacks waehlt den geringsten Ueberkauf', () => {
    expect(roundToPacks(950, [200, 450])).toEqual({ packSizeG: 450, packs: 2 });
    expect(roundToPacks(100, [])).toBeNull();
  });
});

describe('Prep Sessions der Standardrotation', () => {
  const prep = buildPrep(PREP_SESSIONS, standard, FOODS);
  const step = (session: string, title: string, device?: string) =>
    prep.find((s) => s.id === session)!.steps.find((s) => s.title === title && (!device || s.device === device))!;
  const grams = (s: ReturnType<typeof step>, id: string) => s.lines.find((l) => l.foodId === id)?.grams;

  it('Sonntag: Reis 225 g fuer m2a Mo bis Mi', () => {
    const rice = step('sunday', 'Reis kochen');
    expect(grams(rice, 'basmati')).toBe(225);
    expect(rice.device).toBe('Mikrowelle');
  });

  it('Sonntag: Egg-Muffins fuer m1b Di und Sa', () => {
    const eggs = step('sunday', 'Egg-Muffins backen');
    expect(grams(eggs, 'egg_m')).toBe(300);
    expect(grams(eggs, 'cottage_cheese')).toBe(200);
    expect(grams(eggs, 'turkey_coldcut')).toBe(100);
    expect(grams(eggs, 'spinach_frozen')).toBe(160);
    expect(grams(eggs, 'bell_pepper')).toBe(120);
  });

  it('Sonntag: OptiGrill 795 g Haehnchen und 280 g Pute', () => {
    const chicken = step('sunday', 'Hähnchen grillen');
    expect(chicken.device).toBe('OptiGrill');
    expect(grams(chicken, 'chicken_breast')).toBe(795);
    expect(chicken.lines.find((l) => l.foodId === 'chicken_breast')!.uses.map((u) => [u.mealId, u.grams])).toEqual([
      ['m2a', 555],
      ['m3a', 240],
    ]);
    expect(grams(step('sunday', 'Pute grillen'), 'turkey_breast')).toBe(280);
  });

  it('Sonntag: Wedges mit 510 g Kartoffeln, 30 g Oel, Zucchini und Paprika aus m4b', () => {
    const wedges = step('sunday', 'Wedges backen');
    expect(wedges.device).toBe('Airfryer');
    expect(grams(wedges, 'potato')).toBe(510);
    expect(grams(wedges, 'olive_oil')).toBe(30);
    expect(grams(wedges, 'zucchini')).toBe(480);
    expect(grams(wedges, 'bell_pepper')).toBe(320);
  });

  it('Mittwoch: Chili fuer m2b Do bis So', () => {
    const chili = step('wednesday', 'Chili kochen');
    expect(grams(chili, 'beef_mince_5')).toBe(840);
    expect(grams(chili, 'passata')).toBe(1200);
    expect(grams(chili, 'kidney_beans')).toBe(640);
    expect(grams(chili, 'bell_pepper')).toBe(240);
    expect(grams(chili, 'olive_oil')).toBe(20);
  });

  it('Mittwoch: Reis 140 g, Haehnchen 240 g, Pute 280 g', () => {
    expect(grams(step('wednesday', 'Reis kochen'), 'basmati')).toBe(140);
    expect(grams(step('wednesday', 'Hähnchen grillen'), 'chicken_breast')).toBe(240);
    expect(grams(step('wednesday', 'Pute grillen'), 'turkey_breast')).toBe(280);
  });

  it('fuehrt Gewuerze eines Gerichts ohne Menge', () => {
    const chili = step('wednesday', 'Chili kochen');
    const cumin = chili.lines.find((l) => l.foodId === 'cumin')!;
    expect(cumin.grams).toBeNull();
    expect(cumin.uses.every((u) => u.grams === null)).toBe(true);
  });

  it('folgt der effektiven Rotation: Riegel Tag bringt 50 g mehr Haehnchen in die Bowl', () => {
    const plan = effectivePlan(ROTATION, { swaps: {}, bar: { Mo: true } }, MEALS);
    const chicken = buildPrep(PREP_SESSIONS, plan, FOODS)[0]!.steps.find((s) => s.title === 'Hähnchen grillen')!;
    // Mo ohne m3a (-120), dafuer +50 auf m2a
    expect(grams(chicken, 'chicken_breast')).toBe(795 - 120 + 50);
  });

  it('laesst einen Schritt leer, wenn das Gericht nicht mehr geplant ist', () => {
    const swaps: Overrides['swaps'] = {};
    for (const day of WEEKDAYS) swaps[day] = { M1: 'm1a' };
    const plan = effectivePlan(ROTATION, { swaps, bar: {} }, MEALS);
    const eggs = buildPrep(PREP_SESSIONS, plan, FOODS)[0]!.steps.find((s) => s.title === 'Egg-Muffins backen')!;
    expect(eggs.lines).toEqual([]);
  });
});

describe('Hilfen', () => {
  it('indexById findet Eintraege', () => {
    expect(indexById(FOODS).get('oats')?.name).toBe('Haferflocken');
  });
});
