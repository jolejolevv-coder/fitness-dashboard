import type { SheetValues } from '../types';

/**
 * Letzter geladener Plan, damit das Formular im Studio ohne Netz funktioniert.
 * Gehoert zu einer Quelle (Sheet ID), bei einem Wechsel der Quelle faellt er weg.
 */

const PLAN_CACHE_KEY = 'fitness_plan_cache_v1';

export interface PlanRows {
  plan: SheetValues;
  settings: SheetValues;
}

interface Stored extends PlanRows {
  source: string;
}

export function loadPlanCache(source: string): PlanRows | null {
  try {
    const raw = localStorage.getItem(PLAN_CACHE_KEY);
    if (!raw) return null;
    const stored = JSON.parse(raw) as Stored;
    return stored.source === source ? { plan: stored.plan, settings: stored.settings } : null;
  } catch {
    return null;
  }
}

export function savePlanCache(source: string, rows: PlanRows): void {
  try {
    localStorage.setItem(PLAN_CACHE_KEY, JSON.stringify({ source, ...rows } satisfies Stored));
  } catch {
    // Ein voller localStorage darf das Formular nicht anhalten.
  }
}
