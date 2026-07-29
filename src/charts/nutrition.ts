import type { DailyEntry } from '../types';
import { movingAvg, MOVING_AVERAGE_WINDOW } from '../analytics/smoothing';
import { mutableOptions, upsert } from './base';
import { decimal, integer, signed } from '../ui/format';

/**
 * Tagesverlauf gegen einen Zielwert.
 *
 * Verwendet fuer Protein und Kalorien. Beide beantworten dieselbe Frage: liegt
 * der Tag auf der guten Seite der Vorgabe. Deshalb dieselbe Darstellung.
 *
 * Tage auf der falschen Seite bekommen einen farbigen Punkt, der Rest bleibt
 * neutral. Die Flaeche unter der Linie entfaellt, sie trug nichts bei und hat
 * die Zielline verdeckt.
 */

const COLORS = {
  data: '#ddd9d1',
  soft: '#9c988f',
  accent: '#dcb478',
  neg: '#dd8877',
} as const;

const WEEKDAYS = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'] as const;

export type Direction = 'atLeast' | 'atMost';

export interface DailyTargetChart {
  canvasId: string;
  entries: readonly DailyEntry[];
  pick: (entry: DailyEntry) => number | null;
  target: number | null;
  direction: Direction;
  unit: string;
  /** Nachkommastellen im Tooltip. */
  digits?: number;
}

function longLabel(entry: DailyEntry): string {
  const date = entry.dateObj;
  if (!date) return entry.date;
  return `${WEEKDAYS[date.getDay()]} ${date.getDate()}.${date.getMonth() + 1}.${date.getFullYear()}`;
}

function shortLabel(entry: DailyEntry): string {
  const date = entry.dateObj;
  if (!date) return entry.date;
  return `${String(date.getDate()).padStart(2, '0')}.${String(date.getMonth() + 1).padStart(2, '0')}.`;
}

function misses(value: number, target: number, direction: Direction): boolean {
  return direction === 'atLeast' ? value < target : value > target;
}

export function renderDailyTargetChart(spec: DailyTargetChart): void {
  const { canvasId, entries, pick, target, direction, unit } = spec;
  const digits = spec.digits ?? 0;

  const values = entries.map(pick);
  const smoothed = movingAvg(values);
  const labels = entries.map(shortLabel);
  const titles = entries.map(longLabel);

  const pointColors = values.map((value) =>
    value !== null && target !== null && misses(value, target, direction) ? COLORS.neg : COLORS.soft);
  const pointRadii = values.map((value) =>
    value !== null && target !== null && misses(value, target, direction) ? 2.6 : 1.4);

  const datasets: Record<string, unknown>[] = [
    {
      label: 'Tageswert',
      data: values,
      borderColor: '#ddd9d133',
      borderWidth: 1,
      pointRadius: pointRadii,
      pointBackgroundColor: pointColors,
      pointBorderWidth: 0,
      pointHoverRadius: 5,
      fill: false,
      tension: 0,
      spanGaps: true,
      order: 2,
    },
    {
      label: `${MOVING_AVERAGE_WINDOW} Tage Mittel`,
      data: smoothed,
      borderColor: COLORS.accent,
      borderWidth: 2,
      pointRadius: 0,
      pointHoverRadius: 0,
      fill: false,
      tension: 0.35,
      spanGaps: true,
      order: 1,
    },
  ];

  if (target !== null) {
    datasets.push({
      label: 'Ziel',
      data: labels.map(() => target),
      borderColor: '#8cc077aa',
      borderDash: [6, 5],
      borderWidth: 1.5,
      pointRadius: 0,
      pointHoverRadius: 0,
      fill: false,
      order: 3,
    });
  }

  const options = mutableOptions();
  options.interaction = { mode: 'index', intersect: false };
  options.plugins = {
    legend: { display: false },
    tooltip: {
      mode: 'index',
      intersect: false,
      backgroundColor: '#232120',
      borderColor: '#43403c',
      borderWidth: 1,
      padding: 10,
      titleColor: '#efece7',
      bodyColor: '#b8b4ac',
      usePointStyle: true,
      boxWidth: 8,
      boxHeight: 8,
      callbacks: {
        title: (items: { dataIndex: number }[]) => titles[items[0]?.dataIndex ?? 0] ?? '',
        label: (item: { datasetIndex: number; parsed: { y: number | null } }) => {
          if (item.parsed.y === null) return '';
          const shown = digits > 0 ? decimal(item.parsed.y, digits) : integer(item.parsed.y);
          if (item.datasetIndex === 0) return `Tageswert ${shown} ${unit}`;
          if (item.datasetIndex === 1) return `${MOVING_AVERAGE_WINDOW} Tage Mittel ${shown} ${unit}`;
          return `Ziel ${shown} ${unit}`;
        },
        afterBody: (items: { dataIndex: number }[]) => {
          const index = items[0]?.dataIndex;
          if (index === undefined || target === null) return [];
          const value = values[index];
          if (value === null || value === undefined) return [];
          const difference = direction === 'atMost' ? target - value : value - target;
          return [`${difference >= 0 ? 'Im Ziel' : 'Verfehlt'} · ${signed(difference, digits)} ${unit}`];
        },
      },
    },
  };

  upsert(canvasId, { type: 'line', data: { labels, datasets }, options });
}
