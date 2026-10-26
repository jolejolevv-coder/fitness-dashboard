import { el } from './build';

/**
 * Bausteine der Magnetkarte: Bezeichnung, eine Zahl, Datenbasis.
 *
 * Eine Verweigerung steht an der Stelle der Zahl, darunter `keine Aussage`.
 */

/** Zahl mit Einheit als kleinem Kind. `tone` ist `is-ok`, `is-off`, `is-word` oder leer. */
export function valueNode(text: string, unit?: string, tone?: string): HTMLElement {
  return el('div', { class: tone ? `card-value ${tone}` : 'card-value' }, [
    document.createTextNode(text),
    unit ? el('small', { text: unit }) : null,
  ]);
}

/** Jede Basiszeile steht fuer sich, ohne Trennzeichen dazwischen. */
export function card(label: string, value: HTMLElement, basis: string | readonly string[]): HTMLElement {
  const lines = typeof basis === 'string' ? [basis] : basis;
  return el('div', { class: 'card' }, [
    el('div', { class: 'card-label', text: label }),
    value,
    ...lines.map((text) => el('div', { class: 'card-basis', text })),
  ]);
}

/** Verweigerung an der Stelle der Zahl, darunter `keine Aussage`. */
export function refusalCard(label: string, reason: string): HTMLElement {
  return el('div', { class: 'card' }, [
    el('div', { class: 'card-label', text: label }),
    el('div', { class: 'refusal', text: reason }),
    el('div', { class: 'card-basis', text: 'keine Aussage' }),
  ]);
}

/** Kapsel unter der Basis, rot daneben und gruen getroffen. */
export function mark(text: string, tone: 'is-ok' | 'is-off'): HTMLElement {
  return el('span', { class: `mark ${tone}`, text });
}
