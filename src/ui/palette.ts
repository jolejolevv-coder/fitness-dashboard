/**
 * Farben fuer Diagramme und Inline Stile, gelesen aus den Custom Properties.
 *
 * Chart.js zeichnet auf ein Canvas und kennt kein `var()`. Die Werte werden
 * deshalb bei jedem Zugriff aus dem Wurzelelement gelesen und folgen so dem
 * hellen und dem dunklen Schema. Halbtransparenz entsteht ueber `withAlpha`,
 * `color-mix` geht im Canvas nicht zuverlaessig.
 *
 * Markerregel: Daten ink, Bedienung und Prognose blau, gut gruen, schlecht rot.
 */

/** Alpha Stufen der Datenfarbe auf dem Brett. */
const ALPHA_DATA = 0.55;
const ALPHA_FAINT = 0.28;
const ALPHA_LINE = 0.16;
const ALPHA_WASH = 0.1;

/** Helle Werte, falls kein Dokument da ist (Tests ohne DOM). */
const FALLBACK: Readonly<Record<string, string>> = {
  '--ink': '#1b1e20',
  '--ink-2': '#555c60',
  '--ink-3': '#636a6e',
  '--blue': '#1d5fc4',
  '--green': '#1d7f48',
  '--red': '#c4372d',
  '--card': '#fbfcfb',
  '--rail-edge': '#c9cfcd',
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
  get blue() { return token('--blue'); },
  /** Farbe der Bedienung und der Prognose. */
  get accent() { return token('--blue'); },
  get info() { return token('--blue'); },
  get good() { return token('--green'); },
  get pos() { return token('--green'); },
  get bad() { return token('--red'); },
  get neg() { return token('--red'); },
  /** Das Orange ist entfallen, daneben heisst rot. */
  get warn() { return token('--red'); },
  /** Haupt Datenzug. */
  get data() { return withAlpha(token('--ink'), ALPHA_DATA); },
  /** Zurueckhaltend, fuer Tageswerte hinter einer Trendlinie. */
  get faint() { return withAlpha(token('--ink'), ALPHA_FAINT); },
  get soft() { return withAlpha(token('--ink'), ALPHA_FAINT); },
  get line() { return withAlpha(token('--ink'), ALPHA_LINE); },
  get wash() { return withAlpha(token('--blue'), ALPHA_WASH); },
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
