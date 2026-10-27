import type { SheetValues } from '../types';

/**
 * Zugangsdaten und Datencache.
 *
 * Beides liegt ausschliesslich im localStorage des Browsers. Nichts davon
 * verlaesst das Geraet, nichts davon gehoert ins Repository.
 */

const CONFIG_KEY = 'fitness_cfg_v2';
const CACHE_KEY = 'fitness_cache_v1';

export const DEFAULT_DAILY_SHEET = 'Daily Tracking';
export const DEFAULT_TRAINING_SHEET = 'Mesocycle 1';

export interface Credentials {
  sheetId: string;
  apiKey: string;
  sheetName: string;
  trainingSheetName: string;
}

export interface CachedData {
  raw: SheetValues;
  rawTraining: SheetValues;
  /** Tab von rawTraining. Fehlt in Caches vor Phase 13.6. */
  trainingSheet?: string;
  ts: number;
}

export function getCredentials(): Partial<Credentials> {
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    return raw ? (JSON.parse(raw) as Partial<Credentials>) : {};
  } catch {
    return {};
  }
}

export function hasCredentials(c: Partial<Credentials>): c is Credentials {
  return Boolean(c.sheetId && c.apiKey);
}

export function saveCredentials(credentials: Credentials): void {
  localStorage.setItem(CONFIG_KEY, JSON.stringify(credentials));
}

export function saveCache(raw: SheetValues, rawTraining: SheetValues, trainingSheet: string): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ raw, rawTraining, trainingSheet, ts: Date.now() }));
  } catch {
    // Ein voller localStorage darf das Dashboard nicht anhalten.
  }
}

export function loadCache(): CachedData | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as CachedData) : null;
  } catch {
    return null;
  }
}
