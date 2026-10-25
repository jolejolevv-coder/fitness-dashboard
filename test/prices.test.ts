import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { berlinDay, localBerlinToIso, nowBerlinIso } from '../scripts/prices/berlin-time.ts';
import { itemMatches } from '../scripts/prices/match.ts';
import { ParseError, parseOffers } from '../scripts/prices/parse.ts';
import {
  buildPricesFile,
  collectRegularPrices,
  matchOffers,
  mergeRegularPrices,
  samePrices,
} from '../scripts/prices/pipeline.ts';
import { parseQuantity } from '../scripts/prices/quantity.ts';
import { isPathAllowed } from '../scripts/prices/robots.ts';
import type { RegularPrice, ShoppingItem } from '../scripts/prices/types.ts';

const PROBE = readFileSync(new URL('./prices/probe.html', import.meta.url), 'utf8');
const UA = 'fitness-dashboard-prices';

const ITEMS: ShoppingItem[] = [
  {
    foodId: 'chicken_breast',
    unit: 'g',
    match: { include: ['Hähnchenbrust'], exclude: ['mariniert'] },
  },
  { foodId: 'skyr', unit: 'g', match: { include: ['Skyr'], exclude: [] } },
  {
    foodId: 'beef_mince_5',
    unit: 'g',
    match: { include: ['Rinderhack'], exclude: ['20%'] },
  },
  { foodId: 'eggs', unit: 'piece', gramsPerPiece: 60, match: { include: ['Eier'], exclude: [] } },
  { foodId: 'oats', unit: 'g', match: { include: ['haferflocken'], exclude: [] } },
  { foodId: 'peanut_butter', unit: 'g', match: { include: ['Erdnussbutter'], exclude: [] } },
  { foodId: 'avocado', unit: 'piece', match: { include: ['Avocado'], exclude: [] } },
  { foodId: 'bar', unit: 'g', stock: true, match: { include: ['Hähnchenbrust'], exclude: [] } },
];

describe('parseOffers', () => {
  const offers = parseOffers(PROBE);
  const byProduct = (part: string) => offers.find((o) => o.product.includes(part))!;

  it('liest nur Lidl, Aldi Süd und Edeka ausserhalb von script, ohne Aktionskarten', () => {
    expect(offers).toHaveLength(8);
    expect(new Set(offers.map((o) => o.store))).toEqual(new Set(['Lidl', 'Aldi Süd', 'Edeka']));
    expect(offers.some((o) => o.product.includes('Kopie'))).toBe(false);
    expect(offers.some((o) => o.product.includes('Rabatt'))).toBe(false);
  });

  it('ignoriert fremde Märkte', () => {
    expect(offers.some((o) => o.product === 'Hähnchenbrustfilet 500g')).toBe(false);
  });

  it('liest ein Angebot mit Normalpreis samt Gültigkeit in Berlin Zeit', () => {
    const o = byProduct('Hähnchenbrustfilet 600g');
    expect(o.priceEur).toBe(5.99);
    expect(o.regularPriceEur).toBe(7.49);
    expect(o.validFrom).toBe('2026-10-26T00:00:00+01:00');
    expect(o.validTo).toBe('2026-10-31T23:59:59+01:00');
    expect(o.validDays).toBe('Mo bis Sa');
    expect(o.condition).toBeNull();
  });

  it('setzt ohne Normalpreis null und liest die Gruppe Do bis Sa', () => {
    const o = byProduct('Eier');
    expect(o.regularPriceEur).toBeNull();
    expect(o.validDays).toBe('Do bis Sa');
  });

  it('übernimmt die Bedingung bei App und Kundenkartenpreisen', () => {
    expect(byProduct('Erdnussbutter').condition).toBe('Mit der App');
    expect(byProduct('Rinderhack 5%').condition).toBe('Lidl Plus');
  });

  it('dekodiert HTML Entities im Produktnamen', () => {
    expect(byProduct('Erdnussbutter').product).toBe('Erdnussbutter "Crunchy" 350g');
  });

  it('scheitert bei Abweichung von data-price und sichtbarem Preis', () => {
    const broken = PROBE.replace('<span class="current-price">5,99</span>', '<span class="current-price">5,89</span>');
    expect(() => parseOffers(broken)).toThrow(ParseError);
  });

  it('scheitert bei data-normal-price ohne original-price und umgekehrt', () => {
    const noOriginal = PROBE.replace('<span class="original-price">7,49 €</span>', '');
    expect(() => parseOffers(noOriginal)).toThrow(/ohne \.original-price/);
    const noAttribute = PROBE.replace('data-normal-price="7.49"', 'data-normal-price=""');
    expect(() => parseOffers(noAttribute)).toThrow(/ohne data-normal-price/);
  });

  it('scheitert bei Abweichung des Normalpreises', () => {
    const broken = PROBE.replace('<span class="original-price">7,49 €</span>', '<span class="original-price">7,59 €</span>');
    expect(() => parseOffers(broken)).toThrow(ParseError);
  });

  it('scheitert bei fehlendem Pflichtattribut', () => {
    expect(() => parseOffers(PROBE.replace(' data-price="5.99"', ''))).toThrow(/data-price/);
    expect(() => parseOffers(PROBE.replace(' data-offer-end="2026-10-31T23:59:59">\n        <div class="offer-store">', '>\n        <div class="offer-store">'))).toThrow(
      /data-offer/,
    );
  });

  it('scheitert ohne Abschnitte oder ohne Treffer der drei Märkte', () => {
    expect(() => parseOffers('<html><body><p>leer</p></body></html>')).toThrow(/store-section/);
    const onlyPenny = PROBE.replace(/data-store="(Lidl|Aldi Süd|Edeka)" data-name/g, 'data-store="Penny" data-name');
    expect(() => parseOffers(onlyPenny)).toThrow(/Kein Angebot/);
  });

  it('scheitert, wenn data-store nicht zum Abschnitt passt', () => {
    const broken = PROBE.replace('id="edeka"', 'id="rewe"');
    expect(() => parseOffers(broken)).toThrow(/Abschnitt/);
  });
});

