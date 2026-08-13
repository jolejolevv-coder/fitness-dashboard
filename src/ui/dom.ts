/** Kleine Helfer, damit die Renderfunktionen nicht von Nullpruefungen zugewachsen sind. */

export function byId<T extends HTMLElement = HTMLElement>(id: string): T | null {
  return document.getElementById(id) as T | null;
}

export function setText(id: string, text: string): void {
  const element = byId(id);
  if (element) element.textContent = text;
}

export function setColor(id: string, color: string): void {
  const element = byId(id);
  if (element) element.style.color = color;
}

export function show(id: string, visible: boolean, display = 'block'): void {
  const element = byId(id);
  if (element) element.style.display = visible ? display : 'none';
}

/**
 * Farben fuer Diagramme, dieselben Werte wie die CSS Variablen.
 *
 * Chart.js zeichnet auf ein Canvas und kann keine Custom Properties lesen, die
 * Werte muessen deshalb doppelt vorliegen. Systemfarben, dunkle Variante.
 * Datenreihen sind neutral, Farbe bleibt der Bewertung vorbehalten.
 */
export const COLORS = {
  /** Primaerer Datenzug, zugleich Farbe der Bedienelemente. */
  info: '#0a84ff',
  blue: '#0a84ff',
  data: 'rgba(235, 235, 245, 0.55)',
  /** Sehr zurueckhaltend, fuer Tageswerte hinter einer Trendlinie. */
  faint: 'rgba(235, 235, 245, 0.28)',
  good: '#30d158',
  warn: '#ff9f0a',
  bad: '#ff453a',
  muted: 'rgba(235, 235, 245, 0.60)',
  dim: 'rgba(235, 235, 245, 0.30)',
  /** Weitere Reihen, bewusst entsaettigt statt bunt. */
  accent: '#0a84ff',
  violet: '#bf5af2',
  indigo: '#5e5ce6',
  sky: '#64d2ff',
} as const;
