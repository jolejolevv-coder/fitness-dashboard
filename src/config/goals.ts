/**
 * Zielwerte.
 *
 * PHASE 1: dieselben Zahlen wie bisher, aber an einer Stelle statt ueber die
 * Datei verstreut. In Phase 3 werden sie aus dem Vorgabeblock des Sheets
 * gelesen, siehe specs/features/goals.md. Bis dahin sind das die Rueckfallwerte.
 */
export const GOALS = {
  proteinG: 200,
  caloriesKcal: 2300,
  carbsG: 225,
  fatG: 60,
  /** Referenzlinie Schlaf in Stunden. */
  sleepH: 7,
  /** Referenzlinie Energie, Skala 1 bis 5. */
  energyRef: 3,
  /** Referenzlinie Stress, Skala 1 bis 5, niedriger ist besser. */
  stressRef: 3,
  /** Referenzlinie Verdauung. */
  digestionRef: 5,
} as const;

/** Schwellen fuer die Einfaerbung der Compliance Kacheln. */
export const COMPLIANCE_THRESHOLDS = { good: 80, fair: 60 } as const;
