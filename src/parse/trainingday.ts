/**
 * Liest die Spalte `Trainingday` des Daily Tracking.
 *
 * Erwartetes Format ist `D1 W1 M1`, also Trainingstag, Woche, Mesozyklus. In der
 * Praxis steht dort ausserdem `Rest`, mal Gross mal Klein geschrieben, mit
 * einfachen und doppelten Leerzeichen, gelegentlich mit Tippfehlern wie
 * `d1 w w5 m3`, und an drei Tagen eine freie Notiz.
 *
 * Deshalb drei Kategorien statt zwei. Was nicht eindeutig ist, wird als
 * `unknown` gefuehrt und aus Auswertungen herausgehalten, statt es zu raten.
 * Die urspruengliche Fassung zaehlte jeden nicht leeren Eintrag als Training,
 * also auch `Rest` und jede Notiz.
 */

export type TrainingKind = 'training' | 'rest' | 'unknown';

export interface TrainingMarker {
  kind: TrainingKind;
  /** Trainingstag innerhalb der Woche, aus `D1`. */
  day: number | null;
  /** Woche innerhalb des Mesozyklus, aus `W1`. */
  week: number | null;
  /** Mesozyklus, aus `M1`. */
  mesocycle: number | null;
  raw: string;
}

/** Toleriert beliebige Leerzeichen und wiederholte Buchstaben wie in `w w5`. */
const MARKER = /\bd\s*(\d+)\b.*?\bw+\s*(?:w\s*)?(\d+)\b.*?\bm\s*(\d+)\b/i;

/** Nur der Tagesteil, falls Woche oder Mesozyklus fehlen. */
const DAY_ONLY = /^\s*d\s*(\d+)\b/i;

const REST_VALUES = new Set(['rest', 'ruhetag', 'off']);

const EMPTY_VALUES = new Set(['', '-']);

export function parseTrainingMarker(raw: string | undefined | null): TrainingMarker {
  const text = (raw ?? '').trim();
  const empty: TrainingMarker = { kind: 'unknown', day: null, week: null, mesocycle: null, raw: text };

  if (EMPTY_VALUES.has(text)) return { ...empty, kind: 'rest' };
  if (REST_VALUES.has(text.toLowerCase())) return { ...empty, kind: 'rest' };

  const full = MARKER.exec(text);
  if (full) {
    return {
      kind: 'training',
      day: Number(full[1]),
      week: Number(full[2]),
      mesocycle: Number(full[3]),
      raw: text,
    };
  }

  const dayOnly = DAY_ONLY.exec(text);
  if (dayOnly) return { ...empty, kind: 'training', day: Number(dayOnly[1]) };

  // Freitext in der Trainingsspalte. Weder Training noch Ruhetag belegt.
  return empty;
}

/** Zustand des Trainings zum juengsten datierten Marker, Zukunft ausgenommen. */
export interface TrainingPosition {
  mesocycle: number;
  week: number;
  date: Date;
}

export function latestPosition(
  entries: readonly { dateObj: Date | null; training: string }[],
  now: Date = new Date(),
): TrainingPosition | null {
  let best: TrainingPosition | null = null;

  for (const entry of entries) {
    if (!entry.dateObj || entry.dateObj > now) continue;
    const marker = parseTrainingMarker(entry.training);
    if (marker.kind !== 'training' || marker.week === null || marker.mesocycle === null) continue;
    if (!best || entry.dateObj > best.date) {
      best = { mesocycle: marker.mesocycle, week: marker.week, date: entry.dateObj };
    }
  }

  return best;
}
