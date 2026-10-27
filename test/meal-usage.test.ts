import { describe, expect, it } from 'vitest';
import { mealUsage } from '../src/nutrition/mealUsage';
import type { PlannedDay } from '../src/nutrition/rotation';

const day = (name: PlannedDay['day'], slots: PlannedDay['slots']): PlannedDay => ({ day: name, slots, barActive: false });

const DAYS: PlannedDay[] = [
  day('Mo', [
    { slot: 'M1', mealId: 'a', ingredients: [{ foodId: 'rice', grams: 100 }, { foodId: 'chicken', grams: 150 }] },
    { slot: 'M2', mealId: 'b', ingredients: [{ foodId: 'egg', grams: 120 }] },
  ]),
  day('Di', [{ slot: 'M1', mealId: 'a', ingredients: [{ foodId: 'rice', grams: 100 }, { foodId: 'chicken', grams: 150 }] }]),
  day('Mi', [{ slot: 'M1', mealId: 'a', ingredients: [{ foodId: 'rice', grams: 100 }, { foodId: 'chicken', grams: 200 }] }]),
];

describe('mealUsage', () => {
  it('zaehlt Portionen und summiert die Woche', () => {
    const usage = mealUsage(DAYS, 'a');
    expect(usage.portions).toBe(3);
    expect(usage.weekTotal).toEqual([{ foodId: 'rice', grams: 300 }, { foodId: 'chicken', grams: 500 }]);
  });

  it('nimmt die Zutaten je Portion aus dem ersten Vorkommen', () => {
    expect(mealUsage(DAYS, 'a').perPortion).toEqual([{ foodId: 'rice', grams: 100 }, { foodId: 'chicken', grams: 150 }]);
  });

  it('kennt ein einzelnes Vorkommen', () => {
    const usage = mealUsage(DAYS, 'b');
    expect(usage.portions).toBe(1);
    expect(usage.weekTotal).toEqual(usage.perPortion);
  });

  it('liefert fuer ein Gericht ausserhalb der Woche nichts', () => {
    expect(mealUsage(DAYS, 'zzz')).toEqual({ portions: 0, perPortion: [], weekTotal: [] });
  });

  it('veraendert die Eingabe nicht', () => {
    const usage = mealUsage(DAYS, 'a');
    usage.perPortion[0]!.grams = 1;
    expect(DAYS[0]!.slots[0]!.ingredients[0]!.grams).toBe(100);
  });
});
