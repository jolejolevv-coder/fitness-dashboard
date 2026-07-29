import type { DailyEntry } from '../types';
import type { Goals } from '../parse/goals';
import { avg } from '../analytics/smoothing';
import { byId } from './dom';
import { decimal, EMPTY, integer, signed, target as formatTarget } from './format';

/**
 * Sekundaere Kennzahlen, in drei Gruppen.
 *
 * Vorher sieben gleichfoermige Spalten nebeneinander, die keine Ordnung
 * erkennen liessen. Jetzt Ernaehrung, Aktivitaet und Regeneration, mit
 * unterschiedlicher Darstellung je nachdem, ob es ein Ziel gibt.
 *
 * Wo ein Ziel existiert, steht die Abweichung des Schnitts davon, mit Vorzeichen
 * in die gute Richtung: Protein, Ballaststoffe und Schritte sind positiv, wenn
 * sie darueber liegen, Kalorien sind positiv, wenn sie darunter liegen. Wo kein
 * Ziel existiert, steht der Wert auf seiner Skala.
 */

/** Richtung, in der ein Wert das Ziel schlagen kann. */
type Direction = 'atLeast' | 'atMost';

const TONE_COLORS = { pos: 'var(--pos)', neg: 'var(--neg)' } as const;

/**
 * Abweichung vom Ziel in Prozent, positiv in die gute Richtung.
 *
 * Bei `atMost` wird das Vorzeichen gedreht: fuenf Prozent unter dem
 * Kalorienziel sind plus fuenf Prozent, nicht minus fuenf.
 */
export function deviationPct(actual: number, target: number, direction: Direction): number {
  const raw = ((actual - target) / target) * 100;
  return direction === 'atMost' ? -raw : raw;
}

interface TargetedSpec {
  label: string;
  actual: number | null;
  target: number | null;
  unit: string;
  direction: Direction;
}

/** Zeile mit Ziel: Wert, Abweichung und Balken. */
function targetedRow(spec: TargetedSpec): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'metric';

  const head = document.createElement('div');
  head.className = 'metric-head';

  const label = document.createElement('span');
  label.className = 'metric-label';
  label.textContent = spec.label;

  const suffix = spec.unit ? ` ${spec.unit}` : '';
  const value = document.createElement('span');
  value.className = 'metric-value';
  value.textContent = spec.actual === null ? EMPTY : `${integer(spec.actual)}${suffix}`;

  head.append(label, value);
  wrapper.append(head);

  if (spec.actual === null || spec.target === null || spec.target <= 0) {
    const sub = document.createElement('div');
    sub.className = 'metric-sub';
    sub.textContent = 'kein Zielwert';
    wrapper.append(sub);
    return wrapper;
  }

  const deviation = deviationPct(spec.actual, spec.target, spec.direction);
  const tone = deviation >= 0 ? 'pos' : 'neg';

  const sub = document.createElement('div');
  sub.className = 'metric-sub';
  sub.append(document.createTextNode(`Ziel ${formatTarget(spec.target)}${suffix} · `));
  const badge = document.createElement('span');
  badge.style.color = TONE_COLORS[tone];
  badge.textContent = `${signed(deviation, 1)} %`;
  sub.append(badge);
  wrapper.append(sub);

  const bar = document.createElement('div');
  bar.className = 'metric-bar';
  const inner = document.createElement('span');
  inner.style.width = `${Math.max(4, Math.min(100, (spec.actual / spec.target) * 100))}%`;
  inner.style.background = TONE_COLORS[tone];
  bar.append(inner);
  wrapper.append(bar);

  return wrapper;
}

/** Zeile ohne Ziel: Wert auf seiner Skala, als Indikator. */
function gaugeRow(label: string, value: number | null, max: number, unit = ''): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'gauge';

  const name = document.createElement('span');
  name.className = 'gauge-label';
  name.textContent = label;

  const number = document.createElement('span');
  number.className = 'gauge-value';
  number.textContent = value === null ? EMPTY : `${decimal(value, 1)}${unit ? ` ${unit}` : ''}`;

  const scale = document.createElement('div');
  scale.className = 'gauge-scale';
  const filled = value === null ? 0 : Math.round((value / max) * 5);
  for (let i = 0; i < 5; i++) {
    const segment = document.createElement('i');
    if (i < filled) segment.className = 'on';
    scale.append(segment);
  }

  wrapper.append(name, number, scale);
  return wrapper;
}

function group(title: string, children: HTMLElement[]): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'metric-group';

  const heading = document.createElement('div');
  heading.className = 'metric-group-title';
  heading.textContent = title;

  wrapper.append(heading, ...children);
  return wrapper;
}

export function renderMetrics(daily: readonly DailyEntry[], goals: Goals): void {
  const container = byId('metrics');
  if (!container) return;

  const goal = goals.average;
  const mean = (pick: (e: DailyEntry) => number | null): number | null => avg(daily.map(pick));

  const nutrition = group('Ernährung', [
    targetedRow({ label: 'Kalorien', actual: mean((e) => e.calories), target: goal.caloriesKcal, unit: '', direction: 'atMost' }),
    targetedRow({ label: 'Protein', actual: mean((e) => e.protein), target: goal.proteinG, unit: 'g', direction: 'atLeast' }),
    targetedRow({ label: 'Ballaststoffe', actual: mean((e) => e.fiber), target: goal.fiberG, unit: 'g', direction: 'atLeast' }),
  ]);

  const activity = group('Aktivität', [
    targetedRow({ label: 'Schritte', actual: mean((e) => e.steps), target: goal.steps, unit: '', direction: 'atLeast' }),
  ]);

  const recovery = group('Regeneration', [
    gaugeRow('Schlaf', mean((e) => e.sleep), 9, 'h'),
    gaugeRow('Energie', mean((e) => e.energy), 5),
    gaugeRow('Stress', mean((e) => e.stress), 5),
  ]);

  container.replaceChildren(nutrition, activity, recovery);
}
