import type { DailyEntry, WeekBlock } from '../types';
import { avg } from '../analytics/smoothing';
import type { LegendEntry, WeightMode } from '../charts/weight';
import { daysDiffer, targetRateKgPerWeek, type Goals } from '../parse/goals';
import { byId, COLORS, setText } from './dom';
import { renderCorrelation } from './correlation';
import { renderNutritionRanges, renderWellnessSparks } from './panels';
import { decimal, signed } from './format';
import type { Charts } from './charts';

/** Wird ausgeloest, wenn keine verwertbaren Gewichtsdaten vorliegen. */
export type ErrorHandler = (message: string) => void;

/**
 * Renderfunktion je Abschnitt, damit nur der sichtbare Tab gezeichnet wird.
 * Alle Abschnitte hier zeichnen Diagramme und bekommen den geladenen Chunk.
 */
export type SectionRenderers = Record<string, (charts: Charts) => void>;

/** Referenzlinien, die nicht aus dem Sheet kommen, weil der Trainer sie nicht vorgibt. */
const WELLNESS_REFERENCES = { sleepH: 7, energy: 3, stress: 3, digestion: 5 } as const;

export interface DashboardInput {
  /** Nach Zeitraum gefilterte Tage, Grundlage der Diagramme. */
  daily: readonly DailyEntry[];
  weekBlocks: readonly WeekBlock[];
  goals: Goals;
  weightMode: WeightMode;
  targetWeightKg: number | null;
  onError: ErrorHandler;
}

