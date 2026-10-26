import { describe, it, expect } from 'vitest';
import recipesJson from '../data/recipes.json';
import { FOODS, MEALS, PREP_SESSIONS, ROTATION } from '../src/nutrition/plan';
import { NO_OVERRIDES, effectivePlan } from '../src/nutrition/rotation';
import { buildPrep } from '../src/nutrition/prep';
import type { PrepSessionResult } from '../src/nutrition/prep';
import type { Recipe } from '../src/nutrition/types';
import { COOK_STATE_KEY, MS_PER_MINUTE, MS_PER_SECOND } from '../src/config/cook';
import {
  EMPTY_SESSION_STATE,
  attachRecipes,
  buildMiseEnPlace,
  clampPosition,
  dueEvents,
  formatRemaining,
  isFinished,
  parseCookState,
  remainingMs,
  serializeCookState,
  sessionState,
  startTimer,
  toggleChecked,
  withPosition,
  withReported,
  withSessionState,
  withTimer,
  withoutSession,
  withoutTimer,
} from '../src/nutrition/cook';
import type { CookState, CookTimer } from '../src/nutrition/cook';

const RECIPES = recipesJson as unknown as Recipe[];
const T0 = 1_800_000_000_000;

const session: PrepSessionResult = {
  id: 's',
  title: 'Sonntag',
  steps: [
    {
      id: 'a',
      title: 'Grillen',
      device: 'OptiGrill',
      lines: [
        { foodId: 'chicken', name: 'Hähnchen', grams: 300, uses: [] },
        { foodId: 'paprika', name: 'Paprikapulver', grams: null, uses: [] },
      ],
    },
    {
      id: 'b',
      title: 'Backen',
      device: 'Airfryer',
      lines: [
        { foodId: 'potato', name: 'Kartoffeln', grams: 500, uses: [] },
        { foodId: 'chicken', name: 'Hähnchen', grams: 120, uses: [] },
        { foodId: 'paprika', name: 'Paprikapulver', grams: null, uses: [] },
      ],
    },
    { title: 'Ohne id', device: 'Mikrowelle', lines: [] },
  ],
};

const recipe = (overrides: Partial<Recipe> = {}): Recipe => ({
  stepId: 'a',
  device: 'OptiGrill',
  instruction: 'Grillen.',
  temperatureC: 210,
  minutes: 12,
  ...overrides,
});

describe('buildMiseEnPlace', () => {
  it('fuehrt jede Zutat einmal mit der Summe ueber alle Schritte, Gewuerze ohne Menge', () => {
    expect(buildMiseEnPlace(session)).toEqual([
      { foodId: 'chicken', name: 'Hähnchen', grams: 420 },
      { foodId: 'paprika', name: 'Paprikapulver', grams: null },
      { foodId: 'potato', name: 'Kartoffeln', grams: 500 },
    ]);
  });

  it('stimmt mit den Schrittmengen der Prep Checkliste ueberein', () => {
    for (const bar of [{}, { Mo: true as const }]) {
      const plan = effectivePlan(ROTATION, { swaps: {}, bar }, MEALS);
      for (const prep of buildPrep(PREP_SESSIONS, plan, FOODS)) {
        const mise = buildMiseEnPlace(prep);
        expect(new Set(mise.map((l) => l.foodId)).size).toBe(mise.length);
        for (const line of mise) {
          const stepLines = prep.steps.flatMap((s) => s.lines).filter((l) => l.foodId === line.foodId);
          const sum = stepLines.every((l) => l.grams === null) ? null : stepLines.reduce((acc, l) => acc + (l.grams ?? 0), 0);
          expect(line.grams).toBe(sum);
        }
      }
    }
  });
});

describe('attachRecipes', () => {
  it('ordnet ueber die Schritt id zu und zaehlt Schritte mit Anweisung', () => {
    const cook = attachRecipes(session, [recipe(), recipe({ stepId: 'zzz' })]);
    expect(cook.steps.map((s) => s.recipe?.stepId ?? null)).toEqual(['a', null, null]);
    expect(cook.instructed).toBe(1);
    expect(cook.steps).toHaveLength(3);
  });

  it('Seed: buildPrep traegt die id, jeder Schritt hat eine Anweisung', () => {
    const prep = buildPrep(PREP_SESSIONS, effectivePlan(ROTATION, NO_OVERRIDES, MEALS), FOODS);
    for (const s of prep) {
      expect(s.steps.every((step) => typeof step.id === 'string')).toBe(true);
      const cook = attachRecipes(s, RECIPES);
      expect(cook.instructed).toBe(cook.steps.length);
    }
  });

  it('generierter Plan ohne ids: keine Anweisung, Mengen bleiben', () => {
    const generated = { ...session, steps: session.steps.map(({ id: _id, ...rest }) => rest) };
    const cook = attachRecipes(generated, [recipe()]);
    expect(cook.instructed).toBe(0);
    expect(cook.steps[0]!.step.lines).toHaveLength(2);
  });
});

