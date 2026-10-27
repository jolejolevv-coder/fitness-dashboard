import type { DailyEntry } from '../types';
import type { Goals } from '../parse/goals';
import { avg } from '../analytics/smoothing';
import { byId, setText } from './dom';
import { el } from './build';
import { decimal, EMPTY, integer, rangeCaption, signed, target as formatTarget } from './format';

/**
 * Sekundaere Kennzahlen, in drei Gruppen.
 *
 * Ernaehrung, Aktivitaet und Regeneration als Magnetkarten, je nachdem mit
 * oder ohne Ziel.
 *
 * Wo ein Ziel existiert, steht die Abweichung des Schnitts davon, mit Vorzeichen
 * in die gute Richtung: Protein, Ballaststoffe und Schritte sind positiv, wenn
 * sie darueber liegen, Kalorien sind positiv, wenn sie darunter liegen. Wo kein
 * Ziel existiert, steht der Wert auf seiner Skala.
 */

/** Richtung, in der ein Wert das Ziel schlagen kann. */
type Direction = 'atLeast' | 'atMost';

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

function valueNode(text: string, unit: string): HTMLElement {
  return el('div', { class: 'card-value' }, [document.createTextNode(text), unit ? el('small', { text: unit }) : null]);
}

/** Karte mit Ziel: Wert, darunter Zielwert und Abweichung in die gute Richtung. */
function targetedCard(spec: TargetedSpec): HTMLElement {
  const value = valueNode(spec.actual === null ? EMPTY : integer(spec.actual), spec.actual === null ? '' : spec.unit);
  const children: (Node | null)[] = [el('div', { class: 'card-label', text: spec.label }), value];

  if (spec.actual !== null && spec.target !== null && spec.target > 0) {
    const deviation = deviationPct(spec.actual, spec.target, spec.direction);
    const suffix = spec.unit ? ` ${spec.unit}` : '';
    children.push(el('div', { class: 'card-basis' }, [
      document.createTextNode(`Ziel ${formatTarget(spec.target)}${suffix} · `),
      el('b', { class: deviation >= 0 ? 'is-ok' : 'is-off', text: `${signed(deviation, 1)} %` }),
    ]));
  }
  return el('div', { class: 'card' }, children);
}

/** Karte ohne Ziel: nur Bezeichnung und Wert. */
function plainCard(label: string, value: number | null, unit = ''): HTMLElement {
  return el('div', { class: 'card' }, [
    el('div', { class: 'card-label', text: label }),
    valueNode(value === null ? EMPTY : decimal(value, 1), value === null ? '' : unit),
  ]);
}

function group(title: string, cards: HTMLElement[]): HTMLElement[] {
  return [el('div', { class: 'group-label', text: title }), el('div', { class: 'grid2' }, cards)];
}

export function renderMetrics(daily: readonly DailyEntry[], goals: Goals): void {
  const container = byId('metrics');
  if (!container) return;
  // Die Kennzahlen rechnen ueber den gesamten Bestand, die Unterzeile auch.
  setText('metrics-range', rangeCaption(daily));

  const goal = goals.average;
  const mean = (pick: (e: DailyEntry) => number | null): number | null => avg(daily.map(pick));

  const nutrition = group('Ernährung', [
    targetedCard({ label: 'Kalorien', actual: mean((e) => e.calories), target: goal.caloriesKcal, unit: '', direction: 'atMost' }),
    targetedCard({ label: 'Protein', actual: mean((e) => e.protein), target: goal.proteinG, unit: 'g', direction: 'atLeast' }),
    targetedCard({ label: 'Ballaststoffe', actual: mean((e) => e.fiber), target: goal.fiberG, unit: 'g', direction: 'atLeast' }),
  ]);

  const activity = group('Aktivität', [
    targetedCard({ label: 'Schritte', actual: mean((e) => e.steps), target: goal.steps, unit: '', direction: 'atLeast' }),
  ]);

  const recovery = group('Regeneration', [
    plainCard('Schlaf', mean((e) => e.sleep), 'h'),
    plainCard('Energie', mean((e) => e.energy)),
    plainCard('Stress', mean((e) => e.stress)),
  ]);

  container.replaceChildren(...nutrition, ...activity, ...recovery);
}
