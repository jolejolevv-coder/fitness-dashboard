/**
 * Tabliste fuer die Mesocycle Chips im Segment `Eintragen` (Phase 13.6).
 *
 * Der gewaehlte Tab selbst ist der Trainingstab der Zugangsdaten und gilt fuer
 * Eintragen und Auswertung. Der Cache haelt nur die Tabliste, damit die Chips
 * offline stehen bleiben.
 */

const LOG_CACHE_KEY = 'fitness_log_cache_v1';

/** Gewaehlter Tab aus der ersten Fassung von 13.6, wird einmal uebernommen. */
const LEGACY_LOG_TAB_KEY = 'fitness_log_tab_v1';

export interface LogTabCache {
  titles: string[];
}

export function loadLogCache(): LogTabCache | null {
  try {
    const raw = localStorage.getItem(LOG_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<LogTabCache>;
    if (!Array.isArray(parsed.titles)) return null;
    return { titles: parsed.titles.filter((title): title is string => typeof title === 'string') };
  } catch {
    return null;
  }
}

export function saveLogCache(cache: LogTabCache): void {
  try {
    localStorage.setItem(LOG_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // Ein voller localStorage kostet nur die Chips offline.
  }
}

/** Liest die alte Wahl und entfernt sie, damit sie nur einmal greift. */
export function takeLegacyLogTab(): string | null {
  try {
    const tab = localStorage.getItem(LEGACY_LOG_TAB_KEY);
    localStorage.removeItem(LEGACY_LOG_TAB_KEY);
    return tab;
  } catch {
    return null;
  }
}
