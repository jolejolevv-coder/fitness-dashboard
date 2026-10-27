import { countTabOpened } from '../config/usage';
import { byId } from './dom';
import { FOCUS_ATTR, el } from './build';
import {
  formatHash,
  parseHash,
  resolveRoute,
  sectionFor,
  visibleDestinations,
  visibleSegments,
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
  rezepte: 'Rezepte',
  einkauf: 'Einkauf',
  auswertung: 'Auswertung',
  eintragen: 'Eintragen',
};

let hasSheet = false;
/** Endpunkt und Token des Apps Script liegen vor, das Segment `eintragen` erscheint. */
let canLog = false;
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

/** Der erste Platz wird gesetzt, nicht angeglitten, sonst wandert der Magnet beim Start von links herein. */
function moveWithoutGlideFirst(element: HTMLElement, transform: string): void {
  if (element.style.transform) {
    element.style.transform = transform;
    return;
  }
  element.style.transition = 'none';
  element.style.transform = transform;
  void element.offsetWidth;
  element.style.transition = '';
}

/** The Transform Magnet Rule: der Magnetpunkt gleitet per `transform`, nie per `left`. */
function placeNavMagnet(): void {
  const magnet = document.querySelector<HTMLElement>('.nav-magnet');
  const active = document.querySelector<HTMLElement>('.nav-link[aria-current="page"]');
  if (!magnet) return;
  magnet.hidden = !active || active.hidden;
  if (!active || active.hidden) return;
  const nav = magnet.parentElement;
  // Ab 900 px steht die Leiste links, der Magnet sitzt dann auf der rechten Kante.
  const vertical = nav !== null && getComputedStyle(nav).flexDirection === 'column';
  const half = magnet.offsetWidth / 2;
  const x = vertical && nav ? nav.clientWidth - half : active.offsetLeft + active.offsetWidth / 2 - half;
  const y = vertical ? active.offsetTop + active.offsetHeight / 2 - half : 0;
  moveWithoutGlideFirst(magnet, `translate(${x}px, ${y}px)`);
}

function updateNav(route: Route): void {
  const visible = visibleDestinations(hasSheet);
  for (const link of navLinks()) {
    const destination = link.dataset['destination'] as Destination | undefined;
    link.hidden = !destination || !visible.includes(destination);
    if (destination === route.destination) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  }
  placeNavMagnet();
}

/** Puck unter den aktiven Eintrag schieben. Die Breite wird gesetzt, nicht animiert. */
function placePuck(bar: HTMLElement): void {
  const puck = bar.querySelector<HTMLElement>('.segment-puck');
  const active = bar.querySelector<HTMLElement>('.segment-item[aria-current="true"]');
  if (!puck || !active) return;
  puck.style.width = `${active.offsetWidth}px`;
  moveWithoutGlideFirst(puck, `translateX(${active.offsetLeft - PUCK_INSET_PX}px)`);
  const left = active.offsetLeft;
  const right = left + active.offsetWidth;
  if (left < bar.scrollLeft || right > bar.scrollLeft + bar.clientWidth) {
    bar.scrollLeft = Math.max(0, right - bar.clientWidth + PUCK_INSET_PX);
  }
}

/** Abstand des Pucks zur Innenkante der Leiste, gleich dem Polster der Leiste. */
const PUCK_INSET_PX = 3;

let segmentDestination: Destination | null = null;

function buildSegmentBar(destination: Destination): HTMLElement {
  const bar = el('div', { class: 'segment-bar', attrs: { role: 'group', 'aria-label': DESTINATION_LABELS[destination] } });
  bar.appendChild(el('span', { class: 'segment-puck', attrs: { 'aria-hidden': 'true' } }));
  for (const segment of visibleSegments(destination, canLog)) {
    const item = el('button', {
      class: 'segment-item',
      text: SEGMENT_LABELS[segment] ?? segment,
      attrs: { type: 'button', 'data-segment': segment, [FOCUS_ATTR]: `seg-${segment}` },
    });
    item.addEventListener('click', () => navigate({ destination, segment }));
    bar.appendChild(item);
  }
  return bar;
}

/** Bleibt das Ziel gleich, bleibt die Leiste stehen und nur der Puck gleitet. */
function renderSegmentBar(route: Route): void {
  const slot = byId('segment-bar');
  if (!slot) return;
  // Ein einzelnes Segment braucht keine Leiste.
  if (visibleSegments(route.destination, canLog).length < 2 || route.segment === null) {
    slot.replaceChildren();
    segmentDestination = null;
    return;
  }
  if (segmentDestination !== route.destination || !slot.firstElementChild) {
    slot.replaceChildren(buildSegmentBar(route.destination));
    segmentDestination = route.destination;
  }
  const bar = slot.firstElementChild as HTMLElement;
  for (const item of bar.querySelectorAll<HTMLElement>('.segment-item')) {
    if (item.dataset['segment'] === route.segment) item.setAttribute('aria-current', 'true');
    else item.removeAttribute('aria-current');
  }
  placePuck(bar);
}

function placeMagnets(): void {
  placeNavMagnet();
  const bar = document.querySelector<HTMLElement>('#segment-bar .segment-bar');
  if (bar) placePuck(bar);
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
  const route = resolveRoute(parseHash(window.location.hash), hasSheet, canLog);
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

/** Zugang zum Apps Script gespeichert oder entfernt. Baut die Segmentleiste neu. */
export function setCanLog(value: boolean): void {
  if (value === canLog) return;
  canLog = value;
  segmentDestination = null;
  if (current !== null) apply();
}

export function setupShell(onRoute: RouteHandler, initialHasSheet: boolean, initialCanLog: boolean): void {
  routeHandler = onRoute;
  hasSheet = initialHasSheet;
  canLog = initialCanLog;
  window.addEventListener('hashchange', apply);
  window.addEventListener('resize', placeMagnets);
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
  for (const button of document.querySelectorAll<HTMLButtonElement>('#range-chips .chip')) {
    button.addEventListener('click', () => {
      for (const other of document.querySelectorAll<HTMLButtonElement>('#range-chips .chip')) {
        other.setAttribute('aria-pressed', String(other === button));
      }
      onChange(Number(button.dataset['range']));
    });
  }
}
