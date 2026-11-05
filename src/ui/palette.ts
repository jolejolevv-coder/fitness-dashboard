/**
 * Farben fuer Diagramme und Inline Stile, gelesen aus den Custom Properties.
 *
 * Chart.js zeichnet auf ein Canvas und kennt kein `var()`. Die Werte werden
 * deshalb bei jedem Zugriff aus dem Wurzelelement gelesen und folgen so dem
 * Schema des Recomp Logbuchs (nur dunkel). Halbtransparenz entsteht ueber `withAlpha`,
 * `color-mix` geht im Canvas nicht zuverlaessig.
 *
 * Markerregel: Daten ink, Bedienung und Prognose orange, gut gruen, schlecht rot, Warnung amber.
 */

/** Alpha Stufen der Datenfarbe auf dem Brett. */
const ALPHA_DATA = 0.55;
const ALPHA_FAINT = 0.28;
const ALPHA_LINE = 0.16;
const ALPHA_WASH = 0.1;

/** Werte aus `src/styles.css`, falls kein Dokument da ist (Tests ohne DOM). */
const FALLBACK: Readonly<Record<string, string>> = {
  '--ink': '#eef1f3',
  '--ink-2': '#9ba5ae',
  '--ink-3': '#8a949d',
  '--accent': '#ff6b2c',
  '--green': '#5fd47a',
  '--red': '#ff7a6e',
  '--warn': '#ffc65c',
  '--card': '#0d0f11',
  '--rail-edge': '#252a30',
};

const HEX_SHORT = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i;
const HEX_LONG = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i;
const RGB_FN = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i;

/** Zerlegt `#rgb`, `#rrggbb` und `rgb()`/`rgba()` in Kanaele, sonst `null`. */
export function parseColor(color: string): [number, number, number] | null {
  const text = color.trim();
  const short = HEX_SHORT.exec(text);
  if (short) return [1, 2, 3].map((i) => parseInt(short[i]! + short[i]!, 16)) as [number, number, number];
  const long = HEX_LONG.exec(text);
  if (long) return [1, 2, 3].map((i) => parseInt(long[i]!, 16)) as [number, number, number];
  const fn = RGB_FN.exec(text);
  if (fn) return [Number(fn[1]), Number(fn[2]), Number(fn[3])];
  return null;
}

/** Durchsichtige Variante einer Farbe als `rgba()`. Unlesbare Farben bleiben unveraendert. */
export function withAlpha(color: string, alpha: number): string {
  const channels = parseColor(color);
  if (!channels) return color;
  return `rgba(${channels[0]}, ${channels[1]}, ${channels[2]}, ${alpha})`;
}

function token(name: string): string {
  if (typeof document === 'undefined') return FALLBACK[name] ?? '#000000';
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || FALLBACK[name] || '#000000';
}

/** Lebendige Sicht: jeder Zugriff liest die aktuellen Custom Properties. */
export const COLORS = {
  get ink() { return token('--ink'); },
  /** Farbe der Bedienung, des Fortschritts und der Prognose. */
  get accent() { return token('--accent'); },
  get info() { return token('--accent'); },
  get good() { return token('--green'); },
  get pos() { return token('--green'); },
  get bad() { return token('--red'); },
  get neg() { return token('--red'); },
  get warn() { return token('--warn'); },
  /** Haupt Datenzug. */
  get data() { return withAlpha(token('--ink'), ALPHA_DATA); },
  /** Zurueckhaltend, fuer Tageswerte hinter einer Trendlinie. */
  get faint() { return withAlpha(token('--ink'), ALPHA_FAINT); },
  get soft() { return withAlpha(token('--ink'), ALPHA_FAINT); },
  get line() { return withAlpha(token('--ink'), ALPHA_LINE); },
  get wash() { return withAlpha(token('--accent'), ALPHA_WASH); },
  get muted() { return token('--ink-2'); },
  get dim() { return token('--ink-3'); },
  /** Achsenbeschriftung, Gitter und Tooltip. */
  get tick() { return token('--ink-3'); },
  get grid() { return token('--rail-edge'); },
  get tipBg() { return token('--card'); },
  get tipBorder() { return token('--rail-edge'); },
  get tipTitle() { return token('--ink'); },
  get tipBody() { return token('--ink-2'); },
};