describe('Timer', () => {
  it('rechnet die Restzeit aus dem Endzeitpunkt, auch nach Neuladen', () => {
    const timer = startTimer(recipe(), T0);
    expect(timer.endsAt).toBe(T0 + 12 * MS_PER_MINUTE);
    const reloaded = parseCookState(serializeCookState({ s: withTimer(EMPTY_SESSION_STATE, timer) }))['s']!.timers[0]!;
    const later = T0 + 5 * MS_PER_MINUTE + 300;
    expect(remainingMs(reloaded, later)).toBe(7 * MS_PER_MINUTE - 300);
    expect(formatRemaining(remainingMs(reloaded, later))).toBe('7:00');
    expect(remainingMs(reloaded, T0 + 20 * MS_PER_MINUTE)).toBe(0);
  });

  it('meldet Halt und Ende getrennt und jeweils nur einmal', () => {
    let timer = startTimer(recipe({ minutes: 18, hold: { afterMinutes: 10, action: 'Umrühren' } }), T0);
    expect(timer.holdAt).toBe(T0 + 10 * MS_PER_MINUTE);
    expect(dueEvents(timer, T0 + 9 * MS_PER_MINUTE)).toEqual([]);
    expect(dueEvents(timer, T0 + 10 * MS_PER_MINUTE)).toEqual(['hold']);
    timer = withReported(timer, ['hold']);
    expect(dueEvents(timer, T0 + 11 * MS_PER_MINUTE)).toEqual([]);
    expect(isFinished(timer, T0 + 17 * MS_PER_MINUTE)).toBe(false);
    expect(dueEvents(timer, T0 + 18 * MS_PER_MINUTE)).toEqual(['end']);
    timer = withReported(timer, ['end']);
    expect(timer.reported).toEqual(['hold', 'end']);
    expect(dueEvents(timer, T0 + 30 * MS_PER_MINUTE)).toEqual([]);
  });

  it('nach langer Abwesenheit kommen Halt und Ende zusammen, Halt zuerst', () => {
    const timer = startTimer(recipe({ minutes: 18, hold: { afterMinutes: 10, action: 'Umrühren' } }), T0);
    expect(dueEvents(timer, T0 + 60 * MS_PER_MINUTE)).toEqual(['hold', 'end']);
  });

  it('ohne Halt kein Haltereignis', () => {
    const timer = startTimer(recipe(), T0);
    expect(timer.holdAt).toBeNull();
    expect(dueEvents(timer, T0 + 12 * MS_PER_MINUTE)).toEqual(['end']);
  });

  it('formatRemaining rundet angebrochene Sekunden auf', () => {
    expect(formatRemaining(12 * MS_PER_MINUTE)).toBe('12:00');
    expect(formatRemaining(MS_PER_SECOND + 1)).toBe('0:02');
    expect(formatRemaining(0)).toBe('0:00');
    expect(formatRemaining(-5)).toBe('0:00');
  });
});

describe('Zustand fitness_cook_v1', () => {
  const timer: CookTimer = { stepId: 'a', endsAt: T0, holdAt: null, reported: [] };
  const valid = { checked: ['potato'], position: 1, timers: [timer] };

  it('nutzt den Schluessel aus der Spec', () => {
    expect(COOK_STATE_KEY).toBe('fitness_cook_v1');
  });

  it('Rundlauf parsen und serialisieren', () => {
    const state: CookState = { sunday: valid, wednesday: EMPTY_SESSION_STATE };
    expect(parseCookState(serializeCookState(state))).toEqual(state);
  });

  it('leer, kaputtes JSON oder falscher Typ ergeben leeren Zustand', () => {
    expect(parseCookState(null)).toEqual({});
    expect(parseCookState('{kaputt')).toEqual({});
    expect(parseCookState('[]')).toEqual({});
  });

  it('verwirft einen beschaedigten Session Eintrag und behaelt die anderen', () => {
    const broken = [
      { ...valid, position: -1 },
      { ...valid, position: 1.5 },
      { ...valid, checked: ['a', 3] },
      { ...valid, timers: [{ ...timer, endsAt: 'bald' }] },
      { ...valid, timers: [{ ...timer, holdAt: T0 + 1 }] },
      { ...valid, timers: [{ ...timer, reported: ['ring'] }] },
      { ...valid, timers: [timer, timer] },
      { checked: [], position: 0 },
      'x',
    ];
    for (const entry of broken) {
      expect(parseCookState(JSON.stringify({ sunday: valid, wednesday: entry }))).toEqual({ sunday: valid });
    }
  });

  it('uebernimmt keinen Prototyp aus dem Speicher', () => {
    const state = parseCookState(`{"__proto__": ${JSON.stringify(valid)}}`);
    expect(Object.getPrototypeOf(state)).toBe(Object.prototype);
    expect(sessionState(state, 'sunday')).toEqual(EMPTY_SESSION_STATE);
  });

  it('Haken, Position, Timer und Zuruecksetzen', () => {
    let s = toggleChecked(EMPTY_SESSION_STATE, 'potato');
    expect(s.checked).toEqual(['potato']);
    expect(toggleChecked(s, 'potato').checked).toEqual([]);
    s = withPosition(s, 9, 5);
    expect(s.position).toBe(5);
    expect(clampPosition(-2, 5)).toBe(0);
    s = withTimer(s, timer);
    s = withTimer(s, { ...timer, endsAt: T0 + 1 });
    expect(s.timers).toEqual([{ ...timer, endsAt: T0 + 1 }]);
    s = withTimer(s, { ...timer, stepId: 'b' });
    expect(s.timers.map((t) => t.stepId)).toEqual(['a', 'b']);
    expect(withoutTimer(s, 'a').timers.map((t) => t.stepId)).toEqual(['b']);

    const state = withSessionState({ wednesday: valid }, 'sunday', s);
    expect(sessionState(state, 'sunday')).toBe(s);
    expect(withoutSession(state, 'sunday')).toEqual({ wednesday: valid });
    expect(sessionState(withoutSession(state, 'sunday'), 'sunday')).toEqual(EMPTY_SESSION_STATE);
  });
});
