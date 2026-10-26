import type { DailyEntry } from '../types';
import { trainingEffect } from '../analytics/correlation';
import { byId } from './dom';
import { card, refusalCard, valueNode } from './cards';
import { decimal, integer, signed } from './format';

/** Anzeige des Vergleichs Trainingstag gegen Ruhetag. Gerechnet wird in analytics. */

/** Ab dieser Differenz gilt ein Unterschied als nennenswert. */
const NOTABLE_DIFFERENCE = 0.05;

export function renderCorrelation(daily: readonly DailyEntry[]): void {
  const element = byId('correlation-content');
  if (!element) return;

  const effect = trainingEffect(daily);
  if (!effect.ok) {
    element.replaceChildren(refusalCard('Training gegen Ruhetag', effect.reason));
    return;
  }

  const basis = `Basis ${integer(effect.afterTraining.n)} Training und ${integer(effect.afterRest.n)} Ruhe Folgetage`;
  element.replaceChildren(
    differenceCard('Energie', effect.energyDifference, 'Punkte', effect.afterTraining.energy, effect.afterRest.energy, basis),
    differenceCard('Schlaf', effect.sleepDifference, 'h', effect.afterTraining.sleep, effect.afterRest.sleep, basis),
  );
}

function differenceCard(
  label: string,
  difference: number | null,
  unit: string,
  afterTraining: number | null,
  afterRest: number | null,
  basis: string,
): HTMLElement {
  const title = `${label} nach Training gegen Ruhetag`;
  if (difference === null) return refusalCard(title, basis);

  const tone = Math.abs(difference) < NOTABLE_DIFFERENCE ? '' : difference > 0 ? 'is-ok' : 'is-off';
  return card(
    title,
    valueNode(signed(difference, 2), unit, tone),
    [`Training ${decimal(afterTraining, 2)} gegen Ruhetag ${decimal(afterRest, 2)}`, basis],
  );
}
