import { isValidEndpoint } from './logAccess';

/**
 * Endpunkt URL und Token des Apps Script des Logbuchs (ADR 0010).
 *
 * Eigener localStorage Schluessel, getrennt vom Zugang fuer Mesocycle Tabs
 * (`fitness_log_access_v1`). Beides liegt nur im Browser, nie im Repository.
 */

const LOGBOOK_ACCESS_KEY = 'fitness_logbook_access_v1';

export interface LogbookAccess {
  endpoint: string;
  token: string;
}

export function getLogbookAccess(): LogbookAccess | null {
  try {
    const raw = localStorage.getItem(LOGBOOK_ACCESS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<LogbookAccess>;
    if (typeof parsed.endpoint !== 'string' || typeof parsed.token !== 'string') return null;
    if (!isValidEndpoint(parsed.endpoint) || !parsed.token) return null;
    return { endpoint: parsed.endpoint, token: parsed.token };
  } catch {
    return null;
  }
}

/** Beide leer entfernt den Zugang. */
export function saveLogbookAccess(endpoint: string, token: string): void {
  try {
    if (!endpoint && !token) localStorage.removeItem(LOGBOOK_ACCESS_KEY);
    else localStorage.setItem(LOGBOOK_ACCESS_KEY, JSON.stringify({ endpoint, token }));
  } catch {
    // Ein gesperrter localStorage darf die Einstellungen nicht anhalten.
  }
}
