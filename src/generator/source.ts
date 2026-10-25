import type { DayTolerance } from '../config/generator';
import type { PlanData } from '../nutrition/plan';
import type { DayGoals } from '../parse/goals';
import { checkProposal, goalsReadiness } from './check';
import { parseActivePlan } from './state';
import type { ActivePlan } from './state';

/**
 * Planquelle der Reiter Plan und Einkauf: der gebuendelte Seed oder ein
 * uebernommener Vorschlag aus dem localStorage. Reine Funktion, der Aufrufer
 * liest den Speicher.
 *
 * Ein gespeicherter Plan gilt nur, wenn er `validatePlan` und die Tagespruefung
 * besteht. Sonst gilt der Seed, der Fund steht in `issues`. Der gespeicherte Plan
 * wird dabei nicht geloescht, er gilt wieder, sobald er die Pruefung besteht,
 * etwa wenn die Ziele aus dem Sheet nachgeladen sind.
 */

export type PlanSource =
  | { kind: 'seed'; plan: PlanData; issues: string[] }
  | { kind: 'active'; plan: PlanData; active: ActivePlan; issues: string[] };

/**
 * Ausschluesse steuern nur den naechsten Vorschlag. Ein bereits uebernommener
 * Plan wird nicht verworfen, weil sich die Ausschlussliste danach aendert.
 */
const NO_EXCLUSIONS: ReadonlySet<string> = new Set();

const REJECTED = 'Gespeicherter Plan nicht geladen';

function seed(plan: PlanData, issues: string[] = []): PlanSource {
  return { kind: 'seed', plan, issues };
}

export function resolvePlanSource(
  raw: string | null,
  seedPlan: PlanData,
  goals: DayGoals | null,
  tolerance: DayTolerance,
): PlanSource {
  if (raw === null) return seed(seedPlan);

  const active = parseActivePlan(raw, new Set(seedPlan.foods.map((f) => f.id)));
  if (!active) return seed(seedPlan, [`${REJECTED}: unlesbar`]);

  if (!goals) {
    const readiness = goalsReadiness(null);
    return seed(seedPlan, [`${REJECTED}: Ziele ${readiness.available} von ${readiness.required}`]);
  }

  const check = checkProposal(active, seedPlan, goals, NO_EXCLUSIONS, tolerance);
  if (!check.passed) return seed(seedPlan, check.issues.map((issue) => `${REJECTED}: ${issue}`));

  const plan: PlanData = {
    foods: seedPlan.foods,
    shoppingItems: seedPlan.shoppingItems,
    meals: active.meals,
    rotation: active.rotation,
    prep: active.prep,
  };
  return { kind: 'active', plan, active, issues: [] };
}
