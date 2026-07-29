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

/** Farbpalette der Oberflaeche. Wandert in Phase 5 in CSS Custom Properties. */
export const COLORS = {
  good: '#4ade80',
  warn: '#fbbf24',
  bad: '#f87171',
  muted: '#64748b',
  dim: '#475569',
  info: '#38bdf8',
  accent: '#f59e0b',
  violet: '#c084fc',
  indigo: '#818cf8',
  sky: '#0ea5e9',
} as const;
