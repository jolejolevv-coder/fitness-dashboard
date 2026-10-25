import { readStorage, writeStorage } from '../nutrition/state';
import { parseProposal } from './response';
import type { Proposal } from './response';

/**
 * Lokaler Zustand des Plan Generators. Parsen und Serialisieren sind reine
 * Funktionen, der Speicherzugriff laeuft ueber `readStorage` und `writeStorage`.
 */

export const API_KEY_KEY = 'fitness_anthropic_v1';
export const EXCLUSIONS_KEY = 'fitness_exclusions_v1';
export const ACTIVE_PLAN_KEY = 'fitness_active_plan_v1';

export type ActivePlan = Proposal & { createdAt: string; model: string };

function parseJson(raw: string | null): unknown {
  if (raw === null) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function parseApiKey(raw: string | null): string | null {
  const key = raw?.trim() ?? '';
  return key === '' ? null : key;
}

export function parseExclusions(raw: string | null): Set<string> {
  const data = parseJson(raw);
  if (!Array.isArray(data)) return new Set();
  return new Set(data.filter((entry): entry is string => typeof entry === 'string' && entry !== ''));
}

export function serializeExclusions(exclusions: ReadonlySet<string>): string {
  return JSON.stringify([...exclusions].sort());
}

/** Ohne bekannte Lebensmittel `foodIds` ist kein gespeicherter Plan pruefbar, er wird verworfen. */
export function parseActivePlan(raw: string | null, foodIds: ReadonlySet<string>): ActivePlan | null {
  const data = parseJson(raw);
  if (!isRecord(data)) return null;
  const createdAt = data['createdAt'];
  const model = data['model'];
  if (typeof createdAt !== 'string' || createdAt === '' || typeof model !== 'string' || model === '') return null;
  const result = parseProposal(data, foodIds);
  if (!result.ok) return null;
  return { ...result.proposal, createdAt, model };
}

export function serializeActivePlan(plan: ActivePlan): string {
  return JSON.stringify(plan);
}

export function loadApiKey(): string | null {
  return parseApiKey(readStorage(API_KEY_KEY));
}

export function saveApiKey(key: string | null): void {
  writeStorage(API_KEY_KEY, key === null || key.trim() === '' ? null : key.trim());
}

export function loadExclusions(): Set<string> {
  return parseExclusions(readStorage(EXCLUSIONS_KEY));
}

export function saveExclusions(exclusions: ReadonlySet<string>): void {
  writeStorage(EXCLUSIONS_KEY, exclusions.size > 0 ? serializeExclusions(exclusions) : null);
}

export function loadActivePlan(foodIds: ReadonlySet<string>): ActivePlan | null {
  return parseActivePlan(readStorage(ACTIVE_PLAN_KEY), foodIds);
}

export function saveActivePlan(plan: ActivePlan | null): void {
  writeStorage(ACTIVE_PLAN_KEY, plan === null ? null : serializeActivePlan(plan));
}
