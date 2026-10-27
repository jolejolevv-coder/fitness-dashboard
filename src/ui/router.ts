/**
 * Router als reine Funktion: Hash zu Ziel und Segment und zurueck.
 *
 * Kein DOM, kein `location`. Die Shell liest den Hash, fragt hier nach und
 * zeichnet. Damit sind Zurueck Geste, Neuladen und Lesezeichen testbar, ohne
 * einen Browser zu starten.
 */

export const DESTINATIONS = ['heute', 'verlauf', 'training', 'kueche'] as const;
export type Destination = (typeof DESTINATIONS)[number];

/** Segmente je Ziel, das erste ist die Vorgabe. Ziele ohne Segmente haben eine leere Liste. */
export const SEGMENTS: Readonly<Record<Destination, readonly string[]>> = {
  heute: [],
  verlauf: ['gewicht', 'ernaehrung', 'wellness', 'wochen', 'analyse'],
  training: ['eintragen', 'auswertung'],
  kueche: ['heute', 'woche', 'rezepte', 'einkauf'],
};

/** Segmente, die nur mit Endpunkt und Token des Apps Script erscheinen (ADR 0007). */
const LOG_SEGMENTS: readonly string[] = ['eintragen'];

/** Ziele, deren Daten im Bundle liegen und die deshalb ohne Sheet funktionieren. */
const STANDALONE_DESTINATIONS: readonly Destination[] = ['kueche'];

const ONLINE_START: Destination = 'heute';
const OFFLINE_START: Destination = 'kueche';

export interface Route {
  destination: Destination;
  /** `null` bei Zielen ohne Segmente. */
  segment: string | null;
}

/** Abschnitte im Markup, aus der Zeit der acht Reiter. Ein Ziel zeigt hoechstens einen davon. */
export type SectionId = 'overview' | 'nutrition' | 'wellness' | 'weeks' | 'analysis' | 'training' | 'log' | 'plan' | 'shopping';

/** Ansichten innerhalb des Abschnitts Plan, gleiche Werte wie in `plan.ts`. */
export type PlanView = 'today' | 'week' | 'prep' | 'proposal';

const SECTION_BY_SEGMENT: Readonly<Record<string, SectionId>> = {
  'verlauf/gewicht': 'overview',
  'verlauf/ernaehrung': 'nutrition',
  'verlauf/wellness': 'wellness',
  'verlauf/wochen': 'weeks',
  'verlauf/analyse': 'analysis',
  'training/auswertung': 'training',
  'training/eintragen': 'log',
  'kueche/heute': 'plan',
  'kueche/woche': 'plan',
  'kueche/rezepte': 'plan',
  'kueche/einkauf': 'shopping',
};

const PLAN_VIEW_BY_SEGMENT: Readonly<Record<string, PlanView>> = {
  heute: 'today',
  woche: 'week',
  rezepte: 'prep',
};

/** Alte Segmente der Kueche, Lesezeichen und Verlauf fuehren auf Rezepte. */
const LEGACY_SEGMENTS: Readonly<Record<string, string>> = {
  prep: 'rezepte',
  vorschlag: 'rezepte',
};

function isDestination(value: string): value is Destination {
  return (DESTINATIONS as readonly string[]).includes(value);
}

function defaultSegment(destination: Destination): string | null {
  return SEGMENTS[destination][0] ?? null;
}

/**
 * Liest einen Hash wie `#verlauf/wellness`. Ein unbekanntes Segment faellt auf
 * das erste des Ziels zurueck. Leerer oder unbekannter Hash ergibt `null`, die
 * Shell nimmt dann das Startziel.
 */
export function parseHash(hash: string): Route | null {
  const [head = '', tail = ''] = hash.replace(/^#/, '').toLowerCase().split('/');
  if (!isDestination(head)) return null;
  const wanted = head === 'kueche' ? (LEGACY_SEGMENTS[tail] ?? tail) : tail;
  const segment = SEGMENTS[head].includes(wanted) ? wanted : defaultSegment(head);
  return { destination: head, segment };
}

export function formatHash(route: Route): string {
  return route.segment === null ? `#${route.destination}` : `#${route.destination}/${route.segment}`;
}

export function visibleDestinations(hasSheet: boolean): readonly Destination[] {
  return hasSheet ? DESTINATIONS : STANDALONE_DESTINATIONS;
}

/** Segmente eines Ziels, die gezeigt werden. Ohne Zugang zum Apps Script fehlt `eintragen`. */
export function visibleSegments(destination: Destination, canLog: boolean): readonly string[] {
  return SEGMENTS[destination].filter((segment) => canLog || !LOG_SEGMENTS.includes(segment));
}

export function startRoute(hasSheet: boolean): Route {
  const destination = hasSheet ? ONLINE_START : OFFLINE_START;
  return { destination, segment: defaultSegment(destination) };
}

/**
 * Was tatsaechlich gezeigt wird. Ohne Sheet weicht ein Ziel, das Sheet Daten
 * braucht, auf das Startziel aus. Der Hash bleibt dabei stehen, damit nach dem
 * Laden der Daten wieder das gewuenschte Ziel erscheint.
 */
export function resolveRoute(requested: Route | null, hasSheet: boolean, canLog = false): Route {
  if (!requested || !visibleDestinations(hasSheet).includes(requested.destination)) return startRoute(hasSheet);
  if (requested.segment !== null && !visibleSegments(requested.destination, canLog).includes(requested.segment)) {
    // Ohne Zugang zum Apps Script ist die Vorgabe `eintragen` unsichtbar, dann gilt das erste sichtbare Segment.
    const fallback = visibleSegments(requested.destination, canLog)[0] ?? defaultSegment(requested.destination);
    return { destination: requested.destination, segment: fallback };
  }
  return requested;
}

/** Abschnitt im Markup zu einer Route. `null` fuer `heute`, das nur die Kopfbloecke zeigt. */
export function sectionFor(route: Route): SectionId | null {
  return SECTION_BY_SEGMENT[formatHash(route).slice(1)] ?? null;
}

/** Ansicht im Plan zu einer Route, `null` ausserhalb der Plan Segmente. */
export function planViewFor(route: Route): PlanView | null {
  if (route.destination !== 'kueche' || route.segment === null) return null;
  return PLAN_VIEW_BY_SEGMENT[route.segment] ?? null;
}

/** Segment der Kueche zu einer Ansicht im Plan, fuer Wechsel, die der Plan selbst ausloest. */
export function kuecheRouteFor(view: PlanView): Route {
  const segment = Object.keys(PLAN_VIEW_BY_SEGMENT).find((key) => PLAN_VIEW_BY_SEGMENT[key] === view) ?? defaultSegment('kueche');
  return { destination: 'kueche', segment };
}
