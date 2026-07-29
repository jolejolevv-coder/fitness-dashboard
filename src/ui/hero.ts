import type { DailyEntry } from '../types';
import { targetRateKgPerWeek, type Goals } from '../parse/goals';
import { complianceOf } from '../analytics/compliance';
import { projectToTarget, weightTrend, type Trend } from '../analytics/trend';
import { weightChange } from '../analytics/weight';
import type { Insight } from '../analytics/result';
import { byId } from './dom';
import { dateFormat, decimal, EMPTY, integer, signed } from './format';

/**
 * Fortschritt als ein zusammenhaengendes Modul.
 *
 * Ersetzt die vier getrennten Kacheln Start, Aktuell, Verlust und Tage. Die
 * vier Zahlen gehoeren zusammen: sie beschreiben eine Strecke, keinen Satz
 * unabhaengiger Werte. Deshalb ein Satz, eine Strecke und drei Kennzahlen.
 *
 * Gerechnet wird ueber den gesamten Zeitraum, unabhaengig vom Zeitraumfilter.
 */

/** Ab dieser Abweichung von der Sollrate gilt das Tempo als auffaellig. */
const RATE_TOLERANCE = 1.5;

export interface HeroData {
  daily: readonly DailyEntry[];
  goals: Goals;
  targetWeightKg: number | null;
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

function headline(lostKg: number): HTMLElement {
  const node = element('h2', 'hero-headline');
  const direction = lostKg <= 0 ? 'verloren' : 'zugelegt';
  node.append(
    document.createTextNode('Du hast seit dem Start '),
    element('span', 'accent', `${decimal(Math.abs(lostKg), 1)} kg`),
    document.createTextNode(` ${direction}.`),
  );
  return node;
}

function subline(trend: Insight<Trend>, projection: ReturnType<typeof projectToTarget>, targetWeightKg: number | null): HTMLElement {
  const parts: string[] = [];

  if (trend.ok) {
    const direction = trend.ratePerWeek < 0 ? 'Abnahme' : 'Zunahme';
    parts.push(`Aktuell ${decimal(Math.abs(trend.ratePerWeek), 2)} kg ${direction} pro Woche.`);
  } else {
    parts.push(`Noch keine belastbare Rate, ${trend.reason.toLowerCase()}.`);
  }

  if (projection.ok && targetWeightKg !== null) {
    parts.push(`Bei gleichbleibendem Verlauf erreichst du ${decimal(targetWeightKg, 1)} kg voraussichtlich am ${dateFormat.format(projection.date)}.`);
  } else if (targetWeightKg === null) {
    parts.push('Ohne Zielgewicht in den Einstellungen bleibt die Prognose aus.');
  } else if (!projection.ok) {
    parts.push(`Keine Prognose: ${projection.reason.toLowerCase()}.`);
  }

  return element('p', 'hero-sub', parts.join(' '));
}

function track(start: number, current: number, targetWeightKg: number | null): HTMLElement | null {
  if (targetWeightKg === null) return null;
  const pct = progressPct(start, current, targetWeightKg);
  if (pct === null) return null;

  const wrapper = element('div', 'track');

  const bar = element('div', 'track-bar');
  const fill = element('div', 'track-fill');
  fill.style.width = `${pct}%`;
  const marker = element('div', 'track-marker');
  marker.style.left = `${pct}%`;
  bar.append(fill, marker);

  const ends = element('div', 'track-ends');
  const left = element('span');
  left.append(document.createTextNode('Start '), element('span', 'num', `${decimal(start, 1)} kg`));
  const middle = element('span', undefined);
  middle.textContent = `${integer(pct)} % der Strecke`;
  const right = element('span');
  right.append(document.createTextNode('Ziel '), element('span', 'num', `${decimal(targetWeightKg, 1)} kg`));
  ends.append(left, middle, right);

  wrapper.append(bar, ends);
  return wrapper;
}

function metric(label: string, value: string, sub: string, color?: string): HTMLElement {
  const wrapper = element('div');
  const valueNode = element('div', 'hero-metric-value', value);
  if (color) valueNode.style.color = color;
  wrapper.append(
    element('div', 'hero-metric-label', label),
    valueNode,
    element('div', 'hero-metric-sub', sub),
  );
  return wrapper;
}

export function renderHero({ daily, goals, targetWeightKg }: HeroData): void {
  const container = byId('hero');
  if (!container) return;

  const weighed = daily.filter((d) => d.weight !== null && !isNaN(d.weight));
  const change = weightChange(weighed);
  if (!change) {
    container.replaceChildren(element('p', 'hero-sub', 'Noch keine Waegungen erfasst.'));
    return;
  }

  const trend = weightTrend(daily);
  const projection = projectToTarget(trend, targetWeightKg);
  const lost = change.lastRaw - change.firstRaw;

  const nodes: HTMLElement[] = [headline(lost), subline(trend, projection, targetWeightKg)];
  const strecke = track(change.firstRaw, change.lastRaw, targetWeightKg);
  if (strecke) nodes.push(strecke);

  // Drei primaere Kennzahlen. Alles andere ist sekundaer und steht darunter.
  const metrics = element('div', 'hero-metrics');

  metrics.append(metric(
    'Aktuelles Gewicht',
    `${decimal(change.lastRaw, 1)} kg`,
    `${signed(lost, 1)} kg seit Start · ${integer(weighed.length)} Wägungen`,
  ));

  if (trend.ok) {
    const soll = targetRateKgPerWeek(goals.rateOfLossPct, trend.currentSmoothed);
    const offPlan = soll !== null && Math.abs(trend.ratePerWeek) > Math.abs(soll) * RATE_TOLERANCE;
    metrics.append(metric(
      'Rate pro Woche',
      `${decimal(Math.abs(trend.ratePerWeek), 2)} kg`,
      soll !== null ? `Plan ${decimal(Math.abs(soll), 2)} kg · Basis ${integer(trend.basisDays)} Tage` : `Basis ${integer(trend.basisDays)} Tage`,
      offPlan ? 'var(--accent)' : 'var(--pos)',
    ));
  } else {
    metrics.append(metric('Rate pro Woche', EMPTY, trend.reason));
  }

  metrics.append(complianceMetric(daily, goals));
  nodes.push(metrics);

  container.replaceChildren(...nodes);
}

/** Gesamtcompliance ueber Protein und Kalorien, als getroffene von erfassten Tagen. */
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
    'Compliance gesamt',
    pct === null ? EMPTY : `${integer(pct)} %`,
    `Protein ${integer(p.hit)}/${integer(p.recorded)} · Kalorien ${integer(c.hit)}/${integer(c.recorded)}`,
    pct === null ? undefined : pct >= 80 ? 'var(--pos)' : pct >= 60 ? 'var(--accent)' : 'var(--neg)',
  );
}
