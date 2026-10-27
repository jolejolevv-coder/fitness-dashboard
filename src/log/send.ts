import type { LogAccess } from '../config/logAccess';
import { entryKey, LOG_FIELDS, type DayDraft, type LogField } from './draft';
import type { LogExercise } from './tab';

/**
 * Anfrage an das Apps Script und Lesen der Antwort (ADR 0007,
 * `apps-script/README.md`, Abschnitt Antworten).
 */

/** Hoechstlaengen wie im Script. */
export const MAX_LENGTH: Readonly<Record<LogField, number>> = { load: 20, repsActual: 40, notes: 200 };

export interface LogEntry {
  exercise: string;
  occurrence: number;
  load?: string;
  repsActual?: string;
  notes?: string;
}

export interface LogRequest {
  token: string;
  action: 'training';
  sheet: string;
  week: number;
  day: string;
  entries: LogEntry[];
}

export interface EntryResult {
  exercise: string;
  occurrence: number;
  status?: Partial<Record<LogField, string>>;
  error?: string;
}

/** `readable: false`, wenn der Browser die Antwort nicht lesen darf (CORS). */
export type LogResponse =
  | { readable: true; ok: true; results: EntryResult[] }
  | { readable: true; ok: false; error: string }
  | { readable: false };

/** Zelle im Sheet schon belegt: das Feld ist gesperrt und wird nie gesendet. */
export function isLocked(exercise: LogExercise, field: LogField): boolean {
  const value = exercise[field];
  return value === null || value !== '';
}

/**
 * Eintraege aus dem Entwurf: nur Felder, deren Zelle leer ist, nur nicht leere
 * Werte. Uebungen ohne ein solches Feld fallen weg.
 */
export function buildEntries(exercises: readonly LogExercise[], draft: DayDraft): LogEntry[] {
  const entries: LogEntry[] = [];
  for (const exercise of exercises) {
    const fields = draft[entryKey(exercise.name, exercise.occurrence)] ?? {};
    const entry: LogEntry = { exercise: exercise.name, occurrence: exercise.occurrence };
    let filled = false;
    for (const field of LOG_FIELDS) {
      const value = (fields[field] ?? '').trim().slice(0, MAX_LENGTH[field]);
      if (!value || isLocked(exercise, field)) continue;
      entry[field] = value;
      filled = true;
    }
    if (filled) entries.push(entry);
  }
  return entries;
}

/**
 * Ohne Content Type schickt der Browser einen String als `text/plain`, das
 * ist eine einfache Anfrage ohne Preflight, die Apps Script annimmt.
 */
export async function sendLog(access: LogAccess, request: LogRequest): Promise<LogResponse> {
  let response: Response;
  try {
    response = await fetch(access.endpoint, { method: 'POST', body: JSON.stringify(request), redirect: 'follow' });
  } catch (error) {
    // Ohne Zugriff auf die Antwort meldet fetch einen TypeError, ob die Anfrage
    // ankam, ist offen. Offline ist der Knopf ohnehin gesperrt.
    if (error instanceof TypeError) return { readable: false };
    throw error;
  }
  const body = (await response.json()) as { ok?: boolean; results?: EntryResult[]; error?: string };
  if (body.ok === true && Array.isArray(body.results)) return { readable: true, ok: true, results: body.results };
  return { readable: true, ok: false, error: typeof body.error === 'string' ? body.error : 'bad_response' };
}
