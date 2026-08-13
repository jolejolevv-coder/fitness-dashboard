import type { DailyEntry } from '../types';
import { movingAvg, MOVING_AVERAGE_WINDOW } from '../analytics/smoothing';
import { projectToTarget, smoothedWeightSeries, weightTrend } from '../analytics/trend';
import { mutableOptions, upsert } from './base';
import { decimal } from '../ui/format';

/**
 * Der Gewichtsverlauf, das wichtigste Diagramm der Seite.
 *
 * Vier Ansichten auf denselben Daten. Alle rechnen mit den bestehenden
 * Funktionen aus `analytics`, es entstehen keine neuen Groessen.
 */

export type WeightMode = 'weight' | 'trend' | 'forecast' | 'delta';

const MS_PER_DAY = 864e5;

/** Ab dieser Abweichung vom geglaetteten Verlauf gilt ein Tag als Ausreisser. */
const OUTLIER_KG = 1.0;

/** So weit reicht die Prognose hoechstens in die Zukunft. */
const MAX_FORECAST_DAYS = 400;

const COLORS = {
  data: 'rgba(235, 235, 245, 0.55)',
  soft: 'rgba(235, 235, 245, 0.30)',
  accent: '#0a84ff',
  pos: '#30d158',
  neg: '#ff453a',
} as const;

function label(date: Date): string {
  return `${String(date.getDate()).padStart(2, '0')}.${String(date.getMonth() + 1).padStart(2, '0')}.`;
}

interface Series {
  dates: Date[];
  labels: string[];
  weights: (number | null)[];
  smoothed: (number | null)[];
}

function buildSeries(daily: readonly DailyEntry[]): Series | null {
  const weighed = daily
    .filter((e) => e.dateObj && e.weight !== null && !isNaN(e.weight))
    .sort((a, b) => a.dateObj!.getTime() - b.dateObj!.getTime());
  if (!weighed.length) return null;

  const dates = weighed.map((e) => e.dateObj!);
  return {
    dates,
    labels: dates.map(label),
    weights: weighed.map((e) => e.weight),
    smoothed: movingAvg(weighed.map((e) => e.weight)),
  };
}

/** Punktgroesse je Tag. Ausreisser gegen den geglaetteten Verlauf werden sichtbar. */
function pointStyle(series: Series): { radius: number[]; colors: string[] } {
  const radius: number[] = [];
  const colors: string[] = [];
  for (let i = 0; i < series.weights.length; i++) {
    const weight = series.weights[i] ?? null;
    const smooth = series.smoothed[i] ?? null;
    const outlier = weight !== null && smooth !== null && Math.abs(weight - smooth) > OUTLIER_KG;
    // Nur auffaellige Tage bekommen ueberhaupt einen Punkt. Achtzig Punkte auf
    // einer Linie sind Rauschen, und farbige Punkte konkurrieren mit dem Trend.
    radius.push(outlier ? 2.2 : 0);
    colors.push(COLORS.data);
  }
  return { radius, colors };
}

function withTooltip(unit: string): Record<string, unknown> {
  return {
    mode: 'index',
    intersect: false,
    backgroundColor: 'rgba(44, 44, 46, 0.98)',
    borderColor: 'rgba(84, 84, 88, 0.5)',
    borderWidth: 1,
    padding: 10,
    titleColor: '#f5f5f7',
    bodyColor: 'rgba(235, 235, 245, 0.6)',
    displayColors: true,
    boxWidth: 8,
    boxHeight: 8,
    usePointStyle: true,
    callbacks: {
      label: (item: { dataset: { label?: string }; parsed: { y: number | null } }) => {
        if (item.parsed.y === null) return '';
        return `${item.dataset.label ?? ''}: ${decimal(item.parsed.y, 2)} ${unit}`;
      },
    },
  };
}

function options(unit: string, extra: Record<string, unknown> = {}): Record<string, unknown> {
  const base = mutableOptions();
  base.plugins = { legend: { display: false }, tooltip: withTooltip(unit) };
  base.scales.x.ticks.maxTicksLimit = 9;
  base.scales.x.ticks.maxRotation = 0;
  base.interaction = { mode: 'index', intersect: false };
  return { ...base, ...extra };
}

export interface LegendEntry {
  text: string;
  color: string;
  dashed?: boolean;
}

/** Zeichnet das Diagramm und liefert die passende Legende zurueck. */
export function renderWeightChart(
  canvasId: string,
  daily: readonly DailyEntry[],
  mode: WeightMode,
  targetWeightKg: number | null,
): LegendEntry[] {
  const series = buildSeries(daily);
  if (!series) return [];

  if (mode === 'delta') return renderDelta(canvasId, series);
  if (mode === 'trend') return renderTrend(canvasId, series);
  if (mode === 'forecast') return renderForecast(canvasId, daily, series, targetWeightKg);
  return renderWeight(canvasId, series, targetWeightKg);
}

