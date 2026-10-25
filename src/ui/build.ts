/**
 * Kleiner Baukasten fuer Elemente.
 *
 * Alle Texte gehen ueber `textContent`, nie ueber `innerHTML`. Daten aus dem
 * Plan und aus den Preisdateien koennen damit kein Markup einschleusen.
 */

export interface ElementOptions {
  class?: string;
  text?: string;
  attrs?: Record<string, string>;
}

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  options: ElementOptions = {},
  children: readonly (Node | null | undefined)[] = [],
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  if (options.class) element.className = options.class;
  if (options.text !== undefined) element.textContent = options.text;
  for (const [name, value] of Object.entries(options.attrs ?? {})) element.setAttribute(name, value);
  for (const child of children) if (child) element.appendChild(child);
  return element;
}

export function span(className: string, text: string): HTMLSpanElement {
  return el('span', { class: className, text });
}

/** Schluessel, um den Fokus nach dem Neuzeichnen auf dasselbe Element zurueckzulegen. */
export const FOCUS_ATTR = 'data-focus-key';

export function focusedKey(): string | null {
  const active = document.activeElement;
  return active instanceof HTMLElement ? active.getAttribute(FOCUS_ATTR) : null;
}

export function restoreFocus(root: HTMLElement, key: string | null): void {
  if (key === null) return;
  const target = [...root.querySelectorAll<HTMLElement>(`[${FOCUS_ATTR}]`)].find((e) => e.getAttribute(FOCUS_ATTR) === key);
  target?.focus({ preventScroll: true });
}

export interface CheckOptions {
  key: string;
  label: string;
  /** Zweite Zeile unter dem Namen. */
  detail?: Node | null;
  /** Rechts stehende Menge. */
  quantity?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

/** Ein ganzer Zeilenblock als Tippflaeche: Beschriftung und Kontrollkaestchen in einem `label`. */
export function checkRow(options: CheckOptions): HTMLLabelElement {
  const input = el('input', { attrs: { type: 'checkbox', [FOCUS_ATTR]: options.key } });
  input.checked = options.checked;
  input.addEventListener('change', () => options.onChange(input.checked));

  const body = el('span', { class: 'check-body' }, [
    el('span', { class: 'check-name', text: options.label }),
    options.detail ?? null,
  ]);
  const row = el('label', { class: options.checked ? 'check is-done' : 'check' }, [input, body]);
  if (options.quantity) row.appendChild(span('check-qty num', options.quantity));
  return row;
}

/** Segmentierte Umschaltung wie bei den Darstellungen im Gewichtsverlauf. */
export function segmented<T extends string>(
  label: string,
  choices: readonly { value: T; text: string }[],
  current: T,
  onSelect: (value: T) => void,
): HTMLElement {
  const group = el('span', { class: 'segmented', attrs: { role: 'group', 'aria-label': label } });
  for (const choice of choices) {
    const button = el('button', {
      class: 'seg',
      text: choice.text,
      attrs: { type: 'button', 'aria-pressed': String(choice.value === current), [FOCUS_ATTR]: `seg-${choice.value}` },
    });
    button.addEventListener('click', () => onSelect(choice.value));
    group.appendChild(button);
  }
  return group;
}
