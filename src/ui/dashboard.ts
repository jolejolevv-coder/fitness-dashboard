import type { DailyEntry, WeekBlock } from '../types';
import { avg, fmt, movingAvg } from '../analytics/smoothing';
import { weightChange } from '../analytics/weight';
import type { ChartOptions } from 'chart.js';
import { barChart, baseOptions, Chart, destroyChart, lineChart, register } from '../charts/base';
import { daysDiffer, targetRateKgPerWeek, type Goals } from '../parse/goals';
import { byId, COLORS, setColor, setText } from './dom';
import { renderCorrelation } from './correlation';

/** Wird ausgeloest, wenn keine verwertbaren Gewichtsdaten vorliegen. */
export type ErrorHandler = (message: string) => void;

/** Schwellen fuer die Einfaerbung der Compliance Kacheln. */
const COMPLIANCE_THRESHOLDS = { good: 80, fair: 60 } as const;

/** Referenzlinien, die nicht aus dem Sheet kommen, weil der Trainer sie nicht vorgibt. */
const WELLNESS_REFERENCES = { sleepH: 7, energy: 3, stress: 3, digestion: 5 } as const;

function dayLabel(entry: DailyEntry): string {
  const d = entry.dateObj;
  if (!d) return entry.date;
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function weekLabel(block: WeekBlock, index: number): string {
  if (!block.rows.length) return `W${index + 1}`;
  const first = block.rows[0]!.dateObj;
  const last = block.rows[block.rows.length - 1]!.dateObj;
  const from = first ? `${first.getDate()}.${first.getMonth() + 1}` : '';
  const to = last ? `${last.getDate()}.${last.getMonth() + 1}` : '';
  return `W${index + 1} (${from}–${to})`;
}

function complianceColor(percent: number | null): string {
  if (percent === null) return COLORS.muted;
  if (percent >= COMPLIANCE_THRESHOLDS.good) return COLORS.good;
  if (percent >= COMPLIANCE_THRESHOLDS.fair) return COLORS.warn;
  return COLORS.bad;
}

/** Zielzahl ohne unnoetige Nachkommastelle, mit deutschem Dezimalkomma. */
function formatTarget(value: number): string {
  return Number.isInteger(value) ? String(value) : String(value).replace('.', ',');
}

/** Anteil der Tage, die ein Ziel erfuellen. Null, wenn kein Tag den Wert traegt. */
function compliance(entries: readonly DailyEntry[], pick: (e: DailyEntry) => number | null, hit: (v: number) => boolean): number | null {
  const withValue = entries.filter((e) => pick(e) !== null);
  if (!withValue.length) return null;
  return Math.round((withValue.filter((e) => hit(pick(e)!)).length / withValue.length) * 100);
}

export function renderDashboard(
  daily: readonly DailyEntry[],
  weekBlocks: readonly WeekBlock[],
  goals: Goals,
  onError: ErrorHandler,
): void {
  const rows = daily.filter((d) => d.weight !== null && !isNaN(d.weight));
  if (!rows.length) {
    onError('Keine gueltigen Gewichtsdaten gefunden.');
    return;
  }

  const labels = rows.map(dayLabel);
  const first = rows[0]!.weight!;
  const signed = (v: number, digits = 1): string => `${v < 0 ? '' : '+'}${v.toFixed(digits)}`;

  // Gesamtverlust ist die erste gegen die letzte Waegung. Der Versuch, hier
  // geglaettete Mittel zu zeigen, wurde zurueckgenommen: die erste Waegung ist
  // eine echte Messung und die Zahl, ueber die gesprochen wird. Die geglaettete
  // Betrachtung steht als Detail darunter, die Analytik rechnet weiter mit ihr.
  const change = weightChange(rows);
  const rawLoss = change ? change.lastRaw - change.firstRaw : null;
  setText('badge-start', change ? `${change.firstRaw.toFixed(1)} kg` : '–');
  setText('badge-current', change ? `${change.lastRaw.toFixed(1)} kg` : '–');
  setText('badge-loss', rawLoss !== null ? `${signed(rawLoss)} kg` : '–');
  setText('badge-days', `${rows.length} Tage`);
  setText('kpi-loss', rawLoss !== null ? `${signed(rawLoss)} kg` : '–');
  setText('kpi-loss-sub', change
    ? `geglaettet ${change.from.toFixed(1)} → ${change.to.toFixed(1)} kg · ${signed(change.change)} kg`
    : '–');

  // PHASE 2: Ernaehrung und Wellness rechnen ueber alle erfassten Tage, nicht
  // mehr nur ueber Tage mit Waegung. Ein Tag ohne Gewicht kann vollstaendige
  // Makros tragen, und dann gehoert er in den Durchschnitt.
  const avgCalories = avg(daily.map((r) => r.calories));
  const avgProtein = avg(daily.map((r) => r.protein));
  const avgSteps = avg(daily.map((r) => r.steps));

  setText('kpi-kcal', avgCalories === null ? '–' : String(Math.round(avgCalories)));
  setText('kpi-protein', avgProtein === null ? '–' : `${Math.round(avgProtein)}g`);
  setText('kpi-steps', avgSteps === null ? '–' : Math.round(avgSteps).toLocaleString('de'));
  setText('kpi-sleep', `${fmt(avg(daily.map((r) => r.sleep)))}h`);
  setText('kpi-energy', `${fmt(avg(daily.map((r) => r.energy)))}/5`);
  setText('last-updated', `Zuletzt geladen: ${new Date().toLocaleTimeString('de-DE')}`);

  const proteinTarget = goals.average.proteinG ?? 0;
  const calorieTarget = goals.average.caloriesKcal ?? 0;
  const proteinCompliance = compliance(daily, (r) => r.protein, (v) => v >= proteinTarget);
  setText('kpi-protein-compliance', proteinCompliance === null ? '–' : `${proteinCompliance}%`);
  setColor('kpi-protein-compliance', complianceColor(proteinCompliance));

  const calorieCompliance = compliance(daily, (r) => r.calories, (v) => v <= calorieTarget);
  setText('kpi-cal-compliance', calorieCompliance === null ? '–' : `${calorieCompliance}%`);
  setColor('kpi-cal-compliance', complianceColor(calorieCompliance));

  // PHASE 3: Beschriftungen und Referenzlinien folgen dem Vorgabeblock des
  // Sheets. Vorher standen 200 g und 2300 kcal fest im Markup.
  setText('kpi-protein-label', `Protein ≥ ${formatTarget(proteinTarget)} g`);
  setText('kpi-cal-label', `Kalorien ≤ ${formatTarget(calorieTarget)}`);
  renderGoalContext(goals, change?.to ?? null);

  // Uebersicht
  lineChart('weightChart', labels, rows.map((r) => r.weight), COLORS.info, true, first, movingAvg(rows.map((r) => r.weight)));
  barChart('stepsChart', labels, rows.map((r) => r.steps), COLORS.violet);

  const weekLabels = weekBlocks.map(weekLabel);
  const weekAverages = weekBlocks.map((b) => b.avgWeight ?? avg(b.rows.map((r) => r.weight)));
  barChart('weeklyChart', weekLabels, weekAverages, COLORS.sky);

  // Ernaehrung und Wellness ueber alle erfassten Tage, mit eigener Beschriftung,
  // weil dieser Satz Tage groesser ist als der mit Waegung.
  const allLabels = daily.map(dayLabel);
  lineChart('proteinChart', allLabels, daily.map((r) => r.protein), COLORS.warn, true, proteinTarget);
  lineChart('caloriesChart', allLabels, daily.map((r) => r.calories), COLORS.bad, true, calorieTarget);
  barChart('fvChart', allLabels, daily.map((r) => r.fv), COLORS.good);
  renderMacroChart(avgProtein, avg(daily.map((r) => r.carbs)), avg(daily.map((r) => r.fat)), goals);

  lineChart('sleepChart', allLabels, daily.map((r) => r.sleep), COLORS.indigo, true, WELLNESS_REFERENCES.sleepH);
  lineChart('energyChart', allLabels, daily.map((r) => r.energy), COLORS.warn, true, WELLNESS_REFERENCES.energy);
  lineChart('stressChart', allLabels, daily.map((r) => r.stress), COLORS.bad, true, WELLNESS_REFERENCES.stress);
  lineChart('digestionChart', allLabels, daily.map((r) => r.digestion), COLORS.good, true, WELLNESS_REFERENCES.digestion);
  renderCorrelation(daily);

  // Wochen
  renderWeekCards(weekBlocks);
  barChart('weekBarChart', weekLabels, weekAverages, COLORS.info);
  renderComments(daily);
}

/**
 * Kopfzeile und Hinweis zur Herkunft der Zielwerte.
 *
 * Die Sollrate wird laufend aus dem aktuellen Gewicht berechnet, weil der
 * Trainer sie in Prozent vorgibt. Bei 0.25 Prozent und 89.8 kg sind das
 * 0.22 kg pro Woche, bei 92 kg waeren es 0.24.
 */
function renderGoalContext(goals: Goals, currentWeightKg: number | null): void {
  const rate = targetRateKgPerWeek(goals.rateOfLossPct, currentWeightKg);
  const parts = ['Makrocycle 1', 'Ziel: Body Recomp'];
  if (rate !== null) {
    const direction = rate < 0 ? 'Abnahme' : 'Zunahme';
    parts.push(`Sollrate ${Math.abs(rate).toFixed(2)} kg/Woche ${direction}`);
  }
  setText('header-sub', parts.join(' · '));

  const hints: string[] = [];
  if (goals.missing.length) {
    hints.push(`Nicht aus dem Sheet gelesen: ${goals.missing.join(', ')}. Es gelten Rueckfallwerte.`);
  }
  if (daysDiffer(goals)) {
    hints.push('High Day und Low Day weichen voneinander ab, angezeigt wird der Wochenschnitt.');
  }
  const element = byId('goals-hint');
  if (element) {
    element.textContent = hints.join(' ');
    element.style.display = hints.length ? 'block' : 'none';
  }
}

function renderMacroChart(protein: number | null, carbs: number | null, fat: number | null, goals: Goals): void {
  destroyChart('macroChart');
  const element = byId('macroChart');
  if (!(element instanceof HTMLCanvasElement)) return;

  const options = baseOptions();
  options.plugins = { legend: { labels: { color: '#94a3b8', font: { size: 11 } } } };

  register('macroChart', new Chart(element, {
    type: 'bar',
    data: {
      labels: ['Protein', 'Carbs', 'Fett'],
      datasets: [
        {
          label: 'Ist Ø',
          data: [Math.round(protein ?? 0), Math.round(carbs ?? 0), Math.round(fat ?? 0)],
          backgroundColor: ['#fbbf24aa', '#38bdf8aa', '#f87171aa'],
          borderColor: ['#fbbf24', '#38bdf8', '#f87171'],
          borderWidth: 1,
          borderRadius: 6,
        },
        {
          label: 'Ziel',
          data: [goals.average.proteinG ?? 0, goals.average.carbsG ?? 0, goals.average.fatG ?? 0],
          backgroundColor: ['#fbbf2433', '#38bdf833', '#f8717133'],
          borderColor: ['#fbbf2466', '#38bdf866', '#f8717166'],
          borderWidth: 1,
          borderRadius: 6,
        },
      ],
    },
    options: options as ChartOptions<'bar'>,
  }));
}

function renderWeekCards(weekBlocks: readonly WeekBlock[]): void {
  const container = byId('week-cards');
  if (!container) return;

  const cards: HTMLElement[] = [];
  let previous: number | null = null;

  weekBlocks.forEach((block, index) => {
    const average = block.avgWeight ?? avg(block.rows.map((r) => r.weight));
    const delta = block.delta !== null ? block.delta : previous !== null && average !== null ? average - previous : null;

    const card = document.createElement('div');
    card.className = 'week-card';

    const heading = document.createElement('h4');
    heading.textContent = `Woche ${index + 1}`;

    const value = document.createElement('div');
    value.className = 'wval';
    value.textContent = average !== null ? `${average.toFixed(2)} kg` : '–';

    const change = document.createElement('div');
    change.className = 'wdelta';
    change.style.color = delta === null ? COLORS.muted : delta < 0 ? COLORS.good : COLORS.bad;
    change.textContent = index === 0 ? 'Baseline' : delta !== null ? `${delta < 0 ? '' : '+'}${delta.toFixed(2)} kg` : '–';

    card.append(heading, value, change);
    cards.push(card);
    previous = average;
  });

  container.replaceChildren(...cards);
}

function renderComments(daily: readonly DailyEntry[]): void {
  const container = byId('comments-container');
  if (!container) return;

  const withComment = daily.filter((r) => r.comment && r.comment.trim() && r.comment.trim() !== '-');

  if (!withComment.length) {
    const empty = document.createElement('p');
    empty.style.cssText = 'color:#475569;font-size:13px';
    empty.textContent = 'Keine Notizen vorhanden.';
    container.replaceChildren(empty);
    return;
  }

  container.replaceChildren(...withComment.map((entry) => {
    const card = document.createElement('div');
    card.className = 'comment-card';

    const date = document.createElement('div');
    date.className = 'comment-date';
    date.textContent = entry.date;

    const text = document.createElement('div');
    text.className = 'comment-text';
    // textContent statt innerHTML: Inhalte aus dem Sheet werden nie als Markup ausgefuehrt.
    text.textContent = entry.comment;

    card.append(date, text);
    return card;
  }));
}