function renderWeight(canvasId: string, series: Series, targetWeightKg: number | null): LegendEntry[] {
  const points = pointStyle(series);
  const datasets: Record<string, unknown>[] = [
    {
      label: 'Tageswert',
      data: series.weights,
      borderColor: 'rgba(235, 235, 245, 0.16)',
      borderWidth: 1,
      pointRadius: points.radius,
      pointBackgroundColor: points.colors,
      pointBorderWidth: 0,
      pointHoverRadius: 5,
      fill: false,
      tension: 0,
      spanGaps: true,
      order: 2,
    },
    {
      label: `${MOVING_AVERAGE_WINDOW} Tage Mittel`,
      data: series.smoothed,
      borderColor: COLORS.accent,
      borderWidth: 2.25,
      pointRadius: 0,
      pointHoverRadius: 0,
      fill: false,
      tension: 0.35,
      spanGaps: true,
      order: 1,
    },
  ];

  const legend: LegendEntry[] = [
    { text: 'Tageswert, auffällige Tage markiert', color: COLORS.soft },
    { text: `${MOVING_AVERAGE_WINDOW} Tage Mittel`, color: COLORS.accent },
  ];

  if (targetWeightKg !== null) {
    datasets.push({
      label: 'Zielgewicht',
      data: series.labels.map(() => targetWeightKg),
      borderColor: 'rgba(235, 235, 245, 0.28)',
      borderDash: [6, 6],
      borderWidth: 1.5,
      pointRadius: 0,
      pointHoverRadius: 0,
      fill: false,
      order: 3,
    });
    legend.push({ text: `Ziel ${decimal(targetWeightKg, 1)} kg`, color: COLORS.soft, dashed: true });
  }

  upsert(canvasId, { type: 'line', data: { labels: series.labels, datasets }, options: options('kg') });
  return legend;
}

function renderTrend(canvasId: string, series: Series): LegendEntry[] {
  // Regressionsgerade ueber die geglaetteten Punkte, sonst dieselbe Rechnung
  // wie in der Analyse.
  const smoothPoints = series.smoothed
    .map((value, index) => ({ value, index }))
    .filter((p): p is { value: number; index: number } => p.value !== null && p.value !== undefined);

  let line: (number | null)[] = series.labels.map(() => null);
  if (smoothPoints.length >= 2) {
    const first = smoothPoints[0]!;
    const last = smoothPoints[smoothPoints.length - 1]!;
    const n = smoothPoints.length;
    const meanX = smoothPoints.reduce((a, p) => a + p.index, 0) / n;
    const meanY = smoothPoints.reduce((a, p) => a + p.value, 0) / n;
    let sxx = 0, sxy = 0;
    for (const p of smoothPoints) {
      sxx += (p.index - meanX) ** 2;
      sxy += (p.index - meanX) * (p.value - meanY);
    }
    const slope = sxx === 0 ? 0 : sxy / sxx;
    line = series.labels.map((_, index) =>
      index >= first.index && index <= last.index ? meanY + slope * (index - meanX) : null);
  }

  upsert(canvasId, {
    type: 'line',
    data: {
      labels: series.labels,
      datasets: [
        {
          label: `${MOVING_AVERAGE_WINDOW} Tage Mittel`,
          data: series.smoothed,
          borderColor: COLORS.accent,
          borderWidth: 2.25,
          pointRadius: 0,
          fill: false,
          tension: 0.35,
          spanGaps: true,
        },
        {
          label: 'Gerade',
          data: line,
          borderColor: 'rgba(235, 235, 245, 0.30)',
          borderWidth: 1.5,
          borderDash: [5, 5],
          pointRadius: 0,
          fill: false,
          spanGaps: true,
        },
      ],
    },
    options: options('kg'),
  });

  return [
    { text: `${MOVING_AVERAGE_WINDOW} Tage Mittel`, color: COLORS.accent },
    { text: 'Ausgleichsgerade über den gesamten Zeitraum', color: COLORS.data, dashed: true },
  ];
}