describe('parseQuantity', () => {
  it.each([
    ['Hähnchenbrustfilet 600g', { amount: 600, unit: 'g' }],
    ['Haferflocken 1 kg', { amount: 1000, unit: 'g' }],
    ['Milch 1,5L', { amount: 1500, unit: 'ml' }],
    ['Saft 500ml', { amount: 500, unit: 'ml' }],
    ['Skyr 12x 265g', { amount: 3180, unit: 'g' }],
    ['Wasser 12x1l', { amount: 12000, unit: 'ml' }],
    ['Hack 450/500g', { amount: 450, unit: 'g' }],
    ['Freiland 10 Eier', { amount: 10, unit: 'piece' }],
  ])('%s', (name, expected) => {
    expect(parseQuantity(name)).toEqual(expected);
  });

  it('liefert null ohne Menge', () => {
    expect(parseQuantity('Avocado "Probe"')).toBeNull();
  });
});

describe('Matching', () => {
  const offers = matchOffers(parseOffers(PROBE), ITEMS);
  const find = (foodId: string) => offers.filter((o) => o.food_id === foodId);

  it('rechnet Größe und Grundpreis, auch bei Mehrfachpackung und Spanne', () => {
    const chicken = find('chicken_breast')[0]!;
    expect(chicken.size_g).toBe(600);
    expect(chicken.price_per_kg).toBe(9.98);
    expect(find('skyr')[0]!.size_g).toBe(1800);
    expect(find('skyr')[0]!.price_per_kg).toBe(5.33);
    expect(find('beef_mince_5')[0]!.size_g).toBe(450);
  });

  it('nutzt Stückzahl nur mit Stückgewicht, sonst bleibt die Größe unbekannt', () => {
    expect(find('eggs')[0]!.size_g).toBe(600);
    const avocado = find('avocado')[0]!;
    expect(avocado.size_g).toBeNull();
    expect(avocado.price_per_kg).toBeNull();
  });

  it('matcht case insensitive und nie Lagerware', () => {
    expect(find('oats')).toHaveLength(1);
    expect(find('bar')).toHaveLength(0);
  });

  it('ordnet fremde Märkte nicht zu', () => {
    expect(offers.every((o) => o.store !== ('Penny' as never))).toBe(true);
    expect(find('chicken_breast')).toHaveLength(1);
  });

  it('ordnet Aufschnitt nicht als Haehnchenbrustfilet zu', () => {
    const items = JSON.parse(readFileSync('data/shopping_items.json', 'utf8')) as ShoppingItem[];
    const hits = (name: string) => items.filter((it) => itemMatches(it, name)).map((it) => it.foodId);
    expect(hits('120g Delikatess Puten-/Hähnchenbrust XXL')).toEqual(['turkey_coldcut']);
    expect(hits('600g Hähnchen-Brustfilet')).toEqual(['chicken_breast']);
  });

  it('erkennt Tatar und Beefsteakhack auch ohne Fettangabe als beef_mince_5', () => {
    const lean = { foodId: 'beef_mince_5', unit: 'g' as const, match: { include: ['Tatar', 'Beefsteakhack'], exclude: [] } };
    expect(itemMatches(lean, '400g Rinder Tatar')).toBe(true);
    expect(itemMatches(lean, '500g Beefsteakhack')).toBe(true);
  });

  it('erkennt Rinderhack ohne Fettangabe nicht als beef_mince_5', () => {
    const products = find('beef_mince_5').map((o) => o.product);
    expect(products).toEqual(['Rinderhack 5% Fett 450/500g']);
  });

  it('beachtet Exclude Begriffe', () => {
    const item = ITEMS[0]!;
    expect(itemMatches(item, 'Hähnchenbrust mariniert 500g')).toBe(false);
    expect(itemMatches(item, 'HÄHNCHENBRUST 500g')).toBe(true);
  });

  it('baut den Dateikopf aus frühestem Start und spätestem Ende', () => {
    const file = buildPricesFile(offers, '2026-10-25T18:00:00+01:00');
    expect(file.valid_from).toBe('2026-10-26T00:00:00+01:00');
    expect(file.valid_to).toBe('2026-10-31T23:59:59+01:00');
  });

  it('erkennt unveränderte Preise trotz neuem Abrufzeitpunkt', () => {
    const a = buildPricesFile(offers, '2026-10-25T18:00:00+01:00');
    const b = buildPricesFile(offers, '2026-11-01T18:00:00+01:00');
    expect(samePrices(a, b)).toBe(true);
    expect(samePrices(null, b)).toBe(false);
  });
});

