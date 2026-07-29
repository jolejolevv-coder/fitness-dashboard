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
 * Farben fuer Diagramme, die dieselben Werte tragen wie die CSS Variablen.
 *
 * Chart.js zeichnet auf ein Canvas und kann keine Custom Properties lesen, die
 * Werte muessen deshalb doppelt vorliegen. Sie sind entsaettigt: neutrale Toene
 * fuer Daten, Gruen und Terrakotta nur dort, wo etwas gut oder schlecht ist.
 */
export const COLORS = {
  /** Neutrale Datenfarbe, Standard fuer Verlaeufe. */
  info: '#d6d2ca',
  data: '#d6d2ca',
  accent: '#d0a86b',
  good: '#7fb069',
  warn: '#d0a86b',
  bad: '#cf7d6b',
  muted: '#a8a49c',
  dim: '#8d8a83',
  /** Weitere Verlaufsfarben, bewusst nah beieinander statt bunt. */
  violet: '#a294a8',
  indigo: '#8fa0b4',
  sky: '#93a89c',
} as const;
