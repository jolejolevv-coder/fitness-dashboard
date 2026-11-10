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
/** Tab des Gym Logbuchs mit einer Zeile je Satz (ADR 0008). */
export const DEFAULT_LOGBOOK_SHEET = 'TrainingSets';

/** Tabs mit dem Trainingsplan im Gym Logbuch (ADR 0010). */
export const PLAN_SHEET = 'Plan';
/** Tab mit von Hand gepflegten Koerperdaten im Gym Logbuch (Phase 21, ADR 0011). */
export const BODY_SHEET = 'Body';
export const PLAN_SETTINGS_SHEET = 'PlanSettings';

export interface Credentials {
  sheetId: string;
  apiKey: string;
  sheetName: string;
  trainingSheetName: string;
  /** Tabelle des Gym Logbuchs. Leer heisst: Training nur aus dem Mesocycle Tab. */
  logbookSheetId?: string;
  logbookSheetName?: string;
}

/** Wo die Logbuch Saetze liegen. Gleicher API Key wie das Haupt Sheet. */
export interface LogbookSource {
  sheetId: string;
  sheetName: string;
}

/** Rohzeilen des Logbuchs samt Herkunft, damit ein Wechsel der Quelle den Cache verwirft. */
export interface LogbookRows {
  rows: SheetValues;
  source: string;
}

export interface CachedData {
  raw: SheetValues;
  rawTraining: SheetValues;
  /** Tab von rawTraining. Fehlt in Caches vor Phase 13.6. */
  trainingSheet?: string;
  /** Fehlt in Caches vor Phase 18.2 und ohne Logbuch. */
  logbook?: LogbookRows;
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

export function logbookSource(c: Partial<Credentials>): LogbookSource | null {
  const sheetId = c.logbookSheetId?.trim() ?? '';
  if (!sheetId) return null;
  return { sheetId, sheetName: c.logbookSheetName?.trim() || DEFAULT_LOGBOOK_SHEET };
}

/** Schluessel einer Logbuch Quelle im Cache. */
export function logbookSourceKey(source: LogbookSource): string {
  return `${source.sheetId}/${source.sheetName}`;
}

export function saveCredentials(credentials: Credentials): void {
  localStorage.setItem(CONFIG_KEY, JSON.stringify(credentials));
}

export function saveCache(
  raw: SheetValues,
  rawTraining: SheetValues,
  trainingSheet: string,
  logbook: LogbookRows | null = null,
): void {
  const data: CachedData = { raw, rawTraining, trainingSheet, ts: Date.now() };
  if (logbook) data.logbook = logbook;
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(data));
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
