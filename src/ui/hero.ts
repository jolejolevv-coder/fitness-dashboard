import type { DailyEntry } from '../types';
import { targetRateKgPerWeek, type Goals } from '../parse/goals';
import { complianceOf } from '../analytics/compliance';
import { projectToTarget, weightTrend } from '../analytics/trend';
import { weightChange } from '../analytics/weight';
import { byId } from './dom';
import { el } from './build';
import { decimal, EMPTY, integer, signed } from './format';

/**
 * Der Fortschritt als eine Aussage.
 *
 * Eine Magnetkarte mit den verlorenen kg und dem Fortschritt zum Ziel, darunter
 * vier Karten: Aktuell, Wochenrate, Compliance, erwartetes Zieldatum.
 *
 * Gerechnet wird ueber den gesamten Bestand, unabhaengig vom Zeitraumfilter.
 */

/** Ab dieser Abweichung von der Sollrate gilt das Tempo als auffaellig. */
const RATE_TOLERANCE = 1.5;

/** Ab dieser Compliance gilt der Wert als getroffen, darunter als daneben. */
const COMPLIANCE_OK_PCT = 80;
const COMPLIANCE_OFF_PCT = 60;

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

/** Anteil der Strecke vom Startgewicht zum Ziel, auf 0 bis 100 begrenzt. */
function progressPct(start: number, current: number, target: number): number | null {
  const span = target - start;
  if (Math.abs(span) < 0.01) return null;
  return Math.max(0, Math.min(100, ((current - start) / span) * 100));
}

/** Zahl mit Einheit als kleinem Kind. */
function valueNode(className: string, text: string, unit?: string): HTMLElement {
  return el('div', { class: className }, [document.createTextNode(text), unit ? el('small', { text: unit }) : null]);
}

/** Verweigerung an der Stelle der Zahl, darunter `keine Aussage`. */
function refusalCard(label: string, reason: string): HTMLElement {
  return el('div', { class: 'card' }, [
    el('div', { class: 'card-label', text: label }),
    el('div', { class: 'refusal', text: reason }),
    el('div', { class: 'card-basis', text: 'keine Aussage' }),
  ]);
}

function card(label: string, value: HTMLElement, basis: string): HTMLElement {
  return el('div', { class: 'card' }, [
    el('div', { class: 'card-label', text: label }),
    value,
    el('div', { class: 'card-basis', text: basis }),
  ]);
}

function progressBar(pct: number): HTMLElement {
  const fill = el('span');
  fill.style.width = `${pct}%`;
  const mark = el('i');
  mark.style.left = 'calc(100% - 3px)';
  return el('div', { class: 'bar' }, [fill, mark]);
}

export function renderHero({ daily, goals, targetWeightKg }: HeroData): void {
  const container = byId('hero');
  if (!container) return;

  const weighed = daily.filter((d) => d.weight !== null && !isNaN(d.weight) && d.dateObj);
  const change = weightChange(weighed);
  if (!change || !weighed.length) {
    container.replaceChildren(refusalCard('Verlauf', 'Noch keine Wägungen erfasst'));
    return;
  }

  const lost = change.lastRaw - change.firstRaw;
  const since = weighed[0]!.dateObj!;

  // Die eine Aussage der Seite: verlorene kg, Fortschritt zum Ziel in derselben Karte.
  const main = card(
    lost <= 0 ? 'Verloren' : 'Zugelegt',
    valueNode('card-value is-hero', decimal(Math.abs(lost), 1), 'kg'),
    `seit ${shortDate(since)}`,
  );
  if (targetWeightKg !== null) {
    const pct = progressPct(change.firstRaw, change.lastRaw, targetWeightKg);
    if (pct !== null) {
      main.append(progressBar(pct));
      const basis = el('div', { class: 'card-basis' }, [
        el('b', { text: `${decimal(change.lastRaw, 1)} kg` }),
        document.createTextNode(` aktuell · ${decimal(targetWeightKg, 1)} kg Ziel · ${integer(pct)} %`),
      ]);
      main.append(basis);
    }
  }

  const trend = weightTrend(daily);
  const projection = projectToTarget(trend, targetWeightKg);

  let weekly: HTMLElement;
  if (trend.ok) {
    const plan = targetRateKgPerWeek(goals.rateOfLossPct, trend.currentSmoothed);
    const offPlan = plan !== null && Math.abs(trend.ratePerWeek) > Math.abs(plan) * RATE_TOLERANCE;
    weekly = card(
      'Ø pro Woche',
      valueNode(offPlan ? 'card-value is-off' : 'card-value', signed(trend.ratePerWeek, 2), 'kg'),
      plan !== null ? `Plan ${signed(plan, 2)} kg` : `Basis ${integer(trend.basisDays)} Tage`,
    );
  } else {
    weekly = refusalCard('Ø pro Woche', trend.reason);
  }

  const forecast = projection.ok
    ? card('Ziel voraussichtlich', valueNode('card-value is-word', longDate(projection.date)), `Basis ${integer(trend.ok ? trend.basisDays : 0)} Tage`)
    : refusalCard('Ziel voraussichtlich', projection.reason);

  container.replaceChildren(
    main,
    el('div', { class: 'grid2' }, [
      card('Aktuell', valueNode('card-value', decimal(change.lastRaw, 1), 'kg'), `${signed(lost, 1)} kg · ${integer(weighed.length)} Wägungen`),
      weekly,
      complianceCard(daily, goals),
      forecast,
    ]),
  );
}

/** Gesamtcompliance ueber Protein und Kalorien, als Anteil der erfassten Tage. */
function complianceCard(daily: readonly DailyEntry[], goals: Goals): HTMLElement {
  const protein = goals.average.proteinG;
  const calories = goals.average.caloriesKcal;
  if (protein === null || calories === null) return refusalCard('Compliance', 'Keine Zielwerte gelesen');

  const p = complianceOf(daily, (e) => e.protein, (v) => v >= protein);
  const c = complianceOf(daily, (e) => e.calories, (v) => v <= calories);
  const recorded = p.recorded + c.recorded;
  const pct = recorded ? Math.round(((p.hit + c.hit) / recorded) * 100) : null;
  const tone = pct === null ? '' : pct >= COMPLIANCE_OK_PCT ? ' is-ok' : pct < COMPLIANCE_OFF_PCT ? ' is-off' : '';

  return card(
    'Compliance',
    valueNode(`card-value${tone}`, pct === null ? EMPTY : `${integer(pct)} %`),
    `Protein ${integer(p.hit)}/${integer(p.recorded)} · Kalorien ${integer(c.hit)}/${integer(c.recorded)}`,
  );
}
