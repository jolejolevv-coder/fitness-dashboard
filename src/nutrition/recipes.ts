import type { PrepSession, Recipe } from './types';
import { PREP_DEVICES, TEMPERATURE_DEVICES } from './types';

/**
 * Querverweise zwischen `prep.json` und `recipes.json`. Reine Funktionen,
 * Klartext je Fund, eine leere Liste bedeutet stimmig.
 */

/** Seed Pflicht: jeder Schritt hat eine `id`, keine kommt zweimal vor. */
export function validateStepIds(prep: readonly PrepSession[]): string[] {
  const issues: string[] = [];
  const seen = new Set<string>();
  for (const session of prep) {
    for (const step of session.steps) {
      if (!step.id) {
        issues.push(`Prep ${session.id} ${step.title}: id fehlt`);
        continue;
      }
      if (seen.has(step.id)) issues.push(`Prep ${session.id} ${step.title}: id ${step.id} doppelt`);
      seen.add(step.id);
    }
  }
  return issues;
}

function validateRecipe(recipe: Recipe, stepDevice: string | undefined): string[] {
  const where = `Rezept ${recipe.stepId}`;
  const issues: string[] = [];
  const devices: readonly string[] = PREP_DEVICES;
  if (stepDevice === undefined) issues.push(`${where}: kein Prep Schritt mit dieser id`);
  if (!devices.includes(recipe.device)) issues.push(`${where}: unbekanntes Geraet ${recipe.device}`);
  else if (stepDevice !== undefined && stepDevice !== recipe.device) {
    issues.push(`${where}: Geraet ${recipe.device}, Schritt nutzt ${stepDevice}`);
  }
  if (!recipe.instruction.trim()) issues.push(`${where}: Anweisung leer`);
  if (!(recipe.minutes > 0)) issues.push(`${where}: Dauer ${recipe.minutes} min`);
  const hasTemperature = TEMPERATURE_DEVICES.includes(recipe.device);
  if (hasTemperature && !(recipe.temperatureC !== undefined && recipe.temperatureC > 0)) {
    issues.push(`${where}: Temperatur fehlt`);
  }
  if (!hasTemperature && recipe.temperatureC !== undefined) issues.push(`${where}: ${recipe.device} hat keine Temperatur`);
  if (recipe.hold && !(recipe.hold.afterMinutes > 0 && recipe.hold.afterMinutes < recipe.minutes)) {
    issues.push(`${where}: Halt nach ${recipe.hold.afterMinutes} von ${recipe.minutes} min`);
  }
  if (recipe.hold && !recipe.hold.action.trim()) issues.push(`${where}: Halt ohne Handlung`);
  return issues;
}

/** Jedes Rezept zeigt auf einen existierenden Schritt, hoechstens eines je Schritt. */
export function validateRecipes(prep: readonly PrepSession[], recipes: readonly Recipe[]): string[] {
  const deviceByStep = new Map<string, string>();
  for (const session of prep) {
    for (const step of session.steps) if (step.id) deviceByStep.set(step.id, step.device);
  }
  const issues: string[] = [];
  const seen = new Set<string>();
  for (const recipe of recipes) {
    if (seen.has(recipe.stepId)) issues.push(`Rezept ${recipe.stepId}: doppelt`);
    seen.add(recipe.stepId);
    issues.push(...validateRecipe(recipe, deviceByStep.get(recipe.stepId)));
  }
  return issues;
}
