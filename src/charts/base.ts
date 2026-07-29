import { Chart, registerables, type ChartOptions, type ChartType } from 'chart.js';

Chart.register(...registerables);

/** Farben der Achsen und Gitter. */
const GRID_COLOR = '#1e2a3a';
const TICK_COLOR = '#94a3b8';
const Y_GRID_COLOR = '#334155';

const charts = new Map<string, Chart>();

/**
 * Grundeinstellungen aller Diagramme.
 *
 * `maintainAspectRatio: false` statt der frueheren Hoehenattribute am Canvas.
 * Die Hoehe kommt jetzt aus dem umgebenden `.chart-body`, sonst wurde aus einem
 * Diagramm auf breiten Bildschirmen ein flacher Streifen.
 */
export function baseOptions(): ChartOptions<'line' | 'bar'> {
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    plugins: { legend: { display: false }, tooltip: { mode: 'index', intersect: false } },
    scales: {
      x: { ticks: { color: TICK_COLOR, font: { size: 10 }, maxRotation: 45, autoSkipPadding: 12 }, grid: { color: GRID_COLOR } },
      y: { ticks: { color: TICK_COLOR, font: { size: 11 } }, grid: { color: Y_GRID_COLOR } },
    },
  };
}

export function destroyChart(id: string): void {
  const chart = charts.get(id);
  if (chart) {
    chart.destroy();
    charts.delete(id);
  }
}

export function getChart(id: string): Chart | undefined {
  return charts.get(id);
}

export function chartIds(): string[] {
  return [...charts.keys()];
}

function canvas(id: string): HTMLCanvasElement | null {
  const element = document.getElementById(id);
  return element instanceof HTMLCanvasElement ? element : null;
}

/**
 * Erzeugt ein Diagramm oder aktualisiert das vorhandene.
 *
 * Vorher wurde bei jedem Refresh jedes Diagramm zerstoert und neu gebaut, was
 * sichtbar flackert. Passen Typ und Anzahl der Datensaetze, werden nur die Daten
 * ersetzt.
 */
export interface ChartSpec {
  type: ChartType;
  data: { labels?: unknown[]; datasets: Record<string, unknown>[] };
  options?: unknown;
}

export function upsert(id: string, config: ChartSpec): void {
  const ctx = canvas(id);
  if (!ctx) return;

  const existing = charts.get(id);
  // Chart.js beschreibt seine Konfiguration als Union, in der `type` optional ist.
  const existingType = existing ? (existing.config as { type?: ChartType }).type : undefined;
  if (existing && existingType === config.type && existing.data.datasets.length === config.data.datasets.length) {
    existing.data.labels = config.data.labels ?? [];
    config.data.datasets.forEach((dataset, index) => {
      Object.assign(existing.data.datasets[index]!, dataset);
    });
    if (config.options) existing.options = config.options as ChartOptions;
    existing.update('none');
    return;
  }

  destroyChart(id);
  charts.set(id, new Chart(ctx, config as never));
}

export function lineChart(
  id: string,
  labels: string[],
  data: (number | null)[],
  color: string,
  fill = true,
  reference: number | null = null,
  movingAverage: (number | null)[] | null = null,
): void {
  const datasets: Record<string, unknown>[] = [{
    data,
    borderColor: color,
    backgroundColor: fill ? `${color}25` : 'transparent',
    borderWidth: 1.5,
    pointRadius: 2,
    pointHoverRadius: 6,
    fill,
    tension: 0.3,
    spanGaps: true,
  }];

  if (reference !== null) {
    datasets.push({
      data: labels.map(() => reference),
      borderColor: '#ffffff30',
      borderDash: [5, 5],
      borderWidth: 1,
      pointRadius: 0,
      fill: false,
    });
  }

  if (movingAverage !== null) {
    datasets.push({
      data: movingAverage,
      borderColor: '#ffffffcc',
      borderWidth: 2,
      pointRadius: 0,
      fill: false,
      tension: 0.4,
      spanGaps: true,
    });
  }

  upsert(id, {
    type: 'line',
    data: { labels, datasets },
    options: baseOptions(),
  });
}

export function barChart(id: string, labels: string[], data: (number | null)[], color: string): void {
  upsert(id, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: `${color}aa`,
        borderColor: color,
        borderWidth: 1,
        borderRadius: 4,
      }],
    },
    options: baseOptions(),
  });
}

export type { ChartType };
export { Chart };
