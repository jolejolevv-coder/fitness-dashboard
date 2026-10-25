import type { Weekday } from '../nutrition/types';

/**
 * Konfiguration des Plan Generators: Modell, Toleranzen, Prep Tage, Preise.
 * Nichts davon steht im Rechenkern, der bekommt die Werte uebergeben.
 */

export const GENERATOR_MODEL = 'claude-opus-5-5';
export const GENERATOR_EFFORT = 'high';

/** Toleranz je Tag. Protein hat kein Band, es gilt mindestens das Ziel. */
export interface DayTolerance {
  kcalBand: number;
  fatBandG: number;
}

export const DAY_TOLERANCE: DayTolerance = { kcalBand: 40, fatBandG: 10 };

/** Praefix neuer Gericht IDs, damit sie nie mit Seed IDs kollidieren. */
export const GENERATED_MEAL_PREFIX = 'g';

export const PREP_DAYS: readonly Weekday[] = ['So', 'Mi'];

/** Preise in USD je Million Token. */
export interface TokenPrices {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
}

/** Stand der Preise unten. */
export const PRICES_AS_OF = '2026-10-06';

export const TOKEN_PRICES: Readonly<Record<string, TokenPrices>> = {
  'claude-opus-5-5': { input: 4, output: 20, cacheRead: 0.2, cacheWrite: 5 },
  'claude-sonnet-5-5': { input: 2, output: 10, cacheRead: 0.2, cacheWrite: 2.5 },
  // Ziele des serverseitigen Fallbacks, damit auch ein umgeleiteter Lauf einen Betrag hat.
  'claude-opus-5': { input: 5, output: 25, cacheRead: 0.5, cacheWrite: 6.25 },
  'claude-opus-4-8': { input: 5, output: 25, cacheRead: 0.5, cacheWrite: 6.25 },
};

/** Beta Kopfzeile fuer `fallbacks: "default"`, serverseitiger Fallback bei Ablehnung. */
export const GENERATOR_FALLBACK_BETA = 'server-side-fallback-2026-07-01';

/** Obergrenze der Ausgabe je Lauf, Thinking eingeschlossen. */
export const GENERATOR_MAX_TOKENS = 64_000;

/** Gesamtfrist eines Laufs ueber alle Wiederholungen des SDK. */
export const GENERATOR_TIMEOUT_MS = 10 * 60 * 1000;
