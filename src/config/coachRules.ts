/**
 * Parameter des Regelwerks Zweitmeinung (Phase 21, ADR 0011).
 *
 * Einzige Stelle fuer Schwellen und Faktoren der Regeln unter `src/coach/`.
 * Dort steht kein Zahlenliteral fuer eine Schwelle, ein Test prueft das.
 * Herleitung und Quelle je Kennung: `docs/coach-regeln.md`. Persoenliche
 * Zielwerte stehen nicht hier, sie kommen aus dem Sheet.
 */
export const COACH_RULES = {
  DAYS_PER_WEEK: 7,
  MS_PER_DAY: 864e5,

  // A2 Stillstand
  /** Wochen ohne Bewegung im Wochenmittel, ab denen reagiert wird. */
  STALL_WEEKS: 3,
  /** Tage je Woche mit Waegung, damit ein Wochenmittel gilt. */
  STALL_MIN_WEIGH_INS_PER_WEEK: 4,
  /** Zulaessige Ueberschreitung der Kalorienvorgabe, damit ein Tag als getroffen gilt. */
  KCAL_TOLERANCE_PCT: 5,

  // A3 Schrittweite
  /** Groesste Kalorienaenderung je Anpassung. */
  KCAL_STEP: 150,

  // A4 FFMI
  FFMI_REFERENCE_HEIGHT_M: 1.8,
  FFMI_HEIGHT_CORRECTION: 6.1,
  /** Hoechstalter einer Koerperfettmessung in Tagen. */
  BODY_MAX_AGE_DAYS: 42,

  // A5 Phase
  /** Unter diesem FFMI gilt die Muskelmasse als gering. */
  FFMI_LOW_BELOW: 18,
  /** Ab diesem FFMI gilt die Muskelmasse als entwickelt. Eigene Annahme. */
  FFMI_DEVELOPED_FROM: 21,
  BF_LEAN_BELOW_PCT: 10,
  BF_DEVELOPED_HOLD_MAX_PCT: 12,
  BF_MID_FROM_PCT: 14,
  BF_HIGH_ABOVE_PCT: 17,
  /** Oberhalb davon beginnt kein Aufbau. */
  BULK_START_MAX_BF_PCT: 15,
  /** Der Aufbau endet hier. */
  BULK_STOP_BF_PCT: 17,
  /** Ziel eines Cuts fuer entwickelte Muskelmasse. */
  CUT_TARGET_BF_PCT: 12,

  // A6 Reverse
  /** Anteil des Defizits, der im ersten Schritt zurueckkommt. */
  REVERSE_FIRST_STEP_SHARE: 0.5,
  REVERSE_WEEKLY_STEP_KCAL: 125,
  REVERSE_END_SURPLUS_KCAL: 100,
  REVERSE_MAX_WEEKS: 12,

  // B Makros
  KCAL_PER_G_PROTEIN: 4,
  KCAL_PER_G_CARBS: 4,
  KCAL_PER_G_FAT: 9,
  PROTEIN_G_PER_KG_DEFICIT: 2.2,
  PROTEIN_G_PER_KG_SURPLUS: 1.6,
  /** Boden fuer Protein an jedem Tagestyp. */
  PROTEIN_FLOOR_G_PER_KG: 1.6,
  /** Faktor auf das Protein am Low Day. */
  LOW_DAY_PROTEIN_FACTOR: 1.1,
  /** Faktor auf das Protein am High Day. */
  HIGH_DAY_PROTEIN_FACTOR: 0.8,
  LOW_DAY_CARBS_G_PER_KG: 1,
  LOW_DAY_FAT_G: 60,
  MEDIUM_DAY_FAT_G: 50,
  HIGH_DAY_FAT_G: 45,
  /** Carbs am High Day als Vielfaches des Medium Day. */
  HIGH_DAY_CARBS_FACTOR: 2,
  /** Boden fuer Fett an jedem Tagestyp. */
  FAT_FLOOR_G: 45,
  HIGH_DAYS_PER_WEEK_CUT: 1,
  HIGH_DAYS_PER_WEEK_BULK: 2,
  /** Fenster fuer die Zaehlung der Trainingstage je Woche. */
  DAY_TYPE_WINDOW_DAYS: 28,
  /** Tage mit Eintrag in `Trainingday`, damit die Zaehlung gilt. */
  DAY_TYPE_MIN_DAYS: 14,

  // C Training
  TRAINING_WINDOW_WEEKS: 4,
  TRAINING_MIN_WEEKS: 2,
  FREQUENCY_TARGET_PER_WEEK: 2,
  /** Wochen in Folge ohne neuen Bestwert, ab denen eine Uebung als stehend gilt. */
  PROGRESSION_STALL_WEEKS: 3,
  /** Rueckgang des geschaetzten 1RM, ab dem eine Uebung als ruecklaeufig gilt. */
  REGRESSION_PCT: 2.5,
  /** Untergrenze der Wochensaetze je Muskelgruppe. Eigene Annahme. */
  MIN_WEEKLY_SETS: 6,
  /** Anteil ruecklaeufiger Uebungen, ab dem ein Deload Signal moeglich ist. */
  DELOAD_REGRESSION_SHARE: 0.3,
  DELOAD_MIN_EXERCISES: 4,

  // D Erholung
  SLEEP_MIN_H: 7,
  SLEEP_MAX_H: 9,
  SLEEP_WINDOW_DAYS: 7,
  SLEEP_MIN_DAYS: 5,
  SLEEP_SPREAD_WINDOW_DAYS: 14,
  SLEEP_SPREAD_MIN_DAYS: 10,
  /** Standardabweichung der Schlafdauer in Stunden, darueber unregelmaessig. Eigene Annahme. */
  SLEEP_SPREAD_MAX_H: 1,
  /** Rueckgang des Energylevel im Wochenvergleich, ab dem er als fallend gilt. Eigene Annahme. */
  ENERGY_DROP: 0.5,
} as const;

export type CoachRules = typeof COACH_RULES;
