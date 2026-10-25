import { describe, expect, it } from 'vitest';
import type { Offer, PricesFile, RegularPrice } from '../scripts/prices/types.ts';
import {
  EDEKA_NOTE,
  REGULAR_PRICE_STALE_DAYS,
  bestRegularPrice,
  cheapestOffer,
  choosePrice,
  isOfferCurrent,
  isRegularStale,
  offerNotes,
  offerPacks,
  offerSaving,
  parsePricesFile,
  parseRegularPricesFile,
  regularAgeDays,
  summarizeSavings,
} from '../src/nutrition/prices';
import { berlinDay, berlinWeekday, daysBetween, shortDate } from '../src/nutrition/dates';
import { sheetDayGoals } from '../src/nutrition/goals';
import { NO_OVERRIDES } from '../src/nutrition/rotation';
import { compareToGoals } from '../src/nutrition/totals';
import {
  parseChecked,
  parseOverrides,
  serializeChecked,
  serializeOverrides,
  toggled,
  withBar,
  withSwap,
} from '../src/nutrition/state';
import type { Goals } from '../src/parse/goals';

const TODAY = '2026-10-27';

function offer(overrides: Partial<Offer> = {}): Offer {
  return {
    food_id: 'chicken_breast',
    store: 'Lidl',
    product: 'Hähnchenbrustfilet 600g',
    size_g: 600,
    price_eur: 5.99,
    regular_price_eur: 7.49,
    price_per_kg: 9.98,
    valid_days: 'Mo bis Sa',
    valid_from: '2026-10-26T00:00:00+01:00',
    valid_to: '2026-10-31T23:59:59+01:00',
    condition: null,
    ...overrides,
  };
}

function regular(overrides: Partial<RegularPrice> = {}): RegularPrice {
  return {
    food_id: 'chicken_breast',
    store: 'Lidl',
    regular_price_eur: 7.49,
    size_g: 600,
    price_per_kg: 12.48,
    seen_at: '2026-10-12',
    source: 'manual',
    ...overrides,
  };
}

describe('cheapestOffer', () => {
  it('nimmt den kleinsten Grundpreis, nicht den kleinsten Packungspreis', () => {
    const small = offer({ store: 'Aldi Süd', size_g: 300, price_eur: 3.2, price_per_kg: 10.67 });
    const big = offer({ store: 'Lidl', size_g: 1000, price_eur: 9.5, price_per_kg: 9.5 });
    expect(cheapestOffer([small, big], 'chicken_breast', TODAY)).toBe(big);
  });

  it('stellt ein Angebot mit Grundpreis vor eines ohne', () => {
    const noKg = offer({ price_eur: 1, price_per_kg: null, size_g: null });
    const withKg = offer({ price_eur: 6, price_per_kg: 10 });
    expect(cheapestOffer([noKg, withKg], 'chicken_breast', TODAY)).toBe(withKg);
  });

  it('entscheidet ohne Grundpreise ueber den Packungspreis', () => {
    const a = offer({ price_eur: 3, price_per_kg: null });
    const b = offer({ price_eur: 2, price_per_kg: null });
    expect(cheapestOffer([a, b], 'chicken_breast', TODAY)).toBe(b);
  });

  it('zaehlt Angebote mit Bedingung mit', () => {
    const app = offer({ condition: 'Mit der App', price_per_kg: 8 });
    expect(cheapestOffer([offer(), app], 'chicken_breast', TODAY)).toBe(app);
  });

  it('ignoriert abgelaufene Angebote und fremde Artikel', () => {
    const old = offer({ valid_to: '2026-10-26T23:59:59+01:00' });
    expect(cheapestOffer([old], 'chicken_breast', TODAY)).toBeNull();
    expect(cheapestOffer([offer()], 'skyr', TODAY)).toBeNull();
  });

  it('zaehlt den letzten Gueltigkeitstag und kommende Angebote mit', () => {
    expect(isOfferCurrent(offer(), '2026-10-31')).toBe(true);
    expect(isOfferCurrent(offer(), '2026-11-01')).toBe(false);
    expect(isOfferCurrent(offer(), '2026-10-25')).toBe(true);
  });
});

describe('Vermerke', () => {
  it('traegt die Bedingung der Karte', () => {
    expect(offerNotes(offer({ condition: 'Mit der App' }))).toEqual(['Mit der App']);
  });

  it('vermerkt Edeka als regional', () => {
    expect(offerNotes(offer({ store: 'Edeka' }))).toEqual([EDEKA_NOTE]);
    expect(offerNotes(offer({ store: 'Edeka', condition: 'Mit Kundenkarte' }))).toEqual(['Mit Kundenkarte', EDEKA_NOTE]);
  });

  it('hat sonst keinen Vermerk', () => {
    expect(offerNotes(offer({ condition: '  ' }))).toEqual([]);
  });
});

