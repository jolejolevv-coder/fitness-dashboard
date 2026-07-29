/**
 * Zaehlt lokal, welcher Tab wie oft geoeffnet wurde.
 *
 * Zweck ist eine spaetere Entscheidung auf Datenbasis, welche Ansichten nie
 * benutzt werden und gekuerzt werden koennen. Die Zahlen bleiben im Browser und
 * werden nirgendwohin uebertragen.
 */

const USAGE_KEY = 'fitness_usage_v1';

export type Usage = Record<string, number>;

export function getUsage(): Usage {
  try {
    const raw = localStorage.getItem(USAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== 'object' || parsed === null) return {};
    const result: Usage = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value === 'number' && Number.isFinite(value)) result[key] = value;
    }
    return result;
  } catch {
    return {};
  }
}

export function countTabOpened(name: string): void {
  try {
    const usage = getUsage();
    usage[name] = (usage[name] ?? 0) + 1;
    localStorage.setItem(USAGE_KEY, JSON.stringify(usage));
  } catch {
    // Ein voller localStorage darf die Bedienung nicht stoeren.
  }
}

export function resetUsage(): void {
  localStorage.removeItem(USAGE_KEY);
}
