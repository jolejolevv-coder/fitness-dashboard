import { Chart, registerables, type ChartOptions, type ChartType } from 'chart.js';

Chart.register(...registerables);

/** Farben der Achsen und Gitter, passend zu den CSS Variablen. */
const TICK_COLOR = '#8d8a83';
const Y_GRID_COLOR = 'rgba(255, 255, 255, 0.055)';

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
      // Senkrechte Gitterlinien tragen nichts bei und verrauschen die Flaeche.
      x: {
        ticks: { color: TICK_COLOR, font: { size: 11 }, maxRotation: 0, autoSkip: true, maxTicksLimit: 8 },
        grid: { display: false },
        border: { color: 'rgba(255, 255, 255, 0.08)' },
      },
      y: {
        ticks: { color: TICK_COLOR, font: { size: 11 }, padding: 6 },
        grid: { color: Y_GRID_COLOR },
        border: { display: false },
      },
    },
  };
}

/**
 * Veraenderbare Sicht auf die Diagrammoptionen.
 *
 * Chart.js beschreibt seine Optionen als tief verschachtelte Union mit lauter
 * optionalen Feldern. Wer daran etwas setzen will, kaempft gegen das Typsystem
 * statt gegen ein Problem. Diese Form beschreibt genau die Felder, die hier
 * tatsaechlich gesetzt werden, und bleibt trotzdem ohne `any`.
 */
export interface AxisOptions {
  ticks: Record<string, unknown>;
  grid: Record<string, unknown>;
  border?: Record<string, unknown>;
  stacked?: boolean;
  beginAtZero?: boolean;
  grace?: string;
}

export interface MutableChartOptions {
  responsive: boolean;
  maintainAspectRatio: boolean;
  animation: false;
  plugins: Record<string, unknown>;
  scales: { x: AxisOptions; y: AxisOptions };
  interaction?: Record<string, unknown>;
  indexAxis?: 'x' | 'y';
}

/** Grundeinstellungen in veraenderbarer Form, fuer Diagramme mit Sonderwuenschen. */
export function mutableOptions(): MutableChartOptions {
  return baseOptions() as unknown as MutableChartOptions;
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
    backgroundColor: fill ? `${color}14` : 'transparent',
    borderWidth: 1.75,
    // Punkte erst beim Zeigen. Achtzig Punkte auf einer Linie sind Rauschen.
    pointRadius: 0,
    pointHoverRadius: 4,
    pointBackgroundColor: color,
    fill,
    tension: 0.3,
    spanGaps: true,
  }];

  if (reference !== null) {
    datasets.push({
      data: labels.map(() => reference),
      borderColor: '#ffffff26',
      borderDash: [5, 5],
      borderWidth: 1,
      pointRadius: 0,
      fill: false,
    });
  }

  if (movingAverage !== null) {
    datasets.push({
      data: movingAverage,
      borderColor: '#d0a86b',
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
        backgroundColor: `${color}99`,
        borderColor: 'transparent',
        borderWidth: 0,
        borderRadius: 2,
      }],
    },
    options: baseOptions(),
  });
}

export type { ChartType };
export { Chart };
