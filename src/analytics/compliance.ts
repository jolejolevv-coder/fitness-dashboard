import type { DailyEntry } from '../types';

/**
 * Compliance und Serien.
 *
 * Compliance wird durchgehend als getroffene von erfassten Tagen gefuehrt, nicht
 * als blosser Prozentwert. `24 von 28` traegt die Datenbasis mit, `86 Prozent`
 * verliert sie.
 */

export interface Compliance {
  hit: number;
  recorded: number;
  /** Prozentwert, nur zur Einfaerbung. Null, wenn nichts erfasst ist. */
  pct: number | null;
}

export type Picker = (entry: DailyEntry) => number | null;
export type Predicate = (value: number) => boolean;

export function complianceOf(
  entries: readonly DailyEntry[],
  pick: Picker,
  hit: Predicate,
): Compliance {
  const recorded = entries.filter((e) => pick(e) !== null);
  const hits = recorded.filter((e) => hit(pick(e)!));
  return {
    hit: hits.length,
    recorded: recorded.length,
    pct: recorded.length ? Math.round((hits.length / recorded.length) * 100) : null,
  };
}

export interface Streak {
  /** Laufende Serie bis zum juengsten erfassten Tag. */
  current: number;
  /** Laengste Serie im Zeitraum. */
  best: number;
  /** Tage ohne erfassten Wert, die weder verlaengert noch gebrochen haben. */
  gaps: number;
}

/**
 * Serien getroffener Tage.
 *
 * Ein Tag ohne erfassten Wert bricht die Serie nicht, verlaengert sie aber auch
 * nicht. Er wird als Luecke gezaehlt. Alles andere waere entweder unfair, wenn
 * ein vergessener Eintrag eine Serie beendet, oder geschoent, wenn er sie
 * fortsetzt.
 */
export function streakOf(
  entries: readonly DailyEntry[],
  pick: Picker,
  hit: Predicate,
): Streak {
  const sorted = [...entries]
    .filter((e) => e.dateObj)
    .sort((a, b) => a.dateObj!.getTime() - b.dateObj!.getTime());

  let current = 0;
  let best = 0;
  let gaps = 0;

  for (const entry of sorted) {
    const value = pick(entry);
    if (value === null) {
      gaps++;
      continue;
    }
    if (hit(value)) {
      current++;
      best = Math.max(best, current);
    } else {
      current = 0;
    }
  }

  return { current, best, gaps };
}
