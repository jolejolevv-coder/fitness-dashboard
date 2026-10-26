import { countTabOpened } from '../config/usage';
import { byId } from './dom';
import { focusedKey, restoreFocus, segmented } from './build';
import {
  SEGMENTS,
  formatHash,
  parseHash,
  resolveRoute,
  sectionFor,
  visibleDestinations,
  type Destination,
  type Route,
} from './router';

/**
 * App Huelle: Navigation, obere Leiste, Segmentleiste und Einstellungen.
 *
 * Die Navigation besteht aus Links auf Hashes. Klick, Zurueck Geste und
 * Neuladen laufen damit alle ueber `hashchange`, es gibt nur einen Weg in eine
 * Route. Unten am Handy und links ab 900 px ist dasselbe Markup, nur das CSS
 * unterscheidet sich.
 */

export type RouteHandler = (route: Route) => void;

const DESTINATION_LABELS: Readonly<Record<Destination, string>> = {
  heute: 'Heute',
  verlauf: 'Verlauf',
  training: 'Training',
  kueche: 'Küche',
};

const SEGMENT_LABELS: Readonly<Record<string, string>> = {
  gewicht: 'Gewicht',
  ernaehrung: 'Ernährung',
  wellness: 'Wellness',
  wochen: 'Wochen',
  analyse: 'Analyse',
  heute: 'Heute',
  woche: 'Woche',
  prep: 'Prep',
  vorschlag: 'Vorschlag',
  einkauf: 'Einkauf',
};

let hasSheet = false;
let current: Route | null = null;
let routeHandler: RouteHandler = () => undefined;

export function currentRoute(): Route | null {
  return current;
}

/** Wechselt per Hash, damit die Zurueck Geste den Schritt kennt. */
export function navigate(route: Route): void {
  const hash = formatHash(route);
  if (window.location.hash === hash) return;
  window.location.hash = hash;
}

function navLinks(): HTMLAnchorElement[] {
  return [...document.querySelectorAll<HTMLAnchorElement>('.nav-link')];
}

function updateNav(route: Route): void {
  const visible = visibleDestinations(hasSheet);
  for (const link of navLinks()) {
    const destination = link.dataset['destination'] as Destination | undefined;
    link.hidden = !destination || !visible.includes(destination);
    if (destination === route.destination) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  }
}

function renderSegmentBar(route: Route): void {
  const slot = byId('segment-bar');
  if (!slot) return;
  const segments = SEGMENTS[route.destination];
  if (!segments.length || route.segment === null) {
    slot.replaceChildren();
    return;
  }
  const focus = focusedKey();
  const choices = segments.map((value) => ({ value, text: SEGMENT_LABELS[value] ?? value }));
  slot.replaceChildren(segmented(DESTINATION_LABELS[route.destination], choices, route.segment, (segment) => {
    navigate({ destination: route.destination, segment });
  }));
  restoreFocus(slot, focus);
}

function showSections(route: Route): void {
  const active = sectionFor(route);
  for (const section of document.querySelectorAll('.section')) {
    section.classList.toggle('active', section.id === active);
  }
  const today = byId('view-heute');
  if (today) today.hidden = route.destination !== 'heute';
}

function apply(): void {
  const route = resolveRoute(parseHash(window.location.hash), hasSheet);
  const changed = current === null || formatHash(current) !== formatHash(route);
  current = route;

  // Stylesheets blenden damit Bloecke aus, die nur zu einem Ziel gehoeren.
  document.body.dataset['destination'] = route.destination;
  document.body.dataset['segment'] = route.segment ?? '';
  const title = byId('topbar-title');
  if (title) title.textContent = DESTINATION_LABELS[route.destination];

  updateNav(route);
  renderSegmentBar(route);
  showSections(route);
  if (changed) countTabOpened(formatHash(route).slice(1));
  routeHandler(route);
}

/** Mit oder ohne Sheet Daten. Aendert die sichtbaren Ziele und eventuell das gezeigte Ziel. */
export function setHasSheet(value: boolean): void {
  if (value === hasSheet && current !== null) return;
  hasSheet = value;
  apply();
}

export function setupShell(onRoute: RouteHandler, initialHasSheet: boolean): void {
  routeHandler = onRoute;
  hasSheet = initialHasSheet;
  window.addEventListener('hashchange', apply);
  apply();
}

// ── Einstellungen ────────────────────────────────────────────────────────────

function settingsDialog(): HTMLDialogElement | null {
  return byId<HTMLDialogElement>('settings');
}

export function openSettings(): void {
  const dialog = settingsDialog();
  if (dialog && !dialog.open) dialog.showModal();
}

export function closeSettings(): void {
  settingsDialog()?.close();
}

// ── Zeitraum ─────────────────────────────────────────────────────────────────

/** Setzt die Zeitraumknoepfe auf `aria-pressed` statt auf eine Klasse. Sichtbar nur im Verlauf. */
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
