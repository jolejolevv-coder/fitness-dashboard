import type { DailyEntry } from '../types';
import type { Goals } from '../parse/goals';
import { targetRateKgPerWeek } from '../parse/goals';
import { complianceOf, streakOf, type Picker, type Predicate } from '../analytics/compliance';
import { correlations, MIN_CORRELATION_PAIRS } from '../analytics/correlation';
import { detectPlateau, projectToTarget, weightTrend, type PlateauStatus } from '../analytics/trend';
import { tdeeRange } from '../analytics/tdee';
import { byId, COLORS } from './dom';

/**
 * Anzeige der abgeleiteten Kennzahlen.
 *
 * Grundsatz: Zahl und Datenbasis, sonst nichts. Keine Erklaertexte, keine
 * Empfehlungen. Wo eine Kennzahl schweigt, steht ihr Grund, damit ein Strich
 * nie mit einem Defekt verwechselt wird.
 */

const dateFormat = new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });

function kcal(value: number): string {
  return Math.round(value).toLocaleString('de-DE');
}

function kg(value: number, digits = 2): string {
  return value.toFixed(digits).replace('.', ',');
}

/** Zielzahl ohne unnoetige Nachkommastelle, mit deutschem Dezimalkomma. */
function target(value: number | null): string {
  if (value === null) return '–';
  return Number.isInteger(value) ? String(value) : String(value).replace('.', ',');
}

function card(label: string, value: string, sub: string, color: string): HTMLElement {
  const element = document.createElement('div');
  element.className = 'kpi-card';

  const labelEl = document.createElement('div');
  labelEl.className = 'kpi-label';
  labelEl.textContent = label;

  const valueEl = document.createElement('div');
  valueEl.className = 'kpi-value';
  valueEl.style.color = color;
  valueEl.style.fontSize = value.length > 16 ? '16px' : '';
  valueEl.textContent = value;

  const subEl = document.createElement('div');
  subEl.className = 'kpi-sub';
  subEl.textContent = sub;

  element.append(labelEl, valueEl, subEl);
  return element;
}

/** Kachel fuer eine Kennzahl, die keine Aussage treffen kann. */
function refusedCard(label: string, insight: { reason: string }): HTMLElement {
  return card(label, '–', insight.reason, COLORS.muted);
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

interface StreakDefinition {
  label: string;
  pick: Picker;
  hit: Predicate | null;
}

function streakDefinitions(goals: Goals): StreakDefinition[] {
  const goal = goals.average;
  return [
    { label: `Protein ≥ ${target(goal.proteinG)}`, pick: (e) => e.protein, hit: goal.proteinG === null ? null : (v) => v >= goal.proteinG! },
    { label: `Kalorien ≤ ${target(goal.caloriesKcal)}`, pick: (e) => e.calories, hit: goal.caloriesKcal === null ? null : (v) => v <= goal.caloriesKcal! },
    { label: `Schritte ≥ ${target(goal.steps)}`, pick: (e) => e.steps, hit: goal.steps === null ? null : (v) => v >= goal.steps! },
    { label: `Ballaststoffe ≥ ${target(goal.fiberG)}`, pick: (e) => e.fiber, hit: goal.fiberG === null ? null : (v) => v >= goal.fiberG! },
  ];
}

function row(cells: (string | HTMLElement)[], colors: (string | null)[] = []): HTMLTableRowElement {
  const tr = document.createElement('tr');
  cells.forEach((content, index) => {
    const td = document.createElement('td');
    const color = colors[index];
    if (color) td.style.color = color;
    if (typeof content === 'string') td.textContent = content;
    else td.append(content);
    tr.append(td);
  });
  return tr;
}

function table(headers: string[], rows: HTMLTableRowElement[]): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.style.overflowX = 'auto';

  const element = document.createElement('table');
  element.className = 't-table';

  const head = document.createElement('thead');
  const headRow = document.createElement('tr');
  for (const header of headers) {
    const th = document.createElement('th');
    th.textContent = header;
    headRow.append(th);
  }
  head.append(headRow);

  const body = document.createElement('tbody');
  body.append(...rows);

  element.append(head, body);
  wrapper.append(element);
  return wrapper;
}

function note(text: string): HTMLElement {
  const element = document.createElement('p');
  element.className = 'analysis-note';
  element.textContent = text;
  return element;
}

export function renderAnalysis(
  daily: readonly DailyEntry[],
  goals: Goals,
  targetWeightKg: number | null,
): void {
  const trend = weightTrend(daily);
  const proteinCompliance = goals.average.proteinG === null
    ? null
    : complianceOf(daily, (e) => e.protein, (v) => v >= goals.average.proteinG!).pct;

  renderKpis(daily, goals, targetWeightKg, trend, proteinCompliance);
  renderStreaks(daily, goals);
  renderCorrelations(daily);
}

