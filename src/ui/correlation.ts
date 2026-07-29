import type { DailyEntry } from '../types';
import { avg, fmt } from '../analytics/smoothing';
import { byId, COLORS } from './dom';

/**
 * Vergleicht das Befinden am Tag nach einem Training mit dem nach einem Ruhetag.
 *
 * PHASE 1: Verhalten unveraendert. Der Wert `Rest` in der Spalte `Trainingday`
 * wird dabei faelschlich als Training gezaehlt, weil nur auf nicht leer und
 * ungleich `-` geprueft wird. Behebung in Phase 2.
 */

/** Groesster Abstand in Tagen, damit zwei Zeilen noch als Folgetage gelten. */
const MAX_GAP_DAYS = 2;

/** Ab dieser Differenz gilt ein Unterschied als nennenswert. */
const NOTABLE_DIFFERENCE = 0.05;

interface Bucket {
  energy: number[];
  sleep: number[];
}

export function renderCorrelation(daily: readonly DailyEntry[]): void {
  const element = byId('correlation-content');
  if (!element) return;

  const sorted = [...daily]
    .filter((r) => r.dateObj)
    .sort((a, b) => a.dateObj!.getTime() - b.dateObj!.getTime());

  const training: Bucket = { energy: [], sleep: [] };
  const rest: Bucket = { energy: [], sleep: [] };

  for (let i = 0; i < sorted.length - 1; i++) {
    const today = sorted[i]!;
    const next = sorted[i + 1]!;
    if ((next.dateObj!.getTime() - today.dateObj!.getTime()) / 864e5 > MAX_GAP_DAYS) continue;

    const isTraining = Boolean(today.training && today.training.trim() && today.training.trim() !== '-');
    const bucket = isTraining ? training : rest;
    if (next.energy !== null) bucket.energy.push(next.energy);
    if (next.sleep !== null) bucket.sleep.push(next.sleep);
  }

  if (!training.energy.length && !rest.energy.length) {
    element.replaceChildren(
      note('Nicht genug Daten (Training Spalte im Sheet pruefen).'),
    );
    return;
  }

  const trainingEnergy = avg(training.energy);
  const restEnergy = avg(rest.energy);
  const trainingSleep = avg(training.sleep);
  const restSleep = avg(rest.sleep);

  element.replaceChildren(
    grid([
      cell('Energie (1 bis 5)', trainingEnergy, restEnergy, 'Punkte Differenz'),
      cell('Schlaf (h)', trainingSleep, restSleep, 'h Differenz'),
    ]),
    basis(training.energy.length, rest.energy.length),
  );
}

function note(text: string): HTMLElement {
  const p = document.createElement('p');
  p.style.cssText = 'color:#475569;font-size:13px;padding:12px 0';
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

function cell(label: string, afterTraining: number | null, afterRest: number | null, unit: string): HTMLElement {
  const div = document.createElement('div');
  div.className = 'corr-cell';

  const title = document.createElement('div');
  title.className = 'corr-label';
  title.textContent = label;
  div.append(title, row(afterTraining, 'nach Training', COLORS.accent), row(afterRest, 'nach Ruhetag', COLORS.info));

  if (afterTraining !== null && afterRest !== null) {
    const difference = afterTraining - afterRest;
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