describe('Ersparnis', () => {
  it('rechnet gegen den Normalpreis des Angebots, je gekaufter Packung', () => {
    // 1035 g Bedarf bei 600 g Packungen: zwei Packungen, je 1,50 Euro gespart.
    expect(offerPacks(offer(), 1035)).toBe(2);
    expect(offerSaving(offer(), 1035)).toBeCloseTo(3, 10);
  });

  it('kauft bei kleinem Fehlbetrag keine zusaetzliche Packung', () => {
    expect(offerPacks(offer({ size_g: 213 }), 639)).toBe(3);
  });

  it('schaetzt nichts ohne Normalpreis oder Packungsgroesse', () => {
    expect(offerSaving(offer({ regular_price_eur: null }), 600)).toBeNull();
    expect(offerSaving(offer({ size_g: null }), 600)).toBeNull();
    expect(offerPacks(offer({ size_g: null }), 600)).toBeNull();
  });

  it('wird nie negativ', () => {
    expect(offerSaving(offer({ price_eur: 8, regular_price_eur: 7.49 }), 600)).toBe(0);
  });

  it('summiert nur Angebote mit Normalpreis und nennt die Basis', () => {
    const prices: PricesFile = {
      fetched_at: '2026-10-25T18:00:00+01:00',
      valid_from: '',
      valid_to: '',
      offers: [offer(), offer({ food_id: 'skyr', regular_price_eur: null, price_eur: 1, size_g: 500, price_per_kg: 2 })],
    };
    const choices = [
      choosePrice('chicken_breast', 600, prices, null, TODAY),
      choosePrice('skyr', 500, prices, null, TODAY),
      choosePrice('oats', 240, prices, null, TODAY),
    ];
    const summary = summarizeSavings(choices);
    expect(summary.withOffer).toBe(2);
    expect(summary.counted).toBe(1);
    expect(summary.eur).toBeCloseTo(1.5, 10);
  });

  it('summiert nie aus Dauerpreisen', () => {
    const choices = [choosePrice('chicken_breast', 600, null, { entries: [regular()] }, TODAY)];
    expect(summarizeSavings(choices)).toEqual({ eur: 0, counted: 0, withOffer: 0 });
  });
});

describe('Dauerpreis', () => {
  it('rechnet das Alter in Tagen', () => {
    expect(regularAgeDays(regular({ seen_at: '2026-10-12' }), TODAY)).toBe(15);
    expect(regularAgeDays(regular({ seen_at: TODAY }), TODAY)).toBe(0);
  });

  it('vermerkt erst nach der Schwelle', () => {
    const edge = regular({ seen_at: '2026-07-29' });
    expect(regularAgeDays(edge, TODAY)).toBe(REGULAR_PRICE_STALE_DAYS);
    expect(isRegularStale(edge, TODAY)).toBe(false);
    expect(isRegularStale(regular({ seen_at: '2026-07-28' }), TODAY)).toBe(true);
  });

  it('nimmt den guenstigsten Eintrag eines Artikels', () => {
    const cheap = regular({ store: 'Aldi Süd', price_per_kg: 11 });
    expect(bestRegularPrice([regular(), cheap], 'chicken_breast')).toBe(cheap);
    expect(bestRegularPrice([regular()], 'skyr')).toBeNull();
  });
});

describe('choosePrice', () => {
  const prices: PricesFile = { fetched_at: '2026-10-25T18:00:00+01:00', valid_from: '', valid_to: '', offers: [offer()] };
  const entries = { entries: [regular(), regular({ food_id: 'skyr', seen_at: '2026-01-01' })] };

  it('zieht ein Angebot dem Dauerpreis vor', () => {
    expect(choosePrice('chicken_breast', 600, prices, entries, TODAY).kind).toBe('offer');
  });

  it('faellt ohne Angebot auf den Dauerpreis zurueck, alte mit Vermerk', () => {
    const choice = choosePrice('skyr', 500, prices, entries, TODAY);
    expect(choice).toMatchObject({ kind: 'regular', stale: true });
  });

  it('zeigt nichts, wenn beide Dateien fehlen', () => {
    expect(choosePrice('chicken_breast', 600, null, null, TODAY)).toEqual({ kind: 'none' });
  });
});

describe('Preisdateien lesen', () => {
  it('liefert null bei Muell statt zu werfen', () => {
    for (const bad of [null, 'x', 42, [], {}, { offers: 'nein' }, { fetched_at: 'x' }]) {
      expect(parsePricesFile(bad)).toBeNull();
    }
    for (const bad of [null, '<html>', [], {}, { entries: 3 }]) {
      expect(parseRegularPricesFile(bad)).toBeNull();
    }
  });

  it('verwirft einzelne kaputte Eintraege und behaelt den Rest', () => {
    const file = parsePricesFile({
      fetched_at: '2026-10-25T18:00:00+01:00',
      valid_from: '2026-10-26T00:00:00+01:00',
      valid_to: '2026-10-31T23:59:59+01:00',
      offers: [offer(), { food_id: 'x' }, offer({ valid_to: 'bald' })],
    });
    expect(file?.offers).toHaveLength(1);
    expect(parseRegularPricesFile({ entries: [regular(), { food_id: 'x' }] })?.entries).toHaveLength(1);
  });

  it('akzeptiert die leere Startdatei', () => {
    expect(parseRegularPricesFile({ entries: [] })).toEqual({ entries: [] });
  });
});

