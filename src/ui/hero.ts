import type { DailyEntry } from '../types';
import { targetRateKgPerWeek, type Goals } from '../parse/goals';
import { weightTrend } from '../analytics/trend';
import { weightChange } from '../analytics/weight';
import { byId } from './dom';
import { el } from './build';
import { card, refusalCard, valueNode } from './cards';
import { decimal, integer, signed } from './format';

/**
 * Heute: drei Magnetkarten fuer einen Blick.
 *
 * Gewicht der letzten Waegung mit Datum, geglaetteter Trend als Wochenrate,
 * Gesamtverlust erste gegen letzte Waegung. Alles Weitere steht in `Verlauf`
 * `Analyse`.
 *
 * Gerechnet wird ueber den gesamten Bestand, unabhaengig vom Zeitraumfilter.
 */

/** Ab dieser Abweichung von der Sollrate gilt das Tempo als auffaellig. */
const RATE_TOLERANCE = 1.5;

/** Die Einheit pro Woche steht in der Bezeichnung, damit die Zahl bei 375 px nicht umbricht. */
const TREND_LABEL = 'Trend pro Woche';

/** Datum der Karte, `27. Okt. 2026`. */
const cardDate = new Intl.DateTimeFormat('de-DE', { day: 'numeric', month: 'short', year: 'numeric' });

export interface HeroData {
  daily: readonly DailyEntry[];
  goals: Goals;
}

export function renderHero({ daily, goals }: HeroData): void {
  const container = byId('hero');
  if (!container) return;

  const weighed = daily.filter((d) => d.weight !== null && !isNaN(d.weight) && d.dateObj);
  const change = weightChange(weighed);
  if (!change || !weighed.length) {
    container.replaceChildren(refusalCard('Gewicht', 'Noch keine Wägungen erfasst'));
    return;
  }

  const first = weighed[0]!.dateObj!;
  const last = weighed[weighed.length - 1]!.dateObj!;
  const lost = change.lastRaw - change.firstRaw;

  const weight = card(
    'Gewicht',
    valueNode(decimal(change.lastRaw, 1), 'kg', 'is-hero'),
    [cardDate.format(last), `${integer(weighed.length)} Wägungen`],
  );

  const total = card(
    lost <= 0 ? 'Gesamtverlust' : 'Zugelegt',
    valueNode(decimal(Math.abs(lost), 1), 'kg'),
    `seit ${cardDate.format(first)}`,
  );

  container.replaceChildren(weight, el('div', { class: 'grid2' }, [trendCard(daily, goals), total]));
}

/** Geglaettete Wochenrate, rot bei deutlicher Abweichung von der Sollrate. */
function trendCard(daily: readonly DailyEntry[], goals: Goals): HTMLElement {
  const trend = weightTrend(daily);
  if (!trend.ok) return refusalCard(TREND_LABEL, trend.reason);

  const plan = targetRateKgPerWeek(goals.rateOfLossPct, trend.currentSmoothed);
  const offPlan = plan !== null && Math.abs(trend.ratePerWeek) > Math.abs(plan) * RATE_TOLERANCE;
  const basis = `Basis ${integer(trend.basisDays)} Tage`;
  return card(
    TREND_LABEL,
    valueNode(signed(trend.ratePerWeek, 2), 'kg', offPlan ? 'is-off' : undefined),
    plan !== null ? [`Plan ${signed(plan, 2)} kg`, basis] : basis,
  );
}
