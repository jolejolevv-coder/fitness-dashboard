import type { SheetValues } from '../types';

/**
 * Gewaehlter Tab fuer `Eintragen` und sein letzter Stand (Phase 13.6).
 *
 * Getrennt vom Trainingstab der Auswertung. Der Cache haelt die Tabliste und
 * die Zeilen nur des gewaehlten Tabs, damit das Segment offline den letzten
 * Stand zeigt, ohne den localStorage mit allen Mesocycles zu fuellen.
 */

const LOG_TAB_KEY = 'fitness_log_tab_v1';
const LOG_CACHE_KEY = 'fitness_log_cache_v1';

export interface LogTabCache {
  titles: string[];
  tab: string;
  rows: SheetValues;
}

export function getLogTab(): string | null {
  try {
    return localStorage.getItem(LOG_TAB_KEY);
  } catch {
    return null;
  }
}

export function saveLogTab(tab: string): void {
  try {
    localStorage.setItem(LOG_TAB_KEY, tab);
  } catch {
    // Ein gesperrter localStorage kostet nur die gemerkte Wahl.
  }
}

export function loadLogCache(): LogTabCache | null {
  try {
    const raw = localStorage.getItem(LOG_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<LogTabCache>;
    if (!Array.isArray(parsed.titles) || typeof parsed.tab !== 'string' || !Array.isArray(parsed.rows)) return null;
    return { titles: parsed.titles, tab: parsed.tab, rows: parsed.rows };
  } catch {
    return null;
  }
}

export function saveLogCache(cache: LogTabCache): void {
  try {
    localStorage.setItem(LOG_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // Ein voller localStorage darf das Eintragen nicht anhalten.
  }
}
