import type { PricesFile, RegularPricesFile } from '../../scripts/prices/types';
import { parsePricesFile, parseRegularPricesFile } from '../nutrition/prices';

/**
 * Laedt die Preisdateien zur Laufzeit. Jede Datei ist optional: fehlt sie, ist
 * sie kaputt oder fehlt das Netz, ist das Ergebnis `null` und die Liste zeigt
 * schlicht keine Preise. Es gibt kein Fehlerbild.
 */

export interface PriceData {
  prices: PricesFile | null;
  regular: RegularPricesFile | null;
}

const PRICES_FILE = 'data/prices.json';
const REGULAR_FILE = 'data/regular_prices.json';

async function fetchJson(file: string): Promise<unknown> {
  try {
    const response = await fetch(`${import.meta.env.BASE_URL}${file}`, { cache: 'no-cache' });
    if (!response.ok) return null;
    // Der Entwicklungsserver liefert fuer fehlende Dateien die Startseite, das scheitert hier am Parsen.
    return (await response.json()) as unknown;
  } catch {
    return null;
  }
}

let pending: Promise<PriceData> | null = null;

/** Ein Abruf je Seitenaufruf, danach aus dem Speicher. */
export function loadPriceData(): Promise<PriceData> {
  pending ??= Promise.all([fetchJson(PRICES_FILE), fetchJson(REGULAR_FILE)]).then(([prices, regular]) => ({
    prices: parsePricesFile(prices),
    regular: parseRegularPricesFile(regular),
  }));
  return pending;
}
