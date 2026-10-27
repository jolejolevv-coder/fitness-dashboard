import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RegularPrice } from '../scripts/prices/types.ts';
import { RECEIPT_PRICES_KEY, RECEIPT_SOURCE, WEIGHED_SIZE_G } from '../src/config/receipt';
import { parseRegularPricesFile } from '../src/nutrition/prices';
import { SHOPPING_ITEMS } from '../src/nutrition/plan';
import { buildReceiptSchema } from '../src/receipt/schema';
import { parseReceipt } from '../src/receipt/response';
import {
  exportRegularPricesJson,
  loadReceiptPrices,
  mergeRegularEntries,
  saveReceiptPrices,
  suggestedSizeG,
  toCandidates,
} from '../src/receipt/prices';
import { receiptStatusLine, requestReceipt } from '../src/receipt/request';
import type { Receipt } from '../src/receipt/types';

const FOOD_IDS = new Set(SHOPPING_ITEMS.map((item) => item.foodId));
const ITEMS_BY_ID = new Map(SHOPPING_ITEMS.map((item) => [item.foodId, item]));

function fixture(): unknown {
  return JSON.parse(readFileSync(join(__dirname, 'fixtures', 'receipt', 'aldi-2026-10-27.json'), 'utf8'));
}

function receipt(): Receipt {
  const parsed = parseReceipt(fixture(), FOOD_IDS);
  if (!parsed.ok) throw new Error(parsed.issues.join('; '));
  return parsed.receipt;
}

/** Wie die Pruefansicht: Zeile bekommt ihre Groesse (gedruckt oder Vorschlag) und geht in die Umrechnung. */
function candidatesOf(r: Receipt): RegularPrice[] {
  const lines = r.lines.map((line) => ({
    ...line,
    size_g: suggestedSizeG(line, line.food_id ? (ITEMS_BY_ID.get(line.food_id) ?? null) : null),
  }));
  return toCandidates(lines, r.store, r.date);
}

function candidate(entries: readonly RegularPrice[], foodId: string): RegularPrice {
  const found = entries.find((entry) => entry.food_id === foodId);
  if (!found) throw new Error(`kein Kandidat fuer ${foodId}`);
  return found;
}

describe('Antwort des Modells', () => {
  it('nimmt die Beispielantwort des Bons vom 27.10.2026 an', () => {
    const r = receipt();
    expect(r.store).toBe('Aldi Süd');
    expect(r.date).toBe('2026-10-27');
    expect(r.lines).toHaveLength(17);
  });

  it('ordnet 16 Artikel zu, das TK Gemuesesortiment bleibt ohne Zuordnung', () => {
    const r = receipt();
    const mapped = r.lines.filter((line) => line.food_id !== null);
    expect(mapped).toHaveLength(16);
    expect(r.lines.find((line) => line.text === 'TK Gemüsesortiment')?.food_id).toBeNull();
    const entries = candidatesOf(r);
    expect(entries).toHaveLength(16);
    expect(entries.every((entry) => entry.store === 'Aldi Süd' && entry.seen_at === '2026-10-27')).toBe(true);
    expect(entries.every((entry) => entry.source === RECEIPT_SOURCE)).toBe(true);
  });

  it('fragt weder Karte noch Autorisierung noch Adresse ab', () => {
    const schema = JSON.stringify(buildReceiptSchema([...FOOD_IDS]));
    for (const forbidden of ['card', 'karte', 'auth', 'address', 'adresse', 'iban', 'pan']) {
      expect(schema.toLowerCase()).not.toContain(forbidden);
    }
    const fixtureText = JSON.stringify(fixture()).toLowerCase();
    expect(fixtureText).not.toMatch(/karte|auth|iban|girocard|visa|mastercard/);
  });

  it('nimmt als Zuordnung nur Artikel der Einkaufsliste', () => {
    const schema = buildReceiptSchema(['a', 'b']) as { properties: { lines: { items: { properties: { food_id: unknown } } } } };
    expect(JSON.stringify(schema.properties.lines.items.properties.food_id)).toContain('"enum":["a","b"]');
  });
});

