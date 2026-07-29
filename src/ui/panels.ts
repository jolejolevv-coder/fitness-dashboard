import type { DailyEntry } from '../types';
import type { Goals } from '../parse/goals';
import { avg } from '../analytics/smoothing';
import { sparkline } from '../charts/sparkline';
import { byId } from './dom';
import { decimal, EMPTY, integer, target as formatTarget } from './format';

/**
 * Zwei Darstellungen, die keine gewoehnlichen Diagramme sind.
 *
 * Zielbereiche zeigen, wo der Schnitt innerhalb einer erlaubten Spanne liegt.
 * Eine Prozentzahl allein sagt nicht, ob knapp daneben oder weit weg.
 *
 * Sparklines zeigen die Form eines Verlaufs neben der Zahl, ohne ein eigenes
 * Koordinatensystem dafuer zu bauen.
 */

/** Wie weit die Skala ueber den Zielwert hinausreicht. */
const SCALE_HEADROOM = 1.6;

/** Breite des gruenen Zielbereichs, als Anteil des Ziels. */
const ZONE_TOLERANCE = 0.1;

interface RangeSpec {
  name: string;
  actual: number | null;
  target: number | null;
  unit: string;
  /** `atLeast` faerbt oberhalb des Ziels gruen, `atMost` unterhalb. */
  direction: 'atLeast' | 'atMost';
}

function rangeRow(spec: RangeSpec): HTMLElement {
  const row = document.createElement('div');
  row.className = 'range-row';

  const head = document.createElement('div');
  head.className = 'range-head';

  const name = document.createElement('span');
  name.textContent = spec.name;

  const value = document.createElement('span');
  value.className = 'num';
  value.textContent = spec.actual === null
    ? EMPTY
    : `${integer(spec.actual)} ${spec.unit}${spec.target === null ? '' : ` von ${formatTarget(spec.target)} ${spec.unit}`}`;

  head.append(name, value);
  row.append(head);

  if (spec.actual === null || spec.target === null || spec.target <= 0) return row;

  const max = spec.target * SCALE_HEADROOM;
  const track = document.createElement('div');
  track.className = 'range-track';

  const zone = document.createElement('div');
  zone.className = 'range-zone';
  if (spec.direction === 'atLeast') {
    const from = (spec.target * (1 - ZONE_TOLERANCE)) / max;
    zone.style.left = `${from * 100}%`;
    zone.style.right = '0';
  } else {
    const to = (spec.target * (1 + ZONE_TOLERANCE)) / max;
    zone.style.left = '0';
    zone.style.right = `${(1 - to) * 100}%`;
  }

  const marker = document.createElement('div');
  marker.className = 'range-actual';
  marker.style.left = `${Math.max(0, Math.min(100, (spec.actual / max) * 100))}%`;

  track.append(zone, marker);

  const scale = document.createElement('div');
  scale.className = 'range-scale';
  const zero = document.createElement('span');
  zero.textContent = '0';
  const goal = document.createElement('span');
  goal.textContent = `Ziel ${formatTarget(spec.target)}`;
  const top = document.createElement('span');
  top.textContent = integer(max);
  scale.append(zero, goal, top);

  row.append(track, scale);
  return row;
}

export function renderNutritionRanges(daily: readonly DailyEntry[], goals: Goals): void {
  const container = byId('nutrition-ranges');
  if (!container) return;

  const target = goals.average;
  const specs: RangeSpec[] = [
    { name: 'Kalorien', actual: avg(daily.map((e) => e.calories)), target: target.caloriesKcal, unit: 'kcal', direction: 'atMost' },
    { name: 'Protein', actual: avg(daily.map((e) => e.protein)), target: target.proteinG, unit: 'g', direction: 'atLeast' },
    { name: 'Kohlenhydrate', actual: avg(daily.map((e) => e.carbs)), target: target.carbsG, unit: 'g', direction: 'atMost' },
    { name: 'Fett', actual: avg(daily.map((e) => e.fat)), target: target.fatG, unit: 'g', direction: 'atMost' },
    { name: 'Ballaststoffe', actual: avg(daily.map((e) => e.fiber)), target: target.fiberG, unit: 'g', direction: 'atLeast' },
  ];

  container.replaceChildren(...specs.map(rangeRow));
}

interface SparkSpec {
  id: string;
  name: string;
  values: (number | null)[];
  value: string;
  color: string;
}

export function renderWellnessSparks(daily: readonly DailyEntry[]): void {
  const container = byId('wellness-sparks');
  if (!container) return;

  const mean = (pick: (e: DailyEntry) => number | null, digits = 1): string => {
    const value = avg(daily.map(pick));
    return value === null ? EMPTY : decimal(value, digits);
  };

  const specs: SparkSpec[] = [
    { id: 'spark-sleep', name: 'Schlaf in Stunden', values: daily.map((e) => e.sleep), value: `${mean((e) => e.sleep)} h`, color: '#d6d2ca' },
    { id: 'spark-sleepq', name: 'Schlafqualität', values: daily.map((e) => e.sleepQ), value: mean((e) => e.sleepQ), color: '#d0a86b' },
    { id: 'spark-energy', name: 'Energie', values: daily.map((e) => e.energy), value: mean((e) => e.energy), color: '#7fb069' },
    { id: 'spark-stress', name: 'Stress', values: daily.map((e) => e.stress), value: mean((e) => e.stress), color: '#cf7d6b' },
  ];

  container.replaceChildren(...specs.map((spec) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'spark';

    const name = document.createElement('span');
    name.className = 'spark-name';
    name.textContent = spec.name;

    const value = document.createElement('span');
    value.className = 'spark-value';
    value.textContent = spec.value;

    const body = document.createElement('div');
    body.className = 'spark-canvas';
    const canvas = document.createElement('canvas');
    canvas.id = spec.id;
    body.append(canvas);

    wrapper.append(name, value, body);
    return wrapper;
  }));

  // Erst zeichnen, wenn die Canvas im Dokument haengen.
  for (const spec of specs) sparkline(spec.id, spec.values, spec.color);
}
