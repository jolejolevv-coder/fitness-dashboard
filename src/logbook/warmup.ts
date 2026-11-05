import { num } from '../parse/num';
import type { PlanDay, PlanSettings } from '../parse/plan';
import type { LastSession } from '../parse/trainingSets';
import { formatKg } from './session';

/**
 * Aufwaermhinweis je Uebung (Phase 20.3).
 *
 * Stufen, Lastschritt, Regionen und Ausnahmen stammen aus `PlanSettings`. Die
 * erste Uebung des Tages bekommt die Stufen `warmup_first`, die erste Uebung
 * jeder weiteren Muskelregion die Stufe `warmup_region`. Fehlt eine Einstellung,
 * entfaellt der Hinweis.
 */

/** Wort statt Gewicht, wenn kein Arbeitsgewicht bekannt ist. Pro Stufe eins. */
const LOAD_WORDS = ['leicht', 'mittel', 'schwer'] as const;

export function regionOf(settings: PlanSettings, muscle: string): string {
  return settings.regions[muscle] ?? muscle;
}

/** Rundet auf den Lastschritt, nie unter einen Schritt. */
export function roundToStep(kg: number, step: number): number {
  return Math.max(step, Math.round(kg / step) * step);
}

/** Arbeitsgewicht: erster Satz der letzten Einheit, sonst `lastLoad` aus dem Plan. */
function referenceKg(last: LastSession | null, lastLoad: string): number | null {
  const fromLast = last?.sets[0]?.kg;
  if (fromLast !== undefined && fromLast > 0) return fromLast;
  const fromPlan = num(lastLoad);
  return fromPlan !== null && fromPlan > 0 ? fromPlan : null;
}

/** Text der Aufwaermzeile oder null, wenn die Uebung keinen Hinweis bekommt. */
export function warmupLine(settings: PlanSettings, day: PlanDay, index: number, last: LastSession | null): string | null {
  const exercise = day.exercises[index];
  if (!exercise) return null;
  const region = regionOf(settings, exercise.muscle);
  const firstInRegion = day.exercises.findIndex((e) => regionOf(settings, e.muscle) === region) === index;
  if (!firstInRegion || settings.noWarmupRegions.includes(region)) return null;

  const firstOfDay = index === 0;
  const steps = firstOfDay ? settings.warmupFirst : settings.warmupRegion ? [settings.warmupRegion] : [];
  if (!steps.length || settings.loadStep === null) return null;

  const kg = referenceKg(last, exercise.lastLoad);
  const parts = steps.map((step, i) => {
    const load = kg === null
      ? (LOAD_WORDS[i] ?? `Stufe ${i + 1}`)
      : `${formatKg(roundToStep(kg * step.factor, settings.loadStep!))} kg`;
    return `${load} × ${step.reps}`;
  });
  const count = steps.length === 1 ? '1 Satz' : `${steps.length} Sätze`;
  const body = kg === null ? `${count}: ${parts.join(', ')}` : parts.join(', ');
  return firstOfDay && steps.length > 1 ? `${body}, dann Arbeitssatz` : kg === null ? body : `${count} ${body}`;
}
