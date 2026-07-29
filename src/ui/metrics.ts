import type { DailyEntry } from '../types';
import type { Goals } from '../parse/goals';
import { avg } from '../analytics/smoothing';
import { byId } from './dom';
import { decimal, EMPTY, integer, signed, target as formatTarget } from './format';

/**
 * Sekundaere Kennzahlen.
 *
 * Bewusst kleiner als der Hero und ohne eigene Farbe je Kachel. Die frueheren
 * acht gleich grossen Kacheln in acht verschiedenen Farben liessen keine
 * Rangfolge erkennen.
 *
 * Gezeigt wird die Abweichung des Schnitts vom Ziel, mit Vorzeichen in die gute
 * Richtung: Protein, Schritte und Ballaststoffe sind positiv, wenn sie darueber
 * liegen, Kalorien sind positiv, wenn sie darunter liegen. Vorher stand hier die
 * Trefferquote je Tag, die rot wurde, obwohl der Schnitt auf der guten Seite des
 * Ziels lag. Die Trefferquote steht weiterhin im Hero und im Analyse Tab.
 */

/** Richtung, in der ein Wert das Ziel schlagen kann. */
type Direction = 'atLeast' | 'atMost';

interface MetricSpec {
  label: string;
  value: string;
  sub: string;
  /** Anteil am Ziel, 0 bis 1. Ohne Ziel entfaellt der Balken. */
  fill?: number | undefined;
  tone?: 'pos' | 'neg' | undefined;
}

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

function node(spec: MetricSpec): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'metric';

  const label = document.createElement('div');
  label.className = 'metric-label';
  label.textContent = spec.label;

  const value = document.createElement('div');
  value.className = 'metric-value';
  value.textContent = spec.value;

  const sub = document.createElement('div');
  sub.className = 'metric-sub';
  sub.textContent = spec.sub;

  wrapper.append(label, value, sub);

  if (spec.fill !== undefined) {
    const bar = document.createElement('div');
    bar.className = 'metric-bar';
    const inner = document.createElement('span');
    inner.style.width = `${Math.max(4, Math.min(100, spec.fill * 100))}%`;
    inner.style.background = spec.tone ? TONE_COLORS[spec.tone] : 'var(--text-dim)';
    bar.append(inner);
    wrapper.append(bar);
  }

  return wrapper;
}

interface TargetedSpec {
  label: string;
  actual: number | null;
  target: number | null;
  unit: string;
  direction: Direction;
}

function targeted(spec: TargetedSpec): MetricSpec {
  const suffix = spec.unit ? ` ${spec.unit}` : '';
  const value = spec.actual === null ? EMPTY : `${integer(spec.actual)}${suffix}`;

  if (spec.actual === null || spec.target === null || spec.target <= 0) {
    return { label: spec.label, value, sub: 'pro Tag' };
  }

  const deviation = deviationPct(spec.actual, spec.target, spec.direction);
  return {
    label: spec.label,
    value,
    sub: `Ziel ${formatTarget(spec.target)}${suffix} · ${signed(deviation, 1)} %`,
    fill: spec.actual / spec.target,
    tone: deviation >= 0 ? 'pos' : 'neg',
  };
}

export function renderMetrics(daily: readonly DailyEntry[], goals: Goals): void {
  const container = byId('metrics');
  if (!container) return;

  const goal = goals.average;
  const mean = (pick: (e: DailyEntry) => number | null): number | null => avg(daily.map(pick));

  const specs: MetricSpec[] = [
    targeted({ label: 'Ø Kalorien', actual: mean((e) => e.calories), target: goal.caloriesKcal, unit: '', direction: 'atMost' }),
    targeted({ label: 'Ø Protein', actual: mean((e) => e.protein), target: goal.proteinG, unit: 'g', direction: 'atLeast' }),
    targeted({ label: 'Ø Schritte', actual: mean((e) => e.steps), target: goal.steps, unit: '', direction: 'atLeast' }),
    targeted({ label: 'Ø Ballaststoffe', actual: mean((e) => e.fiber), target: goal.fiberG, unit: 'g', direction: 'atLeast' }),
  ];

  const sleep = mean((e) => e.sleep);
  specs.push({ label: 'Ø Schlaf', value: sleep === null ? EMPTY : `${decimal(sleep, 1)} h`, sub: 'pro Nacht' });

  const energy = mean((e) => e.energy);
  specs.push({ label: 'Ø Energie', value: energy === null ? EMPTY : decimal(energy, 1), sub: 'von 5' });

  const stress = mean((e) => e.stress);
  specs.push({ label: 'Ø Stress', value: stress === null ? EMPTY : decimal(stress, 1), sub: 'von 5, niedriger ist besser' });

  container.replaceChildren(...specs.map(node));
}