function dayLabel(entry: DailyEntry): string {
  const d = entry.dateObj;
  if (!d) return entry.date;
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.`;
}

function weekLabel(block: WeekBlock, index: number): string {
  if (!block.rows.length) return `W${index + 1}`;
  const first = block.rows[0]!.dateObj;
  return first ? `${first.getDate()}.${first.getMonth() + 1}.` : `W${index + 1}`;
}

export function renderDashboard(input: DashboardInput): SectionRenderers | null {
  const { daily, weekBlocks, goals, weightMode, targetWeightKg, onError } = input;

  const rows = daily.filter((d) => d.weight !== null && !isNaN(d.weight));
  if (!rows.length) {
    onError('Keine gueltigen Gewichtsdaten gefunden.');
    return null;
  }

  renderGoalContext(goals, avg(rows.slice(-7).map((r) => r.weight)));
  renderRangeCaption(daily);

  const labels = rows.map(dayLabel);
  const allLabels = daily.map(dayLabel);
  const weekLabels = weekBlocks.map(weekLabel);
  const weekAverages = weekBlocks.map((b) => b.avgWeight ?? avg(b.rows.map((r) => r.weight)));
  const proteinTarget = goals.average.proteinG;
  const calorieTarget = goals.average.caloriesKcal;

  return {
    overview: (charts) => {
      renderLegend(charts.renderWeightChart('weightChart', daily, weightMode, targetWeightKg));
      charts.barChart('stepsChart', labels, rows.map((r) => r.steps), COLORS.blue);
      weeklyChart(charts, 'weeklyChart', weekLabels, weekAverages);
    },
    nutrition: (charts) => {
      renderNutritionRanges(daily, goals);
      charts.renderDailyTargetChart({
        canvasId: 'proteinChart', entries: daily, pick: (e) => e.protein,
        target: proteinTarget, direction: 'atLeast', unit: 'g',
      });
      charts.renderDailyTargetChart({
        canvasId: 'caloriesChart', entries: daily, pick: (e) => e.calories,
        target: calorieTarget, direction: 'atMost', unit: 'kcal',
      });
      charts.barChart('fvChart', allLabels, daily.map((r) => r.fv), COLORS.data);
      renderMacroChart(charts, daily, goals);
    },
    wellness: (charts) => {
      renderWellnessSparks(charts, daily);
      charts.lineChart('sleepChart', allLabels, daily.map((r) => r.sleep), COLORS.data, true, WELLNESS_REFERENCES.sleepH);
      charts.lineChart('energyChart', allLabels, daily.map((r) => r.energy), COLORS.blue, true, WELLNESS_REFERENCES.energy);
      charts.lineChart('stressChart', allLabels, daily.map((r) => r.stress), COLORS.data, true, WELLNESS_REFERENCES.stress);
      charts.lineChart('digestionChart', allLabels, daily.map((r) => r.digestion), COLORS.data, true, WELLNESS_REFERENCES.digestion);
      renderCorrelation(daily);
    },
    weeks: (charts) => {
      renderWeekCards(weekBlocks);
      weeklyChart(charts, 'weekBarChart', weekLabels, weekAverages);
      renderComments(daily);
    },
  };
}

/**
 * Wochenmittel als Linie, nicht als Balken.
 *
 * Balken behaupten eine Nulllinie. Bei Gewichten zwischen 89 und 98 kg ist die
 * Flaeche unter dem Balken bedeutungslos und die Unterschiede verschwinden.
 * Eine Linie darf bei einem beliebigen Wert beginnen.
 */
function weeklyChart(charts: Charts, id: string, labels: string[], values: (number | null)[]): void {
  const options = charts.mutableOptions();
  options.scales.y.beginAtZero = false;
  options.scales.y.grace = '15%';

  charts.upsert(id, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Wochenmittel',
        data: values,
        borderColor: COLORS.accent,
        backgroundColor: 'rgba(10, 132, 255, 0.10)',
        borderWidth: 2,
        pointRadius: 3,
        pointBackgroundColor: COLORS.accent,
        pointHoverRadius: 5,
        fill: true,
        tension: 0.3,
        spanGaps: true,
      }],
    },
    options,
  });
}

const MONTHS = [
  'Jan.', 'Feb.', 'März', 'Apr.', 'Mai', 'Juni',
  'Juli', 'Aug.', 'Sept.', 'Okt.', 'Nov.', 'Dez.',
] as const;

/**
 * Zeitraum als Unterzeile der Abschnitte.
 *
 * Steht neben der Ueberschrift statt in einer eigenen Zeile, damit sofort klar
 * ist, worauf sich die Zahlen darunter beziehen.
 */
function renderRangeCaption(daily: readonly DailyEntry[]): void {
  const dated = daily.filter((d) => d.dateObj);
  const first = dated[0]?.dateObj;
  const last = dated[dated.length - 1]?.dateObj;
  const caption = first && last
    ? `${first.getDate()}. ${MONTHS[first.getMonth()]} bis ${last.getDate()}. ${MONTHS[last.getMonth()]}`
    : '';
  setText('metrics-range', caption);
  setText('weight-range', caption);
}

function renderLegend(entries: readonly LegendEntry[]): void {
  const container = byId('weight-legend');
  if (!container) return;

  container.replaceChildren(...entries.map((entry) => {
    const item = document.createElement('span');
    const swatch = document.createElement('i');
    if (entry.dashed) {
      swatch.className = 'dashed';
      swatch.style.borderTopColor = entry.color;
    } else {
      swatch.style.background = entry.color;
    }
    item.append(swatch, document.createTextNode(entry.text));
    return item;
  }));
}

/**
 * Kopfzeile und Hinweis zur Herkunft der Zielwerte.
 *
 * Die Sollrate wird laufend aus dem aktuellen Gewicht berechnet, weil der
 * Trainer sie in Prozent vorgibt.
 */
function renderGoalContext(goals: Goals, currentWeightKg: number | null): void {
  // Die Sollrate steht im Hero neben der gemessenen Rate, dort gehoert sie hin.
  // Die Kopfzeile nennt nur, worum es geht.
  const rate = targetRateKgPerWeek(goals.rateOfLossPct, currentWeightKg);
  setText('header-sub', rate !== null && rate < 0 ? 'Makrocycle 1 · Cut' : 'Makrocycle 1');

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

function renderMacroChart(charts: Charts, daily: readonly DailyEntry[], goals: Goals): void {
  const options = charts.mutableOptions();
  options.plugins = { legend: { labels: { color: COLORS.muted, font: { size: 11 }, boxWidth: 10, boxHeight: 10 } } };
  options.indexAxis = 'y';

  charts.upsert('macroChart', {
    type: 'bar',
    data: {
      labels: ['Protein', 'Kohlenhydrate', 'Fett'],
      datasets: [
        {
          label: 'Ist',
          data: [
            Math.round(avg(daily.map((e) => e.protein)) ?? 0),
            Math.round(avg(daily.map((e) => e.carbs)) ?? 0),
            Math.round(avg(daily.map((e) => e.fat)) ?? 0),
          ],
          backgroundColor: COLORS.blue,
          borderRadius: 3,
          barPercentage: 0.55,
        },
        {
          label: 'Ziel',
          data: [goals.average.proteinG ?? 0, goals.average.carbsG ?? 0, goals.average.fatG ?? 0],
          backgroundColor: 'rgba(235, 235, 245, 0.18)',
          borderRadius: 3,
          barPercentage: 0.55,
        },
      ],
    },
    options,
  });
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
    value.textContent = average !== null ? `${decimal(average, 2)} kg` : '–';

    const change = document.createElement('div');
    change.className = 'wdelta';
    change.style.color = delta === null ? 'var(--text-tertiary)' : delta < 0 ? 'var(--green)' : 'var(--red)';
    change.textContent = index === 0 ? 'Start' : delta !== null ? `${signed(delta, 2)} kg` : '–';

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
    empty.className = 'analysis-note';
    empty.textContent = 'Keine Notizen im gewählten Zeitraum.';
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
