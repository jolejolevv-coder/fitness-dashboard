import { DAY_TOLERANCE } from '../config/generator';
import { PLAN } from '../nutrition/plan';
import type { DayGoals } from '../parse/goals';
import { resolvePlanSource } from '../generator/source';
import type { PlanSource } from '../generator/source';
import { adoptActivePlan, readActivePlanRaw, resetToSeed } from '../generator/state';
import type { ActivePlan } from '../generator/state';

/**
 * Gemeinsame Planquelle der Reiter Plan und Einkauf.
 *
 * Beide Reiter halten Overrides und Abhakstatus im Speicher. Wechselt die
 * Quelle, laden sie diesen Zustand ueber `onPlanSourceChange` neu.
 */

type Listener = () => void;

const listeners: Listener[] = [];

export function getPlanSource(goals: DayGoals | null): PlanSource {
  return resolvePlanSource(readActivePlanRaw(), PLAN, goals, DAY_TOLERANCE);
}

/** True, solange ein Plan gespeichert ist, auch wenn er gerade nicht gilt. */
export function hasStoredPlan(): boolean {
  return readActivePlanRaw() !== null;
}

export function onPlanSourceChange(listener: Listener): void {
  listeners.push(listener);
}

function notify(): void {
  for (const listener of listeners) listener();
}

export function adoptPlan(plan: ActivePlan): void {
  adoptActivePlan(plan);
  notify();
}

export function returnToSeed(): void {
  resetToSeed();
  notify();
}