function renderKpis(
  daily: readonly DailyEntry[],
  goals: Goals,
  targetWeightKg: number | null,
  trend: ReturnType<typeof weightTrend>,
  proteinCompliance: number | null,
): void {
  const container = byId('a-kpis');
  if (!container) return;

  const cards: HTMLElement[] = [];

  // Erhaltungsbedarf als Spanne ueber die verfuegbaren Fenster.
  const tdee = tdeeRange(daily);
  if (tdee.ok) {
    const windows = tdee.estimates.map((e) => e.windowDays).join(', ');
    const value = Math.round(tdee.low) === Math.round(tdee.high)
      ? `${kcal(tdee.low)} kcal`
      : `${kcal(tdee.low)} bis ${kcal(tdee.high)}`;
    cards.push(card('Erhaltungsbedarf', value, `kcal/Tag · Basis ${windows} Tage`, COLORS.info));
  } else {
    cards.push(refusedCard('Erhaltungsbedarf', tdee));
  }

  // Rate gegen Sollrate.
  if (trend.ok) {
    const soll = targetRateKgPerWeek(goals.rateOfLossPct, trend.currentSmoothed);
    const direction = trend.ratePerWeek < 0 ? 'Abnahme' : 'Zunahme';
    const sub = soll !== null
      ? `${direction} · Soll ${kg(Math.abs(soll))} · Basis ${trend.basisDays} Tage`
      : `${direction} · Basis ${trend.basisDays} Tage`;
    const color = soll === null
      ? COLORS.info
      : Math.abs(trend.ratePerWeek) > Math.abs(soll) * 1.5 ? COLORS.warn : COLORS.good;
    cards.push(card('Rate', `${kg(Math.abs(trend.ratePerWeek))} kg/Woche`, sub, color));
  } else {
    cards.push(refusedCard('Rate', trend));
  }

  // Plateau.
  const plateau = detectPlateau(daily, proteinCompliance);
  if (plateau.ok) {
    const sub = plateau.status === 'ausfuehrung' && proteinCompliance !== null
      ? `${kg(Math.abs(plateau.ratePerWeek))} kg/Woche · Compliance ${proteinCompliance}%`
      : `${kg(Math.abs(plateau.ratePerWeek))} kg/Woche · Basis ${plateau.basisDays} Tage`;
    cards.push(card('Letzte 14 Tage', PLATEAU_LABELS[plateau.status], sub, PLATEAU_COLORS[plateau.status]));
  } else {
    cards.push(refusedCard('Letzte 14 Tage', plateau));
  }

  // Zielprojektion.
  const projection = projectToTarget(trend, targetWeightKg);
  if (projection.ok) {
    const band = `${dateFormat.format(projection.earliest)} bis ${dateFormat.format(projection.latest)}`;
    cards.push(card(`Ziel ${targetWeightKg} kg`, dateFormat.format(projection.date), band, COLORS.violet));
  } else {
    cards.push(refusedCard(targetWeightKg === null ? 'Zielprojektion' : `Ziel ${targetWeightKg} kg`, projection));
  }

  container.replaceChildren(...cards);

  const detail = byId('a-trend-detail');
  if (detail) {
    detail.replaceChildren(trend.ok
      ? note(`R² ${trend.r2.toFixed(2)} · geglaettetes Gewicht ${kg(trend.currentSmoothed, 1)} kg · ${trend.basisDays} Tage im Trend`)
      : note(trend.reason));
  }
}

function renderStreaks(daily: readonly DailyEntry[], goals: Goals): void {
  const container = byId('a-streaks');
  if (!container) return;

  const rows = streakDefinitions(goals).map((definition) => {
    if (!definition.hit) return row([definition.label, '–', '–', '–', 'Kein Zielwert']);
    const compliance = complianceOf(daily, definition.pick, definition.hit);
    const streak = streakOf(daily, definition.pick, definition.hit);
    const color = compliance.pct === null ? COLORS.muted
      : compliance.pct >= 80 ? COLORS.good
      : compliance.pct >= 60 ? COLORS.warn : COLORS.bad;
    return row(
      [
        definition.label,
        `${compliance.hit} von ${compliance.recorded}`,
        String(streak.current),
        String(streak.best),
        String(streak.gaps),
      ],
      [null, color],
    );
  });

  container.replaceChildren(table(['Ziel', 'Getroffen', 'Laufend', 'Bestserie', 'Luecken'], rows));
}

function renderCorrelations(daily: readonly DailyEntry[]): void {
  const container = byId('correlation-pairs');
  if (!container) return;

  const result = correlations(daily);
  const rows = result.found.map((entry) => {
    const color = Math.abs(entry.r) < 0.2 ? COLORS.muted : entry.r > 0 ? COLORS.good : COLORS.bad;
    return row([entry.label, entry.r.toFixed(2), String(entry.n)], [null, color]);
  });

  for (const skipped of result.skipped) {
    rows.push(row([skipped.label, '–', skipped.reason], [null, COLORS.muted, COLORS.dim]));
  }

  container.replaceChildren(
    table(['Paar', 'r', 'n'], rows),
    note(`Zusammenhang belegt keine Ursache. Unter ${MIN_CORRELATION_PAIRS} Paaren wird kein Wert ausgegeben.`),
  );
}
