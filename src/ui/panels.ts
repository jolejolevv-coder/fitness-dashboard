import type { DailyEntry } from '../types';
import type { Goals } from '../parse/goals';
import { avg } from '../analytics/smoothing';
import { byId, COLORS } from './dom';
import { el } from './build';
import { card, refusalCard, valueNode } from './cards';
import { decimal, integer, target as formatTarget } from './format';
import type { Charts } from './charts';

/**
 * Zwei Darstellungen, die keine gewoehnlichen Diagramme sind.
 *
 * Zielbereiche zeigen, wo der Schnitt gegen sein Ziel liegt: eine Karte je
 * Wert, der Balken fuellt bis zum Schnitt, die Marke sitzt auf dem Ziel.
 *
 * Verlaufsminiaturen zeigen die Form eines Verlaufs unter der Zahl, ohne ein
 * eigenes Koordinatensystem dafuer zu bauen.
 */

/** Wie weit die Skala ueber den Zielwert hinausreicht. */
const SCALE_HEADROOM = 1.6;

interface RangeSpec {
  name: string;
  values: (number | null)[];
  target: number | null;
  unit: string;
  /** `atLeast` trifft ab dem Ziel, `atMost` bis zum Ziel. */
  direction: 'atLeast' | 'atMost';
}

function pct(value: number, max: number): number {
  return Math.max(0, Math.min(100, (value / max) * 100));
}

/** Gruen getroffen, rot daneben, wie die Abweichung auf Heute. */
function toneOf(spec: RangeSpec, actual: number, goal: number): string {
  const hit = spec.direction === 'atLeast' ? actual >= goal : actual <= goal;
  return hit ? 'is-ok' : 'is-off';
}

function rangeCard(spec: RangeSpec): HTMLElement {
  const recorded = spec.values.filter((v) => v !== null).length;
  const actual = avg(spec.values);
  if (actual === null) return refusalCard(spec.name, 'Keine Werte erfasst');
  if (spec.target === null || spec.target <= 0) return refusalCard(spec.name, 'Keine Zielwerte gelesen');

  const max = spec.target * SCALE_HEADROOM;
  const fill = el('span');
  fill.style.width = `${pct(actual, max)}%`;
  const goalMark = el('i');
  goalMark.style.left = `${pct(spec.target, max)}%`;

  const element = card(
    `Ø ${spec.name}`,
    valueNode(integer(actual), spec.unit, toneOf(spec, actual, spec.target)),
    [`Ziel ${formatTarget(spec.target)}${spec.unit ? ` ${spec.unit}` : ''}`, `Basis ${integer(recorded)} Tage`],
  );
  element.append(el('div', { class: 'bar' }, [fill, goalMark]));
  return element;
}

export function renderNutritionRanges(daily: readonly DailyEntry[], goals: Goals): void {
  const container = byId('nutrition-ranges');
  if (!container) return;

  const target = goals.average;
  const specs: RangeSpec[] = [
    { name: 'Kalorien', values: daily.map((e) => e.calories), target: target.caloriesKcal, unit: 'kcal', direction: 'atMost' },
    { name: 'Protein', values: daily.map((e) => e.protein), target: target.proteinG, unit: 'g', direction: 'atLeast' },
    { name: 'Kohlenhydrate', values: daily.map((e) => e.carbs), target: target.carbsG, unit: 'g', direction: 'atMost' },
    { name: 'Fett', values: daily.map((e) => e.fat), target: target.fatG, unit: 'g', direction: 'atMost' },
    { name: 'Ballaststoffe', values: daily.map((e) => e.fiber), target: target.fiberG, unit: 'g', direction: 'atLeast' },
  ];

  container.replaceChildren(...specs.map(rangeCard));
}

interface SparkSpec {
  id: string;
  name: string;
  values: (number | null)[];
  unit?: string;
}

export function renderWellnessSparks(charts: Charts, daily: readonly DailyEntry[]): void {
  const container = byId('wellness-sparks');
  if (!container) return;

  const specs: SparkSpec[] = [
    { id: 'spark-sleep', name: 'Schlaf in Stunden', values: daily.map((e) => e.sleep), unit: 'h' },
    { id: 'spark-sleepq', name: 'Schlafqualität', values: daily.map((e) => e.sleepQ) },
    { id: 'spark-energy', name: 'Energie', values: daily.map((e) => e.energy) },
    { id: 'spark-stress', name: 'Stress', values: daily.map((e) => e.stress) },
  ];

  const drawn: SparkSpec[] = [];
  container.replaceChildren(...specs.map((spec) => {
    const mean = avg(spec.values);
    if (mean === null) return refusalCard(`Ø ${spec.name}`, 'Keine Werte erfasst');

    drawn.push(spec);
    const recorded = spec.values.filter((v) => v !== null).length;
    const element = card(`Ø ${spec.name}`, valueNode(decimal(mean, 1), spec.unit), `Basis ${integer(recorded)} Tage`);
    element.append(el('div', { class: 'spark-canvas' }, [el('canvas', { attrs: { id: spec.id } })]));
    return element;
  }));

  // Erst zeichnen, wenn die Canvas im Dokument haengen.
  for (const spec of drawn) charts.sparkline(spec.id, spec.values, COLORS.ink);
}
