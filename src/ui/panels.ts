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

/**
 * Breite des Zielbereichs, als Anteil des Ziels.
 *
 * Der Bereich liegt auf der guten Seite des Ziels, nicht symmetrisch darum.
 * Bei Kalorien reicht er vom Ziel bis fuenfzehn Prozent darunter, bei Protein
 * vom Ziel bis fuenfzehn Prozent darueber. Ein Bereich, der bei Kalorien bis
 * null reicht, wuerde behaupten, dass weniger immer besser ist.
 */
const ZONE_WIDTH = 0.15;

interface RangeSpec {
  name: string;
  actual: number | null;
  target: number | null;
  unit: string;
  /** `atLeast` legt den Zielbereich ueber das Ziel, `atMost` darunter. */
  direction: 'atLeast' | 'atMost';
}

function pct(value: number, max: number): number {
  return Math.max(0, Math.min(100, (value / max) * 100));
}

function rangeRow(spec: RangeSpec): HTMLElement {
  const row = document.createElement('div');
  row.className = 'range-row';

  const suffix = spec.unit ? ` ${spec.unit}` : '';
  const head = document.createElement('div');
  head.className = 'range-head';

  const name = document.createElement('span');
  name.className = 'name';
  name.textContent = spec.name;

  const value = document.createElement('span');
  value.className = 'num';
  if (spec.actual === null) {
    value.textContent = EMPTY;
  } else {
    const actual = document.createElement('b');
    actual.textContent = `${integer(spec.actual)}${suffix}`;
    value.append(actual);
    if (spec.target !== null) {
      value.append(document.createTextNode(` von ${formatTarget(spec.target)}${suffix}`));
    }
  }

  head.append(name, value);
  row.append(head);

  if (spec.actual === null || spec.target === null || spec.target <= 0) return row;

  const max = spec.target * SCALE_HEADROOM;
  const track = document.createElement('div');
  track.className = 'range-track';

  // Zielbereich auf der guten Seite des Ziels.
  const zone = document.createElement('div');
  zone.className = 'range-zone ok';
  if (spec.direction === 'atLeast') {
    zone.style.left = `${pct(spec.target, max)}%`;
    zone.style.right = `${100 - pct(spec.target * (1 + ZONE_WIDTH), max)}%`;
  } else {
    zone.style.left = `${pct(spec.target * (1 - ZONE_WIDTH), max)}%`;
    zone.style.right = `${100 - pct(spec.target, max)}%`;
  }

  const goal = document.createElement('div');
  goal.className = 'range-goal';
  goal.style.left = `${pct(spec.target, max)}%`;

  const goalLabel = document.createElement('div');
  goalLabel.className = 'range-goal-label';
  goalLabel.style.left = `${pct(spec.target, max)}%`;
  goalLabel.textContent = 'Ziel';

  const marker = document.createElement('div');
  marker.className = 'range-actual';
  marker.style.left = `${pct(spec.actual, max)}%`;

  const markerLabel = document.createElement('div');
  markerLabel.className = 'range-actual-label';
  markerLabel.style.left = `${pct(spec.actual, max)}%`;
  // Die Beschriftung des Ziels steht darunter, deshalb nur bei genug Abstand.
  const overlaps = Math.abs(pct(spec.actual, max) - pct(spec.target, max)) < 9;
  markerLabel.style.top = overlaps ? '30px' : '14px';
  markerLabel.textContent = `Ø ${integer(spec.actual)}`;

  track.append(zone, goal, marker, goalLabel, markerLabel);

  const scale = document.createElement('div');
  scale.className = 'range-scale';
  if (overlaps) scale.style.marginTop = '48px';
  const zero = document.createElement('span');
  zero.textContent = '0';
  const top = document.createElement('span');
  top.textContent = `${integer(max)}${suffix}`;
  scale.append(zero, top);

  row.append(track, scale);
  return row;
}

function legend(): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'range-legend';

  const entry = (className: string, text: string): HTMLElement => {
    const item = document.createElement('span');
    const swatch = document.createElement('i');
    swatch.className = className;
    item.append(swatch, document.createTextNode(text));
    return item;
  };

  wrapper.append(
    entry('actual', 'Dein Schnitt'),
    entry('goal', 'Vorgabe des Trainers'),
    entry('zone', 'Zielbereich, fünfzehn Prozent auf der guten Seite'),
  );
  return wrapper;
}

export function renderNutritionRanges(daily: readonly DailyEntry[], goals: Goals): void {
  const container = byId('nutrition-ranges');
  if (!container) return;

  const target = goals.average;
  const specs: RangeSpec[] = [
    { name: 'Kalorien', actual: avg(daily.map((e) => e.calories)), target: target.caloriesKcal, unit: '', direction: 'atMost' },
    { name: 'Protein', actual: avg(daily.map((e) => e.protein)), target: target.proteinG, unit: 'g', direction: 'atLeast' },
    { name: 'Kohlenhydrate', actual: avg(daily.map((e) => e.carbs)), target: target.carbsG, unit: 'g', direction: 'atMost' },
    { name: 'Fett', actual: avg(daily.map((e) => e.fat)), target: target.fatG, unit: 'g', direction: 'atMost' },
    { name: 'Ballaststoffe', actual: avg(daily.map((e) => e.fiber)), target: target.fiberG, unit: 'g', direction: 'atLeast' },
  ];

  container.replaceChildren(...specs.map(rangeRow), legend());
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
    { id: 'spark-sleep', name: 'Schlaf in Stunden', values: daily.map((e) => e.sleep), value: `${mean((e) => e.sleep)} h`, color: 'rgba(235, 235, 245, 0.55)' },
    { id: 'spark-sleepq', name: 'Schlafqualität', values: daily.map((e) => e.sleepQ), value: mean((e) => e.sleepQ), color: '#0a84ff' },
    { id: 'spark-energy', name: 'Energie', values: daily.map((e) => e.energy), value: mean((e) => e.energy), color: 'rgba(235, 235, 245, 0.55)' },
    { id: 'spark-stress', name: 'Stress', values: daily.map((e) => e.stress), value: mean((e) => e.stress), color: 'rgba(235, 235, 245, 0.55)' },
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
