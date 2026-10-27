/**
 * Entwurf der Eingaben, sofort im localStorage, je Tab, Woche und Tag.
 *
 * Ein Neustart der App oder ein Funkloch im Studio verliert nichts. Nach einem
 * Senden wird der Entwurf des Tags geleert.
 */

const DRAFT_KEY = 'fitness_log_draft_v1';

/** Felder, die die App schreiben darf (ADR 0007). */
export const LOG_FIELDS = ['load', 'repsActual', 'notes'] as const;
export type LogField = (typeof LOG_FIELDS)[number];

export type EntryDraft = Partial<Record<LogField, string>>;
export type DayDraft = Record<string, EntryDraft>;

export function draftKey(sheet: string, week: number, day: string): string {
  return `${sheet}|${week}|${day}`;
}

export function entryKey(name: string, occurrence: number): string {
  return `${name}#${occurrence}`;
}

function readAll(): Record<string, DayDraft> {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    return raw ? (JSON.parse(raw) as Record<string, DayDraft>) : {};
  } catch {
    return {};
  }
}

function writeAll(all: Record<string, DayDraft>): void {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(all));
  } catch {
    // Ein voller localStorage darf die Eingabe nicht anhalten.
  }
}

export function loadDraft(key: string): DayDraft {
  return readAll()[key] ?? {};
}

/** Setzt ein Feld, leerer Text entfernt es. Leere Eintraege und Tage fallen weg. */
export function saveField(key: string, entry: string, field: LogField, value: string): void {
  const all = readAll();
  const day = all[key] ?? {};
  const fields = { ...day[entry] };
  if (value.trim()) fields[field] = value;
  else delete fields[field];
  if (Object.keys(fields).length) day[entry] = fields;
  else delete day[entry];
  if (Object.keys(day).length) all[key] = day;
  else delete all[key];
  writeAll(all);
}

export function clearDraft(key: string): void {
  const all = readAll();
  delete all[key];
  writeAll(all);
}
