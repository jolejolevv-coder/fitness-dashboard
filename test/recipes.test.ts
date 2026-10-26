import { describe, it, expect } from 'vitest';
import recipesJson from '../data/recipes.json';
import { PREP_SESSIONS } from '../src/nutrition/plan';
import { validateRecipes, validateStepIds } from '../src/nutrition/recipes';
import type { PrepSession, Recipe } from '../src/nutrition/types';

const RECIPES = recipesJson as unknown as Recipe[];

const session = (steps: PrepSession['steps']): PrepSession[] => [{ id: 's', title: 'S', steps }];
const grill = (id?: string): PrepSession['steps'][number] => ({ ...(id ? { id } : {}), title: 'Grillen', device: 'OptiGrill', covers: [] });
const recipe = (overrides: Partial<Recipe> = {}): Recipe => ({
  stepId: 'a',
  device: 'OptiGrill',
  instruction: 'Grillen.',
  temperatureC: 210,
  minutes: 8,
  ...overrides,
});

describe('Seed Querverweise Prep und Rezepte', () => {
  it('jeder Seed Schritt hat eine eindeutige id', () => {
    expect(validateStepIds(PREP_SESSIONS)).toEqual([]);
    expect(PREP_SESSIONS.flatMap((s) => s.steps)).toHaveLength(10);
  });

  it('jedes Rezept zeigt auf einen existierenden Schritt und nutzt nur erlaubte Geraete', () => {
    expect(validateRecipes(PREP_SESSIONS, RECIPES)).toEqual([]);
  });

  it('jeder Seed Schritt hat ein Rezept', () => {
    const covered = new Set(RECIPES.map((r) => r.stepId));
    expect(PREP_SESSIONS.flatMap((s) => s.steps).filter((s) => !covered.has(s.id ?? ''))).toEqual([]);
  });
});

describe('validateStepIds', () => {
  it('meldet fehlende und doppelte ids', () => {
    expect(validateStepIds(session([grill(), grill('a'), grill('a')]))).toEqual(['Prep s Grillen: id fehlt', 'Prep s Grillen: id a doppelt']);
  });
});

describe('validateRecipes', () => {
  const prep = session([grill('a')]);

  it('akzeptiert ein stimmiges Rezept', () => {
    expect(validateRecipes(prep, [recipe()])).toEqual([]);
  });

  it('meldet unbekannte Schritte und doppelte Rezepte', () => {
    expect(validateRecipes(prep, [recipe({ stepId: 'x' })])).toEqual(['Rezept x: kein Prep Schritt mit dieser id']);
    expect(validateRecipes(prep, [recipe(), recipe()])).toEqual(['Rezept a: doppelt']);
  });

  it('verwirft Geraete ausserhalb von PREP_DEVICES', () => {
    const herd = recipe({ device: 'Herd' as Recipe['device'] });
    expect(validateRecipes(prep, [herd])).toContain('Rezept a: unbekanntes Geraet Herd');
  });

  it('verlangt das Geraet des Schritts', () => {
    expect(validateRecipes(prep, [recipe({ device: 'Airfryer', temperatureC: 200 })])).toEqual([
      'Rezept a: Geraet Airfryer, Schritt nutzt OptiGrill',
    ]);
  });

  it('prueft Temperatur je Geraet', () => {
    const noTemperature = recipe();
    delete noTemperature.temperatureC;
    expect(validateRecipes(prep, [noTemperature])).toEqual(['Rezept a: Temperatur fehlt']);
    const microwave = session([{ id: 'a', title: 'Reis', device: 'Mikrowelle', covers: [] }]);
    expect(validateRecipes(microwave, [recipe({ device: 'Mikrowelle' })])).toEqual(['Rezept a: Mikrowelle hat keine Temperatur']);
  });

  it('prueft Dauer, Anweisung und Halt', () => {
    expect(validateRecipes(prep, [recipe({ minutes: 0 })])).toEqual(['Rezept a: Dauer 0 min']);
    expect(validateRecipes(prep, [recipe({ instruction: ' ' })])).toEqual(['Rezept a: Anweisung leer']);
    expect(validateRecipes(prep, [recipe({ hold: { afterMinutes: 8, action: 'Wenden' } })])).toEqual(['Rezept a: Halt nach 8 von 8 min']);
    expect(validateRecipes(prep, [recipe({ hold: { afterMinutes: 4, action: '' } })])).toEqual(['Rezept a: Halt ohne Handlung']);
  });
});
