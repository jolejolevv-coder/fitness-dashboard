import type { DayGoals, Goals } from '../parse/goals';

/** Felder, die `parseGoals` bei Fehlen mit einem Rueckfallwert fuellt und unter `missing` meldet. */
const DAY_GOAL_FIELDS: readonly (keyof DayGoals)[] = [
  'proteinG', 'carbsG', 'fatG', 'fiberG', 'caloriesKcal', 'proteinFeedings', 'steps',
];

/** Marker in `Goals.missing`, bei denen der ganze Block nicht aus dem Sheet stammt. */
const WHOLE_BLOCK_MISSING = ['Vorgabeblock', 'Zeile Average'] as const;

/**
 * Tagesziele fuer den Plan, ohne Ersatzwerte.
 *
 * `parseGoals` setzt fehlende Werte auf Rueckfallwerte, damit die anderen Reiter
 * nicht leer bleiben. Der Plan zeigt solche Werte nie als Ziel: ein Feld, das
 * nicht aus dem Sheet gelesen wurde, ist hier `null`. Ohne Sheet Daten gibt es
 * gar keine Ziele.
 */
export function sheetDayGoals(goals: Goals | null): DayGoals | null {
  if (!goals) return null;
  if (goals.missing.some((m) => (WHOLE_BLOCK_MISSING as readonly string[]).includes(m))) return null;

  const result: DayGoals = { ...goals.average };
  for (const field of DAY_GOAL_FIELDS) {
    if (goals.missing.includes(field)) result[field] = null;
  }
  return result;
}
