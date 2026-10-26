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

export { COLORS } from './palette';
