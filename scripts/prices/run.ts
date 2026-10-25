/**
 * Einstieg der Preis Pipeline (Phase 8.4), gestartet von `prices.yml`:
 * `node scripts/prices/run.ts`. Genau ein Seitenabruf, davor robots.txt.
 * Schreibt erst, wenn alles geparst und zugeordnet ist. Jeder Fehler setzt den
 * Exit Code 1 und laesst die vorhandenen Dateien unberuehrt.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { berlinDay, nowBerlinIso } from './berlin-time.ts';
import { parseOffers } from './parse.ts';
import {
  buildPricesFile,
  collectRegularPrices,
  matchOffers,
  mergeRegularPrices,
  samePrices,
} from './pipeline.ts';
import { isPathAllowed } from './robots.ts';
import type { PricesFile, RegularPricesFile, ShoppingItem } from './types.ts';

const SITE = 'https://www.muskelmarkt.de';
const OFFERS_PATH = '/app1.php';
const ROBOTS_PATH = '/robots.txt';
const USER_AGENT_TOKEN = 'fitness-dashboard-prices';
const USER_AGENT = `${USER_AGENT_TOKEN}/1.0 (+https://github.com/jolejolevv-coder/fitness-dashboard; private use, weekly)`;
const REQUEST_TIMEOUT_MS = 30_000;
const HTTP_OK = 200;
const HTTP_NOT_FOUND = 404;

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const ITEMS_FILE = resolve(ROOT, 'data', 'shopping_items.json');
const PRICES_FILE = resolve(ROOT, 'public', 'data', 'prices.json');
const REGULAR_FILE = resolve(ROOT, 'public', 'data', 'regular_prices.json');

async function get(path: string): Promise<Response> {
  return fetch(`${SITE}${path}`, {
    headers: { 'User-Agent': USER_AGENT },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
}

/** 404 gilt als erlaubt, 200 mit passender Sperre und jeder andere Status als Abbruch. */
async function assertRobotsAllow(): Promise<void> {
  const res = await get(ROBOTS_PATH);
  if (res.status === HTTP_NOT_FOUND) return;
  if (res.status !== HTTP_OK) throw new Error(`robots.txt: unerwarteter Status ${res.status}`);
  if (!isPathAllowed(await res.text(), USER_AGENT_TOKEN, OFFERS_PATH)) {
    throw new Error(`robots.txt sperrt ${OFFERS_PATH}, Abbruch`);
  }
}

async function fetchOffersHtml(): Promise<string> {
  const res = await get(OFFERS_PATH);
  if (res.status !== HTTP_OK) throw new Error(`${OFFERS_PATH}: unerwarteter Status ${res.status}`);
  return res.text();
}

function readJson<T>(file: string): T | null {
  if (!existsSync(file)) return null;
  return JSON.parse(readFileSync(file, 'utf8')) as T;
}

function readShoppingItems(): ShoppingItem[] {
  const items = readJson<ShoppingItem[]>(ITEMS_FILE);
  if (!Array.isArray(items)) throw new Error(`${ITEMS_FILE} fehlt oder ist kein Array`);
  for (const item of items) {
    if (typeof item.foodId !== 'string' || (item.unit !== 'g' && item.unit !== 'piece')) {
      throw new Error(`shopping_items.json: ungueltiger Eintrag ${JSON.stringify(item)}`);
    }
  }
  return items;
}

function writeJson(file: string, data: unknown): void {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

async function main(): Promise<void> {
  const items = readShoppingItems();
  await assertRobotsAllow();
  const html = await fetchOffersHtml();

  const raws = parseOffers(html);
  const offers = matchOffers(raws, items);
  if (offers.length === 0) {
    throw new Error(`Kein Treffer: ${raws.length} Angebote gelesen, keines passt zu shopping_items.json`);
  }

  const now = new Date();
  const prices = buildPricesFile(offers, nowBerlinIso(now));
  const oldPrices = readJson<PricesFile>(PRICES_FILE);
  if (samePrices(oldPrices, prices)) {
    console.log('prices.json unveraendert');
  } else {
    writeJson(PRICES_FILE, prices);
  }

  const oldRegular = readJson<RegularPricesFile>(REGULAR_FILE) ?? { entries: [] };
  const regular = mergeRegularPrices(oldRegular, collectRegularPrices(offers, berlinDay(now)));
  if (JSON.stringify(regular) !== JSON.stringify(oldRegular)) writeJson(REGULAR_FILE, regular);

  console.log(`${raws.length} Angebote gelesen, ${offers.length} Treffer, ${regular.entries.length} Dauerpreise`);
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