describe('Umrechnung', () => {
  it('nimmt bei Gewichtsware den gedruckten Kilopreis, nicht den Zeilenbetrag', () => {
    const zucchini = candidate(candidatesOf(receipt()), 'zucchini');
    expect(zucchini.price_per_kg).toBe(1.49);
    expect(zucchini.regular_price_eur).toBe(1.49);
    expect(zucchini.size_g).toBe(WEIGHED_SIZE_G);
  });

  it('nimmt die gedruckte Groesse, sonst die erste Packungsgroesse, bei Stueckware keine', () => {
    const entries = candidatesOf(receipt());
    expect(candidate(entries, 'passata')).toMatchObject({ size_g: 500, regular_price_eur: 0.65, price_per_kg: 1.3 });
    expect(candidate(entries, 'potato')).toMatchObject({ size_g: 2500, regular_price_eur: 2.59, price_per_kg: 1.04 });
    expect(candidate(entries, 'apple')).toMatchObject({ size_g: 1000, price_per_kg: 1.79 });
    // Keine Groesse gedruckt: erste Packungsgroesse aus shopping_items.json.
    expect(candidate(entries, 'oats')).toMatchObject({ size_g: 1000, regular_price_eur: 0.69, price_per_kg: 0.69 });
    expect(candidate(entries, 'beef_mince_5')).toMatchObject({ size_g: 400, price_per_kg: 13.73 });
    // Stueckware ohne gedruckte Groesse bleibt leer.
    expect(candidate(entries, 'avocado')).toMatchObject({ size_g: null, price_per_kg: null, regular_price_eur: 0.99 });
    expect(candidate(entries, 'egg_m')).toMatchObject({ size_g: null, price_per_kg: null });
  });

  it('gibt dem Einzelpreis den Vorrang vor der Menge', () => {
    const entries = candidatesOf(receipt());
    expect(candidate(entries, 'berries_frozen').regular_price_eur).toBe(3.29);
    expect(candidate(entries, 'kidney_beans').regular_price_eur).toBe(0.69);
  });

  it('fuehrt mehrfach gekaufte Artikel zu genau einem Eintrag zusammen', () => {
    const r = receipt();
    const bought = r.lines.find((line) => line.food_id === 'oats');
    if (!bought) throw new Error('Haferflocken fehlen');
    // Zweite Zeile desselben Artikels, teurer: der guenstigere Kilopreis gilt.
    const twice: Receipt = { ...r, lines: [...r.lines, { ...bought, text: 'Haferflocken kernig', price_eur: 0.89 }] };
    const entries = candidatesOf(twice);
    expect(entries.filter((entry) => entry.food_id === 'oats')).toHaveLength(1);
    expect(candidate(entries, 'oats').regular_price_eur).toBe(0.69);
    expect(new Set(entries.map((entry) => entry.food_id)).size).toBe(entries.length);
  });

  it('laesst abgewaehlte Zeilen und Zeilen ohne Artikel aus', () => {
    const r = receipt();
    const kept = r.lines.filter((line) => line.food_id !== 'avocado' && line.food_id !== null);
    expect(toCandidates(kept, r.store, r.date).some((entry) => entry.food_id === 'avocado')).toBe(false);
    expect(toCandidates([{ ...r.lines[0]!, price_eur: -1, food_id: 'oats' }], r.store, r.date)).toEqual([]);
  });
});

