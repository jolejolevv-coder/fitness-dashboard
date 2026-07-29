import { Chart, registerables, type ChartOptions } from 'chart.js';

Chart.register(...registerables);

/** Farben der Achsen und Gitter. Wandern in Phase 5 in CSS Custom Properties. */
const GRID_COLOR = '#1e2a3a';
const TICK_COLOR = '#64748b';
const Y_GRID_COLOR = '#334155';

const charts = new Map<string, Chart>();

export function baseOptions(): ChartOptions<'line' | 'bar'> {
  return {
    responsive: true,
    plugins: { legend: { display: false }, tooltip: { mode: 'index', intersect: false } },
    scales: {
      x: { ticks: { color: TICK_COLOR, font: { size: 9 }, maxRotation: 45 }, grid: { color: GRID_COLOR } },
      y: { ticks: { color: TICK_COLOR, font: { size: 10 } }, grid: { color: Y_GRID_COLOR } },
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

function canvas(id: string): HTMLCanvasElement | null {
  const element = document.getElementById(id);
  return element instanceof HTMLCanvasElement ? element : null;
}

/** Registriert ein Diagramm, nachdem ein eventuelles Vorgaengerdiagramm entfernt wurde. */
export function register(id: string, chart: Chart): void {
  charts.set(id, chart);
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
  destroyChart(id);
  const ctx = canvas(id);
  if (!ctx) return;

  const datasets: any[] = [{
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
      borderColor: '#ffffff22',
      borderDash: [5, 5],
      borderWidth: 1,
      pointRadius: 0,
      fill: false,
    });
  }

  if (movingAverage !== null) {
    datasets.push({
      data: movingAverage,
      borderColor: '#ffffffbb',
      borderWidth: 2,
      pointRadius: 0,
      fill: false,
      tension: 0.4,
      spanGaps: true,
    });
  }

  register(id, new Chart(ctx, { type: 'line', data: { labels, datasets }, options: baseOptions() as ChartOptions<'line'> }));
}

export function barChart(id: string, labels: string[], data: (number | null)[], color: string): void {
  destroyChart(id);
  const ctx = canvas(id);
  if (!ctx) return;

  register(id, new Chart(ctx, {
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
    options: baseOptions() as ChartOptions<'bar'>,
  }));
}

export { Chart };
