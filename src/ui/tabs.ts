import { countTabOpened } from '../config/usage';

/**
 * Tabs mit Tastaturbedienung.
 *
 * Umgesetzt nach dem ueblichen Muster fuer `role="tablist"`: nur der aktive Tab
 * ist im Tabulatorfluss, Pfeiltasten wechseln, Pos1 und Ende springen an den
 * Rand. Vorher waren die Tabs nur mit der Maus bedienbar und trugen keine
 * Rollen.
 */

export type TabHandler = (name: string) => void;

let showHandler: TabHandler = () => undefined;

function tabButtons(): HTMLButtonElement[] {
  return [...document.querySelectorAll<HTMLButtonElement>('.tab')];
}

function activate(button: HTMLButtonElement, onShow: TabHandler, focus: boolean): void {
  const name = button.dataset['tab'];
  if (!name) return;

  for (const other of tabButtons()) {
    const selected = other === button;
    other.setAttribute('aria-selected', String(selected));
    other.tabIndex = selected ? 0 : -1;
  }

  for (const section of document.querySelectorAll('.section')) {
    section.classList.toggle('active', section.id === name);
  }

  // Stylesheets blenden damit Bloecke aus, die nur zu den Sheet Reitern gehoeren.
  document.body.dataset['tab'] = name;

  if (focus) button.focus();
  countTabOpened(name);
  onShow(name);
}

export function activeTab(): string {
  const active = tabButtons().find((b) => b.getAttribute('aria-selected') === 'true');
  return active?.dataset['tab'] ?? '';
}

/** Wechselt den Reiter im Code, mit denselben Folgen wie ein Klick. */
export function selectTab(name: string): void {
  const button = tabButtons().find((b) => b.dataset['tab'] === name);
  if (button) activate(button, showHandler, false);
}

export function setupTabs(onShow: TabHandler): void {
  const buttons = tabButtons();
  showHandler = onShow;
  document.body.dataset['tab'] = activeTab();

  buttons.forEach((button) => {
    button.tabIndex = button.getAttribute('aria-selected') === 'true' ? 0 : -1;
    button.addEventListener('click', () => activate(button, onShow, false));

    button.addEventListener('keydown', (event) => {
      // Ohne Sheet sind die Sheet Reiter ausgeblendet und nicht anspringbar.
      const visible = buttons.filter((b) => b.offsetParent !== null);
      const index = visible.indexOf(button);
      const keys: Record<string, number> = {
        ArrowRight: index + 1,
        ArrowLeft: index - 1,
        Home: 0,
        End: visible.length - 1,
      };
      const target = keys[event.key];
      if (target === undefined || index < 0) return;
      event.preventDefault();
      const next = visible[(target + visible.length) % visible.length];
      if (next) activate(next, onShow, true);
    });
  });
}

/** Setzt die Zeitraumknoepfe auf `aria-pressed` statt auf eine Klasse. */
export function setupRangeButtons(onChange: (days: number) => void): void {
  for (const button of document.querySelectorAll<HTMLButtonElement>('.range-btn')) {
    button.addEventListener('click', () => {
      for (const other of document.querySelectorAll<HTMLButtonElement>('.range-btn')) {
        other.setAttribute('aria-pressed', String(other === button));
      }
      onChange(Number(button.dataset['range']));
    });
  }
}