describe('Zusammenfuehrung mit vorhandenen Preisen', () => {
  const base: RegularPrice = {
    food_id: 'oats', store: 'Aldi Süd', regular_price_eur: 0.79, size_g: 1000, price_per_kg: 0.79,
    seen_at: '2026-10-20', source: 'manual',
  };

  it('ersetzt nur bei juengerem Bondatum', () => {
    const newer = { ...base, regular_price_eur: 0.69, price_per_kg: 0.69, seen_at: '2026-10-27', source: RECEIPT_SOURCE };
    expect(mergeRegularEntries([base], [newer])[0]).toEqual(newer);

    const older = { ...newer, seen_at: '2026-10-10' };
    expect(mergeRegularEntries([base], [older])[0]).toEqual(base);

    const sameDay = { ...newer, seen_at: base.seen_at };
    expect(mergeRegularEntries([base], [sameDay])[0]).toEqual(base);
  });

  it('fuehrt je Artikel und Markt getrennt', () => {
    const lidl = { ...base, store: 'Lidl' as const, seen_at: '2026-10-01' };
    const merged = mergeRegularEntries([base, lidl], [{ ...base, seen_at: '2026-10-27' }]);
    expect(merged).toHaveLength(2);
    expect(merged.find((entry) => entry.store === 'Lidl')?.seen_at).toBe('2026-10-01');
    expect(merged.find((entry) => entry.store === 'Aldi Süd')?.seen_at).toBe('2026-10-27');
  });

  it('exportiert im Format der regular_prices.json und liest es wieder ein', () => {
    const json = exportRegularPricesJson(candidatesOf(receipt()));
    expect(json.endsWith('}\n')).toBe(true);
    const parsed = parseRegularPricesFile(JSON.parse(json));
    expect(parsed?.entries).toHaveLength(16);
    const first = (JSON.parse(json) as { entries: Record<string, unknown>[] }).entries[0]!;
    expect(Object.keys(first)).toEqual(['food_id', 'store', 'regular_price_eur', 'size_g', 'price_per_kg', 'seen_at', 'source']);
  });
});

describe('Speicher', () => {
  const store = new Map<string, string>();

  beforeEach(() => {
    store.clear();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, value),
      removeItem: (key: string) => void store.delete(key),
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('aendert ohne ausdruecklichen Aufruf von saveReceiptPrices nichts', () => {
    candidatesOf(receipt());
    exportRegularPricesJson(candidatesOf(receipt()));
    expect(store.has(RECEIPT_PRICES_KEY)).toBe(false);
    expect(loadReceiptPrices()).toEqual([]);
  });

  it('speichert erst auf Aufruf und liest es zurueck', () => {
    saveReceiptPrices(candidatesOf(receipt()));
    expect(store.has(RECEIPT_PRICES_KEY)).toBe(true);
    expect(loadReceiptPrices()).toHaveLength(16);
  });

  it('behaelt beim Speichern den juengeren Wert', () => {
    const entries = candidatesOf(receipt());
    saveReceiptPrices(entries);
    const older = entries.map((entry) => ({ ...entry, regular_price_eur: 9.99, seen_at: '2026-09-01' }));
    saveReceiptPrices(older);
    expect(candidate(loadReceiptPrices(), 'oats').regular_price_eur).toBe(0.69);
  });

  it('liest kaputte Eintraege als leer', () => {
    store.set(RECEIPT_PRICES_KEY, '{kaputt');
    expect(loadReceiptPrices()).toEqual([]);
  });

  it('liefert ohne Speicher eine leere Liste', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('gesperrt');
      },
    });
    expect(loadReceiptPrices()).toEqual([]);
  });
});

describe('Kaputte Antworten', () => {
  const reasons = (data: unknown): string[] => {
    const result = parseReceipt(data, FOOD_IDS);
    return result.ok ? [] : result.issues;
  };
  const withChange = (change: (copy: Record<string, unknown>) => void): unknown => {
    const copy = fixture() as Record<string, unknown>;
    change(copy);
    return copy;
  };

  it('nennt den Grund je Fehlerfall', () => {
    expect(reasons('kein Objekt')).toEqual(['Antwort ist kein Objekt']);
    expect(reasons(withChange((c) => (c['store'] = null)))).toContain('Markt nicht erkannt');
    expect(reasons(withChange((c) => (c['store'] = 'Rewe')))).toContain('Markt unbekannt Rewe');
    expect(reasons(withChange((c) => (c['date'] = null)))).toContain('Datum nicht erkannt');
    expect(reasons(withChange((c) => (c['date'] = '2026-02-30')))).toContain('Datum ungueltig 2026-02-30');
    expect(reasons(withChange((c) => (c['lines'] = [])))).toContain('Keine Zeilen gelesen');
    expect(reasons(withChange((c) => delete c['lines']))).toContain('lines: Liste erwartet');
  });

  it('nennt die Zeile bei ungueltigen Werten', () => {
    const bad = (patch: Record<string, unknown>): string[] =>
      reasons(withChange((c) => (c['lines'] = [{ ...(c['lines'] as object[])[1], ...patch }])));
    expect(bad({ price_eur: 'zwei' })).toEqual(['lines[0]: Preis ungueltig zwei']);
    expect(bad({ quantity: 0 })).toEqual(['lines[0]: Menge ungueltig 0']);
    expect(bad({ food_id: 'unobtanium' })).toEqual(['lines[0]: unbekannter Artikel unobtanium']);
    expect(bad({ text: '' })).toEqual(['lines[0]: Text fehlt']);
  });
});

