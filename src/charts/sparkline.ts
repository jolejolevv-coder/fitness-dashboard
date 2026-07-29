import { upsert } from './base';

/**
 * Minimaldiagramm ohne Achsen, Gitter und Punkte.
 *
 * Fuer Groessen, bei denen die Form des Verlaufs die Aussage ist und die genaue
 * Zahl daneben steht. Schlaf und Energie brauchen kein eigenes Koordinatensystem
 * mit Beschriftung, um zu zeigen, dass es bergab geht.
 */
export function sparkline(canvasId: string, data: (number | null)[], color: string): void {
  upsert(canvasId, {
    type: 'line',
    data: {
      labels: data.map((_, index) => String(index)),
      datasets: [{
        data,
        borderColor: color,
        borderWidth: 1.5,
        pointRadius: 0,
        pointHoverRadius: 0,
        fill: true,
        backgroundColor: `${color}1a`,
        tension: 0.35,
        spanGaps: true,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      plugins: { legend: { display: false }, tooltip: { enabled: false } },
      scales: {
        x: { display: false },
        y: { display: false, grace: '12%' },
      },
      elements: { line: { capBezierPoints: true } },
    },
  });
}