describe('Datum in Berlin', () => {
  it('nimmt den Berliner Kalendertag, nicht UTC', () => {
    // 22:30 UTC am Samstag ist in Berlin (Sommerzeit) schon Sonntag.
    const night = new Date('2026-08-01T22:30:00Z');
    expect(berlinDay(night)).toBe('2026-08-02');
    expect(berlinWeekday(night)).toBe('So');
    expect(berlinWeekday(new Date('2026-10-26T12:00:00Z'))).toBe('Mo');
  });

  it('rechnet Tage ueber die Zeitumstellung hinweg ganz', () => {
    expect(daysBetween('2026-10-24', '2026-10-27')).toBe(3);
    expect(daysBetween('2026-10-27', '2026-10-24')).toBe(-3);
    expect(shortDate('2026-10-31T23:59:59+01:00')).toBe('31.10.');
  });
});

describe('Ziele fuer den Plan', () => {
  const average = {
    proteinG: 200, carbsG: 225, fatG: 60, fiberG: 40, caloriesKcal: 2300.5, proteinFeedings: 4, steps: 10000,
  };
  const base: Goals = {
    average, highDay: null, lowDay: null, rateOfLossPct: null, startWeightKg: null, heightCm: null, missing: [],
  };

  it('gibt ohne Sheet kein Ziel zurueck', () => {
    expect(sheetDayGoals(null)).toBeNull();
  });

  it('nimmt gelesene Werte unveraendert', () => {
    expect(sheetDayGoals(base)).toEqual(average);
  });

  it('laesst Rueckfallwerte nicht als Ziel durch', () => {
    expect(sheetDayGoals({ ...base, missing: ['Vorgabeblock'] })).toBeNull();
    expect(sheetDayGoals({ ...base, missing: ['Zeile Average'] })).toBeNull();
    expect(sheetDayGoals({ ...base, missing: ['fiberG'] })?.fiberG).toBeNull();
    expect(sheetDayGoals({ ...base, missing: ['fiberG'] })?.proteinG).toBe(200);
  });

  it('vergleicht auch die Kohlenhydrate', () => {
    const totals = { kcal: 2320, protein: 205, carbs: 230, fat: 55, fiber: 38 };
    expect(compareToGoals(totals, average).carbsG).toEqual({ actual: 230, goal: 225, diff: 5 });
  });
});

describe('Lokaler Zustand', () => {
  it('liest kaputten Speicher als leer', () => {
    expect(parseOverrides(null)).toEqual(NO_OVERRIDES);
    expect(parseOverrides('{kaputt')).toEqual(NO_OVERRIDES);
    expect(parseOverrides('[1,2]')).toEqual(NO_OVERRIDES);
    expect(parseChecked('{kaputt')).toEqual(new Set());
    expect(parseChecked('{"a":1}')).toEqual(new Set());
  });

  it('uebernimmt nur bekannte Tage und Slots', () => {
    const parsed = parseOverrides('{"swaps":{"Mo":{"M1":"m1b","M9":"x"},"Xx":{"M1":"m1b"}},"bar":{"Di":true,"Mi":false,"Zz":true}}');
    expect(parsed).toEqual({ swaps: { Mo: { M1: 'm1b' } }, bar: { Di: true } });
  });

  it('haelt Tausch und Riegel bei Speichern und Laden stabil', () => {
    let o = withSwap(NO_OVERRIDES, 'Mo', 'M2', 'm2b');
    o = withBar(o, 'Di', true);
    expect(parseOverrides(serializeOverrides(o))).toEqual(o);
  });

  it('loescht einen Tausch samt leerem Tag', () => {
    const o = withSwap(withSwap(NO_OVERRIDES, 'Mo', 'M2', 'm2b'), 'Mo', 'M2', null);
    expect(o.swaps).toEqual({});
    expect(withBar(withBar(NO_OVERRIDES, 'Mo', true), 'Mo', false).bar).toEqual({});
  });

  it('schaltet Haken um, ohne die Eingabe zu veraendern', () => {
    const start = new Set(['a']);
    expect(toggled(start, 'b')).toEqual(new Set(['a', 'b']));
    expect(toggled(start, 'a')).toEqual(new Set());
    expect(start).toEqual(new Set(['a']));
    expect(parseChecked(serializeChecked(new Set(['b', 'a'])))).toEqual(new Set(['a', 'b']));
  });
});
