import { describe, expect, it } from 'vitest';
import { MEALS, parseMealStep, parseMealSteps } from '../src/nutrition/plan';

const MIN_STEPS = 3;
const MAX_STEPS = 6;
const SINGLE_STEP_MEAL = 'm3r';

describe('Zubereitung der Seed Gerichte', () => {
  for (const meal of MEALS) {
    describe(meal.id, () => {
      const steps = meal.steps ?? [];
      const foodIds = new Set([...meal.ingredients.map((i) => i.foodId), ...(meal.addToSlot ? [meal.addToSlot.foodId] : [])]);

      it('hat die erwartete Zahl an Schritten', () => {
        if (meal.id === SINGLE_STEP_MEAL) expect(steps).toHaveLength(1);
        else {
          expect(steps.length).toBeGreaterThanOrEqual(MIN_STEPS);
          expect(steps.length).toBeLessThanOrEqual(MAX_STEPS);
        }
      });

      it('nennt nur Zutaten des Gerichts', () => {
        for (const step of steps) for (const id of step.foods) expect(foodIds.has(id), `${meal.id}: ${id}`).toBe(true);
      });

      it('hat in jedem Schritt Text', () => {
        for (const step of steps) expect(step.text.trim()).not.toBe('');
      });
    });
  }
});

describe('parseMealSteps', () => {
  it('liefert bei fehlendem Feld keine Schritte', () => {
    expect(parseMealSteps(undefined)).toEqual([]);
  });

  it('wirft kaputte Eintraege weg und behaelt die guten', () => {
    const good = { text: 'Braten', device: 'Airfryer', minutes: 8, temperatureC: 200, foods: ['a'] };
    expect(parseMealSteps([null, 3, { text: '  ' }, { device: 'x' }, good])).toEqual([good]);
  });

  it('setzt fehlende oder ungueltige Felder auf null', () => {
    expect(parseMealStep({ text: 'Mischen', minutes: -1, temperatureC: 'heiss', foods: [1, 'b'] })).toEqual({
      text: 'Mischen', device: null, minutes: null, temperatureC: null, foods: ['b'],
    });
  });
});
