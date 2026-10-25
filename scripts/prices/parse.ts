import { parse } from 'node-html-parser';
import type { HTMLElement } from 'node-html-parser';
import { localBerlinToIso } from './berlin-time.ts';
import type { RawOffer, StoreName } from './types.ts';

/**
 * Liest die Angebotsseite. Selektoren und Gegenproben stehen in
 * `specs/features/muskelmarkt-parser.md`. Der Parser liest die `data-*`
 * Attribute und prueft sie gegen den sichtbaren Preis. Jede Abweichung wirft
 * einen Fehler, es gibt keine stille Korrektur.
 */

/** Markt laut `data-store` und die Abschnitts ID als Gegenprobe. */
const STORE_SECTIONS: Record<StoreName, string> = {
  Lidl: 'lidl',
  'Aldi Süd': 'aldi-s-d',
  Edeka: 'edeka',
};

const OFFER_SELECTOR = 'section.store-section article.offer-card';
const PRICE_ATTRIBUTE = /^\d+(?:\.\d{1,2})?$/;
const DAY_RANGE = /^([A-Za-zÄäÖöÜü]{2})\.?\s*[-–]\s*([A-Za-zÄäÖöÜü]{2})\.?\b/;

export class ParseError extends Error {}

function isStoreName(value: string | undefined): value is StoreName {
  return value !== undefined && Object.hasOwn(STORE_SECTIONS, value);
}

/** Sichtbarer Preis `6,99` oder `8,79 €` als Zahl, `null` wenn nicht lesbar. */
function parseVisiblePrice(text: string | undefined): number | null {
  if (text === undefined) return null;
  const m = /^\s*(\d+(?:,\d{1,2})?)\s*(?:€|EUR)?\s*$/.exec(text);
  return m ? Number(m[1]!.replace(',', '.')) : null;
}

function describe(card: HTMLElement): string {
  return `Angebot ${card.getAttribute('data-id') ?? '?'}`;
}

function sectionOf(card: HTMLElement): HTMLElement | null {
  let node: HTMLElement | null = card.parentNode;
  while (node) {
    if (node.tagName?.toLowerCase() === 'section') return node;
    node = node.parentNode;
  }
  return null;
}

/** Wochentagspanne aus der naechsten `.date-group-header`, etwa `Mo bis Sa`. */
function readValidDays(card: HTMLElement): string | null {
  let node: HTMLElement | null = card.parentNode;
  while (node) {
    if (node.classList?.contains('date-group')) {
      const header = node.querySelector('.date-group-header')?.text.trim() ?? '';
      const m = DAY_RANGE.exec(header);
      return m ? `${m[1]} bis ${m[2]}` : null;
    }
    node = node.parentNode;
  }
  return null;
}

function readPrices(card: HTMLElement): { price: number; regular: number | null } {
  const label = describe(card);
  const rawPrice = card.getAttribute('data-price');
  if (rawPrice === undefined || !PRICE_ATTRIBUTE.test(rawPrice.trim())) {
    throw new ParseError(`${label}: data-price fehlt oder ist ungueltig (${String(rawPrice)})`);
  }
  const price = Number(rawPrice);
  const visible = parseVisiblePrice(card.querySelector('.price-container .current-price')?.text);
  if (visible === null) throw new ParseError(`${label}: .current-price fehlt oder ist nicht lesbar`);
  if (visible !== price) {
    throw new ParseError(`${label}: data-price ${price} weicht von .current-price ${visible} ab`);
  }

  const rawRegular = (card.getAttribute('data-normal-price') ?? '').trim();
  const originalEl = card.querySelector('.price-container .original-price');
  if (rawRegular === '') {
    if (originalEl) throw new ParseError(`${label}: .original-price ohne data-normal-price`);
    return { price, regular: null };
  }
  if (!originalEl) throw new ParseError(`${label}: data-normal-price ohne .original-price`);
  if (!PRICE_ATTRIBUTE.test(rawRegular)) {
    throw new ParseError(`${label}: data-normal-price ungueltig (${rawRegular})`);
  }
  const regular = Number(rawRegular);
  const visibleRegular = parseVisiblePrice(originalEl.text);
  if (visibleRegular !== regular) {
    throw new ParseError(
      `${label}: data-normal-price ${regular} weicht von .original-price ${String(visibleRegular)} ab`,
    );
  }
  return { price, regular };
}

function readValidity(card: HTMLElement): { from: string; to: string } {
  const label = describe(card);
  const start = card.getAttribute('data-offer-start')?.trim() ?? '';
  const end = card.getAttribute('data-offer-end')?.trim() ?? '';
  const from = localBerlinToIso(start);
  const to = localBerlinToIso(end);
  if (from === null || to === null) {
    throw new ParseError(`${label}: data-offer-start oder data-offer-end fehlt oder ist ungueltig`);
  }
  return { from, to };
}

/**
 * Alle Produktkarten von Lidl, Aldi Sued und Edeka. Wirft `ParseError`, wenn die
 * Seite keine Abschnitte hat, kein Markt gefunden wird oder eine Karte die
 * Gegenproben nicht besteht.
 */
export function parseOffers(html: string): RawOffer[] {
  // Voreinstellung von node-html-parser: Inhalt von `script` bleibt Text. Damit
  // erscheinen Vorlagen mit `${storeName}` nie als Karten im DOM.
  const root = parse(html);
  if (root.querySelectorAll('section.store-section').length === 0) {
    throw new ParseError('Keine section.store-section gefunden, Markup geaendert?');
  }

  const offers: RawOffer[] = [];
  for (const card of root.querySelectorAll(OFFER_SELECTOR)) {
    // Aktionskarten haben kein data-name und sind keine Produkte.
    const product = card.getAttribute('data-name');
    if (product === undefined) continue;

    const store = card.getAttribute('data-store');
    if (!isStoreName(store)) continue;

    const section = sectionOf(card);
    if (section?.id !== STORE_SECTIONS[store]) {
      throw new ParseError(
        `${describe(card)}: data-store ${store} liegt im Abschnitt ${section?.id ?? 'ohne ID'}`,
      );
    }

    const { price, regular } = readPrices(card);
    const { from, to } = readValidity(card);
    const condition = card.querySelector('.membership-info .membership-icon-span')?.text.trim();

    offers.push({
      store,
      product: product.trim(),
      priceEur: price,
      regularPriceEur: regular,
      validFrom: from,
      validTo: to,
      validDays: readValidDays(card),
      condition: condition ? condition : null,
    });
  }

  if (offers.length === 0) throw new ParseError('Kein Angebot von Lidl, Aldi Süd oder Edeka gefunden');
  return offers;
}