describe('Dauerpreise', () => {
  const offers = matchOffers(parseOffers(PROBE), ITEMS);
  const entry = (over: Partial<RegularPrice>): RegularPrice => ({
    food_id: 'chicken_breast',
    store: 'Lidl',
    regular_price_eur: 7.49,
    size_g: 600,
    price_per_kg: 12.48,
    seen_at: '2026-10-25',
    source: 'muskelmarkt',
    ...over,
  });

  it('sammelt nur Angebote mit Normalpreis', () => {
    const got = collectRegularPrices(offers, '2026-10-25');
    expect(got.map((r) => r.food_id).sort()).toEqual(['chicken_breast', 'oats', 'peanut_butter']);
    expect(got.find((r) => r.food_id === 'chicken_breast')).toEqual(entry({}));
  });

  it('überschreibt nur mit jüngerem Datum', () => {
    const base = { entries: [entry({ regular_price_eur: 7, seen_at: '2026-10-18', source: 'manual' })] };
    const newer = mergeRegularPrices(base, [entry({ seen_at: '2026-10-25' })]);
    expect(newer.entries[0]!.regular_price_eur).toBe(7.49);
    const same = mergeRegularPrices(newer, [entry({ regular_price_eur: 9, seen_at: '2026-10-25' })]);
    expect(same.entries[0]!.regular_price_eur).toBe(7.49);
    const older = mergeRegularPrices(newer, [entry({ regular_price_eur: 5, seen_at: '2026-10-11' })]);
    expect(older.entries[0]!.regular_price_eur).toBe(7.49);
  });

  it('behält Einträge, die der Lauf nicht berührt', () => {
    const base = { entries: [entry({ food_id: 'rice', seen_at: '2026-01-01', source: 'manual' })] };
    const merged = mergeRegularPrices(base, [entry({})]);
    expect(merged.entries.map((e) => e.food_id)).toEqual(['chicken_breast', 'rice']);
  });
});

describe('robots.txt', () => {
  it('erlaubt bei leerer oder harmloser Datei', () => {
    expect(isPathAllowed('', UA, '/app1.php')).toBe(true);
    expect(isPathAllowed('User-agent: *\nDisallow: /admin\n', UA, '/app1.php')).toBe(true);
    expect(isPathAllowed('User-agent: *\nDisallow:\n', UA, '/app1.php')).toBe(true);
  });

  it('sperrt bei Disallow für * oder unseren User Agent', () => {
    expect(isPathAllowed('User-agent: *\nDisallow: /\n', UA, '/app1.php')).toBe(false);
    expect(isPathAllowed('User-agent: *\nDisallow: /app1.php\n', UA, '/app1.php')).toBe(false);
    expect(isPathAllowed(`User-agent: ${UA}\nDisallow: /app1\n`, UA, '/app1.php')).toBe(false);
  });

  it('gibt unserer eigenen Gruppe Vorrang vor *', () => {
    const txt = `User-agent: *\nDisallow: /\n\nUser-agent: ${UA}\nAllow: /\n`;
    expect(isPathAllowed(txt, UA, '/app1.php')).toBe(true);
  });

  it('lässt ein längeres Allow gegen ein kürzeres Disallow gewinnen', () => {
    expect(isPathAllowed('User-agent: *\nDisallow: /\nAllow: /app1.php\n', UA, '/app1.php')).toBe(true);
  });
});

describe('Berlin Zeit', () => {
  it('berücksichtigt die Sommerzeitumstellung am 25.10.2026', () => {
    expect(localBerlinToIso('2026-10-24T12:00:00')).toBe('2026-10-24T12:00:00+02:00');
    expect(localBerlinToIso('2026-10-26T00:00:00')).toBe('2026-10-26T00:00:00+01:00');
    expect(localBerlinToIso('kaputt')).toBeNull();
  });

  it('rechnet Abrufzeit und Kalendertag in Berlin', () => {
    const at = new Date('2026-10-25T17:30:00Z');
    expect(nowBerlinIso(at)).toBe('2026-10-25T18:30:00+01:00');
    expect(berlinDay(new Date('2026-10-25T23:30:00Z'))).toBe('2026-10-26');
  });
});
