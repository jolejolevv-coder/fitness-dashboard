import type { DailyEntry } from '../types';
import { targetRateKgPerWeek, type Goals } from '../parse/goals';
import { complianceOf } from '../analytics/compliance';
import { detectPlateau, projectToTarget, weightTrend, type PlateauStatus } from '../analytics/trend';
import { tdeeRange } from '../analytics/tdee';
import { byId, COLORS } from './dom';

/**
 * Der Antwortblock oben auf der Seite.
 *
 * Beantwortet die woechentliche Kontrollfrage in vier Aussagen, jede mit ihrer
 * Datenbasis. Keine Erklaerungen, keine Empfehlungen. Wo eine Aussage nicht
 * getroffen werden kann, steht ihr Grund, damit ein Strich nie mit einem Defekt
 * verwechselt wird.
 *
 * Gerechnet wird immer ueber den gesamten Zeitraum, nie ueber die Auswahl der
 * Zeitraumknoepfe.
 */

const dateFormat = new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });

function kg(value: number, digits = 2): string {
  return value.toFixed(digits).replace('.', ',');
}

interface Item {
  label: string;
  value: string;
  sub: string;
  color: string;
  small?: boolean;
}

function element(item: Item): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'answer-item';

  const label = document.createElement('div');
  label.className = 'answer-label';
  label.textContent = item.label;

  const value = document.createElement('div');
  value.className = item.small ? 'answer-value small' : 'answer-value';
  value.style.color = item.color;
  value.textContent = item.value;

  const sub = document.createElement('div');
  sub.className = 'answer-sub';
  sub.textContent = item.sub;

  wrapper.append(label, value, sub);
  return wrapper;
}

const PLATEAU_LABELS: Record<PlateauStatus, string> = {
  'kein-plateau': 'Kein Plateau',
  plateau: 'Plateau',
  ausfuehrung: 'Stillstand',
};

const PLATEAU_COLORS: Record<PlateauStatus, string> = {
  'kein-plateau': COLORS.good,
  plateau: COLORS.bad,
  ausfuehrung: COLORS.warn,
};

export function renderAnswerBlock(
  daily: readonly DailyEntry[],
  goals: Goals,
  targetWeightKg: number | null,
): void {
  const container = byId('answer-block');
  if (!container) return;

  const items: Item[] = [];
  const trend = weightTrend(daily);

  // 1. Rate gegen Sollrate.
  if (trend.ok) {
    const soll = targetRateKgPerWeek(goals.rateOfLossPct, trend.currentSmoothed);
    const direction = trend.ratePerWeek < 0 ? 'Abnahme' : 'Zunahme';
    const color = soll === null
      ? COLORS.info
      : Math.abs(trend.ratePerWeek) > Math.abs(soll) * 1.5 ? COLORS.warn : COLORS.good;
    items.push({
      label: 'Rate',
      value: `${kg(Math.abs(trend.ratePerWeek))} kg/Woche`,
      sub: soll !== null
        ? `${direction} · Soll ${kg(Math.abs(soll))} · Basis ${trend.basisDays} Tage`
        : `${direction} · Basis ${trend.basisDays} Tage`,
      color,
    });
  } else {
    items.push({ label: 'Rate', value: '–', sub: trend.reason, color: COLORS.muted });
  }

  // 2. Erhaltungsbedarf.
  const tdee = tdeeRange(daily);
  if (tdee.ok) {
    const windows = tdee.estimates.map((e) => e.windowDays).join(', ');
    const value = Math.round(tdee.low) === Math.round(tdee.high)
      ? `${Math.round(tdee.low).toLocaleString('de-DE')} kcal`
      : `${Math.round(tdee.low).toLocaleString('de-DE')} bis ${Math.round(tdee.high).toLocaleString('de-DE')}`;
    items.push({ label: 'Erhaltungsbedarf', value, sub: `kcal/Tag · Basis ${windows} Tage`, color: COLORS.info });
  } else {
    items.push({ label: 'Erhaltungsbedarf', value: '–', sub: tdee.reason, color: COLORS.muted });
  }

  // 3. Plateau, mit der Compliance als Unterscheidungsmerkmal.
  const proteinCompliance = goals.average.proteinG === null
    ? null
    : complianceOf(daily, (e) => e.protein, (v) => v >= goals.average.proteinG!).pct;
  const plateau = detectPlateau(daily, proteinCompliance);
  if (plateau.ok) {
    items.push({
      label: 'Letzte 14 Tage',
      value: PLATEAU_LABELS[plateau.status],
      sub: `${kg(Math.abs(plateau.ratePerWeek))} kg/Woche · Basis ${plateau.basisDays} Tage`,
      color: PLATEAU_COLORS[plateau.status],
      small: true,
    });
  } else {
    items.push({ label: 'Letzte 14 Tage', value: '–', sub: plateau.reason, color: COLORS.muted });
  }

  // 4. Compliance als getroffene von erfassten Tagen.
  const protein = goals.average.proteinG;
  const calories = goals.average.caloriesKcal;
  if (protein !== null && calories !== null) {
    const p = complianceOf(daily, (e) => e.protein, (v) => v >= protein);
    const c = complianceOf(daily, (e) => e.calories, (v) => v <= calories);
    const worst = Math.min(p.pct ?? 100, c.pct ?? 100);
    items.push({
      label: 'Compliance',
      value: `${p.hit} von ${p.recorded}`,
      sub: `Protein · Kalorien ${c.hit} von ${c.recorded}`,
      color: worst >= 80 ? COLORS.good : worst >= 60 ? COLORS.warn : COLORS.bad,
      small: true,
    });
  } else {
    items.push({ label: 'Compliance', value: '–', sub: 'Keine Zielwerte gelesen', color: COLORS.muted });
  }

  // 5. Zielprojektion, nur wenn ein Zielgewicht gesetzt ist.
  const projection = projectToTarget(trend, targetWeightKg);
  if (projection.ok) {
    items.push({
      label: `Ziel ${targetWeightKg} kg`,
      value: dateFormat.format(projection.date),
      sub: `${dateFormat.format(projection.earliest)} bis ${dateFormat.format(projection.latest)}`,
      color: COLORS.violet,
      small: true,
    });
  } else if (targetWeightKg !== null) {
    items.push({ label: `Ziel ${targetWeightKg} kg`, value: '–', sub: projection.reason, color: COLORS.muted });
  }

  container.replaceChildren(...items.map(element));
}
