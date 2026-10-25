import type { Meal, PrepSession, Rotation } from '../nutrition/types';
import { SLOTS, WEEKDAYS } from '../nutrition/types';
import type { Proposal } from './response';

/**
 * Export eines Vorschlags als die drei Plandateien unter `data/`. Gleiche Form
 * und Formatierung wie die Seed Dateien, damit ein Commit nur echte Aenderungen
 * zeigt. Reine Funktion, das Herunterladen macht die Oberflaeche.
 */

export interface ExportFile {
  name: string;
  content: string;
}

export const EXPORT_FILE_NAMES = { meals: 'meals.json', rotation: 'rotation.json', prep: 'prep.json' } as const;

const JSON_INDENT = 2;

function serialize(data: unknown): string {
  return `${JSON.stringify(data, null, JSON_INDENT)}\n`;
}

/** Feldreihenfolge wie in `data/meals.json`. Vorschlaege kennen kein `addToSlot`. */
function exportMeal(meal: Meal): Meal {
  return {
    id: meal.id,
    slot: meal.slot,
    name: meal.name,
    ingredients: meal.ingredients.map((ing) => ({ foodId: ing.foodId, grams: ing.grams })),
  };
}

/** Tage und Slots in fester Reihenfolge, unabhaengig von der Reihenfolge der Antwort. */
function exportRotation(rotation: Rotation): Rotation {
  return Object.fromEntries(
    WEEKDAYS.map((day) => [day, Object.fromEntries(SLOTS.map((slot) => [slot, rotation[day][slot]]))]),
  ) as Rotation;
}

function exportPrep(prep: readonly PrepSession[]): PrepSession[] {
  return prep.map((session) => ({
    id: session.id,
    title: session.title,
    steps: session.steps.map((step) => ({
      title: step.title,
      device: step.device,
      covers: step.covers.map((cover) => ({
        slot: cover.slot,
        days: [...cover.days],
        meals: [...cover.meals],
        ...(cover.foods ? { foods: [...cover.foods] } : {}),
      })),
    })),
  }));
}

export function exportPlanFiles(proposal: Pick<Proposal, 'meals' | 'rotation' | 'prep'>): ExportFile[] {
  return [
    { name: EXPORT_FILE_NAMES.meals, content: serialize(proposal.meals.map(exportMeal)) },
    { name: EXPORT_FILE_NAMES.rotation, content: serialize(exportRotation(proposal.rotation)) },
    { name: EXPORT_FILE_NAMES.prep, content: serialize(exportPrep(proposal.prep)) },
  ];
}
