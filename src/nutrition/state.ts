import type { Overrides } from './rotation';
import type { Slot, Weekday } from './types';
import { SLOTS, WEEKDAYS } from './types';

/**
 * Lokaler Zustand der Reiter Plan und Einkauf.
 *
 * Alles bleibt im Browser dieses Geraets. Parsen und Serialisieren sind reine
 * Funktionen, der Zugriff auf `localStorage` sitzt in `readStorage` und
 * `writeStorage` und faengt jeden Fehler ab, damit die Seite auch ohne Speicher
 * funktioniert (privater Modus, voller Speicher).
 */

export const OVERRIDES_KEY = 'fitness_plan_overrides_v1';
export const PREP_DONE_KEY = 'fitness_prep_done_v1';
export const SHOPPING_DONE_KEY = 'fitness_shopping_done_v1';

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

/** Liest gespeicherte Overrides. Unbrauchbares wird verworfen, nie geraten. */
export function parseOverrides(raw: string | null): Overrides {
  const data = parseJson(raw);
  if (!isRecord(data)) return { swaps: {}, bar: {} };

  const swaps: Overrides['swaps'] = {};
  const rawSwaps = data['swaps'];
  if (isRecord(rawSwaps)) {
    for (const day of WEEKDAYS) {
      const perDay = rawSwaps[day];
      if (!isRecord(perDay)) continue;
      for (const slot of SLOTS) {
        const mealId = perDay[slot];
        if (typeof mealId === 'string' && mealId !== '') {
          const entry: Partial<Record<Slot, string>> = swaps[day] ?? {};
          entry[slot] = mealId;
          swaps[day] = entry;
        }
      }
    }
  }

  const bar: Overrides['bar'] = {};
  const rawBar = data['bar'];
  if (isRecord(rawBar)) {
    for (const day of WEEKDAYS) {
      if (rawBar[day] === true) bar[day] = true;
    }
  }
  return { swaps, bar };
}

export function serializeOverrides(overrides: Overrides): string {
  return JSON.stringify(overrides);
}

/** Setzt oder loescht einen Tausch. `mealId` null stellt den Standard wieder her. */
export function withSwap(overrides: Overrides, day: Weekday, slot: Slot, mealId: string | null): Overrides {
  const perDay: Partial<Record<Slot, string>> = { ...overrides.swaps[day] };
  if (mealId === null) delete perDay[slot];
  else perDay[slot] = mealId;
  const swaps = { ...overrides.swaps };
  if (Object.keys(perDay).length === 0) delete swaps[day];
  else swaps[day] = perDay;
  return { swaps, bar: overrides.bar };
}

export function withBar(overrides: Overrides, day: Weekday, active: boolean): Overrides {
  const bar = { ...overrides.bar };
  if (active) bar[day] = true;
  else delete bar[day];
  return { swaps: overrides.swaps, bar };
}

export function hasOverrides(overrides: Overrides): boolean {
  return Object.keys(overrides.swaps).length > 0 || Object.keys(overrides.bar).length > 0;
}

/** Abhakstatus als Menge von Schluesseln. */
export function parseChecked(raw: string | null): Set<string> {
  const data = parseJson(raw);
  if (!Array.isArray(data)) return new Set();
  return new Set(data.filter((entry): entry is string => typeof entry === 'string'));
}

export function serializeChecked(checked: ReadonlySet<string>): string {
  return JSON.stringify([...checked].sort());
}

export function toggled(checked: ReadonlySet<string>, key: string): Set<string> {
  const next = new Set(checked);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  return next;
}

export function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeStorage(key: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // Ohne Speicher laeuft die Seite weiter, der Zustand gilt dann nur bis zum Neuladen.
  }
}

export function loadOverrides(): Overrides {
  return parseOverrides(readStorage(OVERRIDES_KEY));
}

export function saveOverrides(overrides: Overrides): void {
  writeStorage(OVERRIDES_KEY, hasOverrides(overrides) ? serializeOverrides(overrides) : null);
}

export function loadChecked(key: string): Set<string> {
  return parseChecked(readStorage(key));
}

export function saveChecked(key: string, checked: ReadonlySet<string>): void {
  writeStorage(key, checked.size > 0 ? serializeChecked(checked) : null);
}
