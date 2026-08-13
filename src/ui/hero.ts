import type { DailyEntry } from '../types';
import { targetRateKgPerWeek, type Goals } from '../parse/goals';
import { complianceOf } from '../analytics/compliance';
import { projectToTarget, weightTrend } from '../analytics/trend';
import { weightChange } from '../analytics/weight';
import { byId } from './dom';
import { decimal, EMPTY, integer, signed } from './format';

/**
 * Der Fortschritt als eine Aussage.
 *
 * Eine grosse Zahl, eine Zeile Kontext, eine duenne Strecke, drei Kennzahlen
 * durch senkrechte Trenner geteilt, darunter das erwartete Zieldatum. Kein
 * Container, keine Kacheln. Die Rangfolge entsteht aus Schriftgroesse und
 * Abstand, nicht aus Flaechen.
 *
 * Gerechnet wird ueber den gesamten Bestand, unabhaengig vom Zeitraumfilter.
 */

/** Ab dieser Abweichung von der Sollrate gilt das Tempo als auffaellig. */
const RATE_TOLERANCE = 1.5;

const MONTHS = [
  'Jan.', 'Feb.', 'März', 'Apr.', 'Mai', 'Juni',
  'Juli', 'Aug.', 'Sept.', 'Okt.', 'Nov.', 'Dez.',
] as const;

export interface HeroData {
  daily: readonly DailyEntry[];
  goals: Goals;
  targetWeightKg: number | null;
}

function shortDate(date: Date): string {
  return `${date.getDate()}. ${MONTHS[date.getMonth()]}`;
}

function longDate(date: Date): string {
  return `${date.getDate()}. ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

function element(tag: string, className?: string, text?: string): HTMLElement {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** Anteil der Strecke vom Startgewicht zum Ziel, auf 0 bis 100 begrenzt. */
function progressPct(start: number, current: number, target: number): number | null {
  const span = target - start;
  if (Math.abs(span) < 0.01) return null;
  return Math.max(0, Math.min(100, ((current - start) / span) * 100));
}

function metric(label: string, value: string, sub: string, color?: string): HTMLElement {
  const wrapper = element('div', 'hero-metric');
  const valueNode = element('div', 'hero-metric-value', value);
  if (color) valueNode.style.color = color;
  wrapper.append(element('div', 'hero-metric-label', label), valueNode, element('div', 'hero-metric-sub', sub));
  return wrapper;
}

export function renderHero({ daily, goals, targetWeightKg }: HeroData): void {
  const container = byId('hero');
  if (!container) return;

  const weighed = daily.filter((d) => d.weight !== null && !isNaN(d.weight) && d.dateObj);
  const change = weightChange(weighed);
  if (!change || !weighed.length) {
    container.replaceChildren(element('p', 'hero-caption', 'Noch keine Wägungen erfasst.'));
    return;
  }

  const lost = change.lastRaw - change.firstRaw;
  const since = weighed[0]!.dateObj!;
  const nodes: HTMLElement[] = [];

  // Die eine Aussage der Seite.
  const headline = element('div', 'hero-headline');
  headline.append(
    element('span', 'hero-value', decimal(Math.abs(lost), 1)),
    element('span', 'hero-unit', 'kg'),
  );
  nodes.push(headline);
  nodes.push(element('p', 'hero-caption', `${lost <= 0 ? 'verloren' : 'zugelegt'} seit ${shortDate(since)}`));

  const trend = weightTrend(daily);
  const projection = projectToTarget(trend, targetWeightKg);

  if (targetWeightKg !== null) {
    const pct = progressPct(change.firstRaw, change.lastRaw, targetWeightKg);
    if (pct !== null) {
      const track = element('div', 'track');
      const bar = element('div', 'track-bar');
      const fill = element('div', 'track-fill');
      fill.style.width = `${pct}%`;
      bar.append(fill);

      const ends = element('div', 'track-ends');
      const left = element('span');
      left.append(element('span', 'num', `${decimal(change.lastRaw, 1)} kg`), document.createTextNode(' aktuell'));
      const middle = element('span', undefined, `${integer(pct)} % des Ziels erreicht`);
      const right = element('span');
      right.append(element('span', 'num', `${decimal(targetWeightKg, 1)} kg`), document.createTextNode(' Ziel'));
      ends.append(left, middle, right);

      track.append(bar, ends);
      nodes.push(track);
    }
  }

  // Drei Kennzahlen, getrennt durch senkrechte Linien statt durch Karten.
  const metrics = element('div', 'hero-metrics');

  metrics.append(metric(
    'Aktuell',
    `${decimal(change.lastRaw, 1)} kg`,
    `${signed(lost, 1)} kg · ${integer(weighed.length)} Wägungen`,
  ));

  if (trend.ok) {
    const plan = targetRateKgPerWeek(goals.rateOfLossPct, trend.currentSmoothed);
    const offPlan = plan !== null && Math.abs(trend.ratePerWeek) > Math.abs(plan) * RATE_TOLERANCE;
    metrics.append(metric(
      'Ø pro Woche',
      `${signed(trend.ratePerWeek, 2)} kg`,
      plan !== null ? `Plan ${signed(plan, 2)} kg` : `Basis ${integer(trend.basisDays)} Tage`,
      offPlan ? 'var(--orange)' : undefined,
    ));
  } else {
    metrics.append(metric('Ø pro Woche', EMPTY, trend.reason));
  }

  metrics.append(complianceMetric(daily, goals));
  nodes.push(metrics);

  // Prognose, klein und ohne Hinweisrahmen.
  const forecast = element('div', 'forecast');
  forecast.append(element('span', 'forecast-label', 'Ziel voraussichtlich'));
  forecast.append(element('span', 'forecast-value',
    projection.ok ? longDate(projection.date) : projection.reason));
  nodes.push(forecast);

  container.replaceChildren(...nodes);
}

/** Gesamtcompliance ueber Protein und Kalorien, als Anteil der erfassten Tage. */
function complianceMetric(daily: readonly DailyEntry[], goals: Goals): HTMLElement {
  const protein = goals.average.proteinG;
  const calories = goals.average.caloriesKcal;
  if (protein === null || calories === null) {
    return metric('Compliance', EMPTY, 'Keine Zielwerte gelesen');
  }

  const p = complianceOf(daily, (e) => e.protein, (v) => v >= protein);
  const c = complianceOf(daily, (e) => e.calories, (v) => v <= calories);
  const hit = p.hit + c.hit;
  const recorded = p.recorded + c.recorded;
  const pct = recorded ? Math.round((hit / recorded) * 100) : null;

  return metric(
    'Compliance',
    pct === null ? EMPTY : `${integer(pct)} %`,
    `Protein ${integer(p.hit)}/${integer(p.recorded)} · Kalorien ${integer(c.hit)}/${integer(c.recorded)}`,
    pct === null ? undefined : pct >= 80 ? 'var(--green)' : pct >= 60 ? 'var(--orange)' : 'var(--red)',
  );
}
