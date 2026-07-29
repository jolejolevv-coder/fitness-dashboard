import type { DailyEntry, WeekBlock } from '../types';
import { avg, fmt, movingAvg } from '../analytics/smoothing';
import type { ChartOptions } from 'chart.js';
import { barChart, baseOptions, Chart, destroyChart, lineChart, register } from '../charts/base';
import { COMPLIANCE_THRESHOLDS, GOALS } from '../config/goals';
import { byId, COLORS, setColor, setText } from './dom';
import { renderCorrelation } from './correlation';

/** Wird ausgeloest, wenn keine verwertbaren Gewichtsdaten vorliegen. */
export type ErrorHandler = (message: string) => void;

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

/** Anteil der Tage, die ein Ziel erfuellen. Null, wenn kein Tag den Wert traegt. */
function compliance(entries: readonly DailyEntry[], pick: (e: DailyEntry) => number | null, hit: (v: number) => boolean): number | null {
  const withValue = entries.filter((e) => pick(e) !== null);
  if (!withValue.length) return null;
  return Math.round((withValue.filter((e) => hit(pick(e)!)).length / withValue.length) * 100);
}

export function renderDashboard(daily: readonly DailyEntry[], weekBlocks: readonly WeekBlock[], onError: ErrorHandler): void {
  const rows = daily.filter((d) => d.weight !== null && !isNaN(d.weight));
  if (!rows.length) {
    onError('Keine gueltigen Gewichtsdaten gefunden.');
    return;
  }

  const labels = rows.map(dayLabel);
  const first = rows[0]!.weight!;
  const last = rows[rows.length - 1]!.weight!;
  const loss = last - first;
  const signed = (v: number, digits = 1): string => `${v < 0 ? '' : '+'}${v.toFixed(digits)}`;

  setText('badge-start', `${first.toFixed(1)} kg`);
  setText('badge-current', `${last.toFixed(1)} kg`);
  setText('badge-loss', `${signed(loss)} kg`);
  setText('badge-days', `${rows.length} Tage`);
  setText('kpi-loss', `${signed(loss)} kg`);
  setText('kpi-loss-sub', `${first.toFixed(1)} → ${last.toFixed(1)} kg`);

  const avgCalories = avg(rows.map((r) => r.calories));
  const avgProtein = avg(rows.map((r) => r.protein));
  const avgSteps = avg(rows.map((r) => r.steps));

  setText('kpi-kcal', avgCalories === null ? '–' : String(Math.round(avgCalories)));
  setText('kpi-protein', avgProtein === null ? '–' : `${Math.round(avgProtein)}g`);
  setText('kpi-steps', avgSteps === null ? '–' : Math.round(avgSteps).toLocaleString('de'));
  setText('kpi-sleep', `${fmt(avg(rows.map((r) => r.sleep)))}h`);
  setText('kpi-energy', `${fmt(avg(rows.map((r) => r.energy)))}/5`);
  setText('last-updated', `Zuletzt geladen: ${new Date().toLocaleTimeString('de-DE')}`);

  const proteinCompliance = compliance(rows, (r) => r.protein, (v) => v >= GOALS.proteinG);
  setText('kpi-protein-compliance', proteinCompliance === null ? '–' : `${proteinCompliance}%`);
  setColor('kpi-protein-compliance', complianceColor(proteinCompliance));

  const calorieCompliance = compliance(rows, (r) => r.calories, (v) => v <= GOALS.caloriesKcal);
  setText('kpi-cal-compliance', calorieCompliance === null ? '–' : `${calorieCompliance}%`);
  setColor('kpi-cal-compliance', complianceColor(calorieCompliance));

  // Uebersicht
  lineChart('weightChart', labels, rows.map((r) => r.weight), COLORS.info, true, first, movingAvg(rows.map((r) => r.weight)));
  barChart('stepsChart', labels, rows.map((r) => r.steps), COLORS.violet);

  const weekLabels = weekBlocks.map(weekLabel);
  const weekAverages = weekBlocks.map((b) => b.avgWeight ?? avg(b.rows.map((r) => r.weight)));
  barChart('weeklyChart', weekLabels, weekAverages, COLORS.sky);

  // Ernaehrung
  lineChart('proteinChart', labels, rows.map((r) => r.protein), COLORS.warn, true, GOALS.proteinG);
  lineChart('caloriesChart', labels, rows.map((r) => r.calories), COLORS.bad, true, GOALS.caloriesKcal);
  barChart('fvChart', labels, rows.map((r) => r.fv), COLORS.good);
  renderMacroChart(avg(rows.map((r) => r.protein)), avg(rows.map((r) => r.carbs)), avg(rows.map((r) => r.fat)));

  // Wellness
  lineChart('sleepChart', labels, rows.map((r) => r.sleep), COLORS.indigo, true, GOALS.sleepH);
  lineChart('energyChart', labels, rows.map((r) => r.energy), COLORS.warn, true, GOALS.energyRef);
  lineChart('stressChart', labels, rows.map((r) => r.stress), COLORS.bad, true, GOALS.stressRef);
  lineChart('digestionChart', labels, rows.map((r) => r.digestion), COLORS.good, true, GOALS.digestionRef);
  renderCorrelation(daily);

  // Wochen
  renderWeekCards(weekBlocks);
  barChart('weekBarChart', weekLabels, weekAverages, COLORS.info);
  renderComments(daily);
}

function renderMacroChart(protein: number | null, carbs: number | null, fat: number | null): void {
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
          data: [GOALS.proteinG, GOALS.carbsG, GOALS.fatG],
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
