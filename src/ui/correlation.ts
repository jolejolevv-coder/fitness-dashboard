import type { DailyEntry } from '../types';
import { fmt } from '../analytics/smoothing';
import { trainingEffect } from '../analytics/correlation';
import { byId, COLORS } from './dom';

/** Anzeige des Vergleichs Trainingstag gegen Ruhetag. Gerechnet wird in analytics. */

/** Ab dieser Differenz gilt ein Unterschied als nennenswert. */
const NOTABLE_DIFFERENCE = 0.05;

export function renderCorrelation(daily: readonly DailyEntry[]): void {
  const element = byId('correlation-content');
  if (!element) return;

  const effect = trainingEffect(daily);
  if (!effect.ok) {
    element.replaceChildren(note(effect.reason));
    return;
  }

  element.replaceChildren(
    grid([
      cell('Energie (1 bis 5)', effect.afterTraining.energy, effect.afterRest.energy, effect.energyDifference, 'Punkte Differenz'),
      cell('Schlaf (h)', effect.afterTraining.sleep, effect.afterRest.sleep, effect.sleepDifference, 'h Differenz'),
    ]),
    basis(effect.afterTraining.n, effect.afterRest.n),
  );
}

function note(text: string): HTMLElement {
  const p = document.createElement('p');
  p.className = 'analysis-note';
  p.textContent = text;
  return p;
}

function grid(cells: HTMLElement[]): HTMLElement {
  const div = document.createElement('div');
  div.className = 'corr-grid';
  div.append(...cells);
  return div;
}

function differenceColor(value: number | null): string {
  if (value === null) return COLORS.muted;
  if (Math.abs(value) < NOTABLE_DIFFERENCE) return '#94a3b8';
  return value > 0 ? COLORS.good : COLORS.bad;
}

function cell(
  label: string,
  afterTraining: number | null,
  afterRest: number | null,
  difference: number | null,
  unit: string,
): HTMLElement {
  const div = document.createElement('div');
  div.className = 'corr-cell';

  const title = document.createElement('div');
  title.className = 'corr-label';
  title.textContent = label;
  div.append(title, row(afterTraining, 'nach Training', COLORS.accent), row(afterRest, 'nach Ruhetag', COLORS.info));

  if (difference !== null) {
    const diff = document.createElement('div');
    diff.className = 'corr-diff';
    diff.style.color = differenceColor(difference);
    diff.textContent = `${difference > 0 ? '+' : ''}${difference.toFixed(2)} ${unit}`;
    div.append(diff);
  }

  return div;
}

function row(value: number | null, label: string, color: string): HTMLElement {
  const div = document.createElement('div');
  div.className = 'corr-row';

  const number = document.createElement('span');
  number.className = 'corr-val';
  number.style.color = color;
  number.textContent = fmt(value);

  const text = document.createElement('span');
  text.className = 'corr-sub';
  text.textContent = label;

  div.append(number, text);
  return div;
}

function basis(trainingDays: number, restDays: number): HTMLElement {
  const div = document.createElement('div');
  div.className = 'corr-n';
  div.textContent = `Basis: ${trainingDays} Training Folgetage · ${restDays} Ruhe Folgetage`;
  return div;
}
