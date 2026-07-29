/**
 * Zielwerte, die nirgends im Sheet stehen.
 *
 * Derzeit genau einer: das Zielgewicht. Alles andere kommt aus dem Vorgabeblock
 * des Trainers, siehe `src/parse/goals.ts`. Bewusst ein eigener
 * localStorage Schluessel, damit ein Zuruecksetzen der Ziele nicht die
 * Zugangsdaten mitnimmt.
 */

const TARGETS_KEY = 'fitness_targets_v1';

export interface Targets {
  /** Zielgewicht in kg. Fehlt es, bleibt die Zielprojektion aus. */
  targetWeightKg: number | null;
}

const EMPTY: Targets = { targetWeightKg: null };

export function getTargets(): Targets {
  try {
    const raw = localStorage.getItem(TARGETS_KEY);
    if (!raw) return { ...EMPTY };
    const parsed = JSON.parse(raw) as Partial<Targets>;
    const value = parsed.targetWeightKg;
    return { targetWeightKg: typeof value === 'number' && Number.isFinite(value) ? value : null };
  } catch {
    return { ...EMPTY };
  }
}

export function saveTargets(targets: Targets): void {
  localStorage.setItem(TARGETS_KEY, JSON.stringify(targets));
}
