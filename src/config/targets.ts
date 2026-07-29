/**
 * Zielwerte, die nirgends im Sheet stehen.
 *
 * Derzeit genau einer: das Zielgewicht. Alles andere kommt aus dem Vorgabeblock
 * des Trainers, siehe `src/parse/goals.ts`. Bewusst ein eigener
 * localStorage Schluessel, damit ein Zuruecksetzen der Ziele nicht die
 * Zugangsdaten mitnimmt.
 */

const TARGETS_KEY = 'fitness_targets_v1';

/**
 * Zielgewicht, solange nichts gespeichert wurde.
 *
 * Steht hier, weil es die einzige Groesse ist, die weder im Sheet steht noch
 * sich ableiten laesst, und weil ein Dashboard ohne Zielgewicht die halbe
 * Analyse dunkel laesst. Wer im Einstellungsdialog das Feld leert, speichert
 * damit ausdruecklich "kein Ziel" und bekommt keine Projektion mehr.
 */
export const DEFAULT_TARGET_WEIGHT_KG = 82;

export interface Targets {
  /** Zielgewicht in kg. Null bedeutet ausdruecklich kein Ziel. */
  targetWeightKg: number | null;
}

export function getTargets(): Targets {
  try {
    const raw = localStorage.getItem(TARGETS_KEY);
    // Noch nie gespeichert: Vorgabe verwenden, nicht "kein Ziel".
    if (raw === null) return { targetWeightKg: DEFAULT_TARGET_WEIGHT_KG };

    const parsed = JSON.parse(raw) as Partial<Targets>;
    const value = parsed.targetWeightKg;
    return { targetWeightKg: typeof value === 'number' && Number.isFinite(value) ? value : null };
  } catch {
    return { targetWeightKg: DEFAULT_TARGET_WEIGHT_KG };
  }
}

export function saveTargets(targets: Targets): void {
  localStorage.setItem(TARGETS_KEY, JSON.stringify(targets));
}