function renderForecast(
  canvasId: string,
  daily: readonly DailyEntry[],
  series: Series,
  targetWeightKg: number | null,
): LegendEntry[] {
  const trend = weightTrend(daily);
  const projection = projectToTarget(trend, targetWeightKg);
  const smoothedSeries = smoothedWeightSeries(daily);

  if (!trend.ok || !projection.ok || !smoothedSeries.length) {
    const reason = !trend.ok ? trend.reason : !projection.ok ? projection.reason : 'Zu wenige Daten';
    upsert(canvasId, {
      type: 'line',
      data: { labels: series.labels, datasets: [{
        label: `${MOVING_AVERAGE_WINDOW} Tage Mittel`,
        data: series.smoothed,
        borderColor: COLORS.accent,
        borderWidth: 2.25,
        pointRadius: 0,
        fill: false,
        tension: 0.35,
        spanGaps: true,
      }] },
      options: options('kg'),
    });
    return [{ text: `Keine Prognose: ${reason}`, color: COLORS.soft }];
  }

  const last = smoothedSeries[smoothedSeries.length - 1]!;
  const days = Math.min(MAX_FORECAST_DAYS, Math.ceil((projection.latest.getTime() - last.date.getTime()) / MS_PER_DAY));

  const futureLabels: string[] = [];
  const central: (number | null)[] = series.labels.map(() => null);
  const optimistic: (number | null)[] = series.labels.map(() => null);
  const pessimistic: (number | null)[] = series.labels.map(() => null);

  // Der erste Prognosepunkt sitzt auf dem letzten gemessenen Wert, damit die
  // Linien ohne Sprung ineinander uebergehen.
  central[central.length - 1] = last.value;
  optimistic[optimistic.length - 1] = last.value;
  pessimistic[pessimistic.length - 1] = last.value;

  const perDay = trend.ratePerWeek / 7;
  const errorPerDay = (1.96 * trend.rateStdError) / 7;

  // Jede Linie endet, sobald sie das Ziel erreicht. Eine Prognose, die darueber
  // hinauslaeuft, sagt etwas aus, das niemand behauptet hat.
  const beyondTarget = (value: number): boolean => {
    if (targetWeightKg === null) return false;
    return perDay < 0 ? value < targetWeightKg : value > targetWeightKg;
  };

  for (let day = 1; day <= days; day++) {
    futureLabels.push(label(new Date(last.date.getTime() + day * MS_PER_DAY)));
    const at = (rate: number): number | null => {
      const value = last.value + rate * day;
      return beyondTarget(value) ? null : value;
    };
    central.push(at(perDay));
    optimistic.push(at(perDay + Math.sign(perDay) * errorPerDay));
    pessimistic.push(at(perDay - Math.sign(perDay) * errorPerDay));
  }

  const labels = [...series.labels, ...futureLabels];
  const pad = (values: (number | null)[]): (number | null)[] =>
    values.length < labels.length ? [...values, ...Array<null>(labels.length - values.length).fill(null)] : values;

  const datasets: Record<string, unknown>[] = [
    {
      label: 'Gemessen',
      data: pad(series.smoothed),
      borderColor: COLORS.accent,
      borderWidth: 2.25,
      pointRadius: 0,
      fill: false,
      tension: 0.35,
      spanGaps: true,
    },
    {
      label: 'Band, schneller',
      data: optimistic,
      borderColor: 'transparent',
      pointRadius: 0,
      fill: '+1',
      backgroundColor: 'rgba(10, 132, 255, 0.12)',
      spanGaps: false,
    },
    {
      label: 'Band, langsamer',
      data: pessimistic,
      borderColor: 'transparent',
      pointRadius: 0,
      fill: false,
      spanGaps: true,
    },
    {
      label: 'Prognose',
      data: central,
      borderColor: 'rgba(10, 132, 255, 0.65)',
      borderDash: [5, 4],
      borderWidth: 1.75,
      pointRadius: 0,
      fill: false,
      spanGaps: true,
    },
  ];

  if (targetWeightKg !== null) {
    datasets.push({
      label: 'Zielgewicht',
      data: labels.map(() => targetWeightKg),
      borderColor: 'rgba(235, 235, 245, 0.28)',
      borderDash: [6, 6],
      borderWidth: 1.5,
      pointRadius: 0,
      fill: false,
    });
  }

  upsert(canvasId, { type: 'line', data: { labels, datasets }, options: options('kg') });

  return [
    { text: 'Gemessenes Mittel', color: COLORS.accent },
    { text: 'Prognose bei gleichbleibender Rate', color: COLORS.accent, dashed: true },
    { text: 'Band aus dem Standardfehler der Rate', color: 'rgba(10, 132, 255, 0.35)' },
    ...(targetWeightKg !== null ? [{ text: `Ziel ${decimal(targetWeightKg, 1)} kg`, color: COLORS.soft, dashed: true }] : []),
  ];
}

function renderDelta(canvasId: string, series: Series): LegendEntry[] {
  // Tagesveraenderung des geglaetteten Verlaufs. Auf Rohwerten waere das reines
  // Rauschen von plusminus einem Kilogramm.
  const deltas: (number | null)[] = series.smoothed.map((value, index) => {
    const previous = index > 0 ? series.smoothed[index - 1] : null;
    if (value === null || value === undefined || previous === null || previous === undefined) return null;
    return value - previous;
  });

  upsert(canvasId, {
    type: 'bar',
    data: {
      labels: series.labels,
      datasets: [{
        label: 'Veränderung',
        data: deltas,
        backgroundColor: deltas.map((d) => (d === null ? 'transparent' : d <= 0 ? 'rgba(48, 209, 88, 0.75)' : 'rgba(255, 69, 58, 0.75)')),
        borderWidth: 0,
        borderRadius: 1,
      }],
    },
    options: options('kg'),
  });

  return [
    { text: 'Abnahme gegenüber dem Vortag', color: COLORS.pos },
    { text: 'Zunahme gegenüber dem Vortag', color: COLORS.neg },
  ];
}
