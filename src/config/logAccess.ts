/**
 * Endpunkt URL und Token des Apps Script fuer Training eintragen (ADR 0007).
 *
 * Beides liegt nur im localStorage, getrennt von den Google Zugangsdaten. Ohne
 * beide Werte gibt es kein Segment `Eintragen`.
 */

const LOG_ACCESS_KEY = 'fitness_log_access_v1';

/** Nur Web Apps von Apps Script, damit kein Token an eine fremde Adresse geht. */
const ENDPOINT_PREFIX = 'https://script.google.com/';

export interface LogAccess {
  endpoint: string;
  token: string;
}

export function isValidEndpoint(endpoint: string): boolean {
  return endpoint.startsWith(ENDPOINT_PREFIX);
}

export function getLogAccess(): LogAccess | null {
  try {
    const raw = localStorage.getItem(LOG_ACCESS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<LogAccess>;
    if (typeof parsed.endpoint !== 'string' || typeof parsed.token !== 'string') return null;
    if (!isValidEndpoint(parsed.endpoint) || !parsed.token) return null;
    return { endpoint: parsed.endpoint, token: parsed.token };
  } catch {
    return null;
  }
}

/** Beide leer entfernt den Zugang. */
export function saveLogAccess(endpoint: string, token: string): void {
  try {
    if (!endpoint && !token) localStorage.removeItem(LOG_ACCESS_KEY);
    else localStorage.setItem(LOG_ACCESS_KEY, JSON.stringify({ endpoint, token }));
  } catch {
    // Ein gesperrter localStorage darf die Einstellungen nicht anhalten.
  }
}