describe('API Aufruf', () => {
  const image = { mediaType: 'image/jpeg', base64: 'AAAA' };
  const items = SHOPPING_ITEMS.map((item) => ({ foodId: item.foodId, name: item.foodId, terms: item.match.include }));

  it('ergibt ohne Schluessel einen Status und ruft das Netz nicht', async () => {
    const loadSdk = vi.fn();
    const status = await requestReceipt({ apiKey: null, image, items }, { loadSdk });
    expect(status).toEqual({ kind: 'no-key' });
    expect(loadSdk).not.toHaveBeenCalled();
    expect(receiptStatusLine(status)).toBe('Kein API Schlüssel hinterlegt');
  });

  it('weist einen unbekannten Bildtyp ab', async () => {
    const status = await requestReceipt({ apiKey: 'k', image: { mediaType: 'image/heic', base64: 'AAAA' }, items });
    expect(status).toEqual({ kind: 'bad-image', mediaType: 'image/heic' });
  });

  it('meldet ein nicht ladbares SDK', async () => {
    const status = await requestReceipt({ apiKey: 'k', image, items }, { loadSdk: () => Promise.reject(new Error('weg')) });
    expect(status).toEqual({ kind: 'sdk-load' });
  });

  it('bildet Fehler, Antworten und Abbrueche auf Status ab', async () => {
    const sdk = await import('@anthropic-ai/sdk');
    const usage = { input_tokens: 3000, output_tokens: 900 };
    const run = (create: () => Promise<unknown>, signal?: AbortSignal) => {
      class Fake {
        messages = { create };
      }
      const loadSdk = (): Promise<typeof sdk> => Promise.resolve({ ...sdk, default: Fake as unknown as typeof sdk.default });
      return requestReceipt({ apiKey: 'k', image, items }, signal ? { loadSdk, signal } : { loadSdk });
    };
    const answer = (text: string, stop = 'end_turn') => () =>
      Promise.resolve({ stop_reason: stop, content: [{ type: 'text', text }], usage });

    const ok = await run(answer(JSON.stringify(fixture())));
    expect(ok.kind).toBe('read');
    if (ok.kind === 'read') {
      expect(ok.cost.usd).toBeCloseTo((3000 * 2 + 900 * 10) / 1_000_000, 10);
      expect(ok.receipt.lines).toHaveLength(17);
    }

    const broken = await run(answer('das ist kein JSON'));
    expect(broken).toMatchObject({ kind: 'invalid', issues: ['Antwort ist kein JSON'] });
    expect(receiptStatusLine(broken)).toContain('Antwort ungültig');

    const noStore = await run(answer(JSON.stringify({ store: null, date: null, lines: [] })));
    expect(noStore).toMatchObject({ kind: 'invalid' });

    expect((await run(answer('{}', 'max_tokens'))).kind).toBe('max-tokens');
    expect((await run(answer('{}', 'refusal'))).kind).toBe('refused');
    expect((await run(answer('{}', 'tool_use'))).kind).toBe('stopped');

    const offline = await run(() => Promise.reject(new sdk.APIConnectionError({ message: 'offline' })));
    expect(offline).toEqual({ kind: 'connection' });
    expect(receiptStatusLine(offline)).toBe('Keine Verbindung zur API');

    const timeout = await run(() => Promise.reject(new sdk.APIConnectionTimeoutError()));
    expect(timeout).toEqual({ kind: 'timeout' });

    const apiError = await run(() => Promise.reject(new sdk.APIError(401, { type: 'authentication_error' }, 'nein', new Headers())));
    expect(apiError).toMatchObject({ kind: 'api-error', status: 401 });

    const controller = new AbortController();
    controller.abort();
    expect((await run(() => Promise.reject(new Error('x')), controller.signal)).kind).toBe('aborted');

    expect((await run(() => Promise.reject(new Error('boom')))).kind).toBe('unknown');
  });
});
