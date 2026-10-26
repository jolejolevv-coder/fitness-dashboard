/**
 * Konfiguration der Kochansicht. Dauer und Temperatur je Schritt stehen in
 * `data/recipes.json`, hier nur Einheiten und der Speicherschluessel.
 */

/** localStorage Schluessel fuer Haken, aktuellen Schritt und Timer, je Geraet. */
export const COOK_STATE_KEY = 'fitness_cook_v1';

export const MS_PER_SECOND = 1000;
export const SECONDS_PER_MINUTE = 60;
export const MS_PER_MINUTE = MS_PER_SECOND * SECONDS_PER_MINUTE;

/** Position 0 ist die Mise en place, Schritt N liegt auf Position N. */
export const MISE_EN_PLACE_POSITION = 0;

/** Takt der Timerleiste. Die Restzeit kommt aus dem Endzeitpunkt, der Takt bestimmt nur die Anzeige. */
export const TIMER_TICK_MS = 250;

/** Signalton ueber Web Audio, ohne Audiodatei. */
export const TONE_MS = 300;
export const TONE_GAP_MS = 150;
export const TONE_FREQUENCY_HZ = 880;
export const TONE_GAIN = 0.3;
/** Zahl der Toene: Zwischenhalt kurz, Ende laenger. */
export const HOLD_TONE_COUNT = 2;
export const END_TONE_COUNT = 4;

/** Vibrationsmuster in Millisekunden, abwechselnd Vibration und Pause. */
export const HOLD_VIBRATION_PATTERN: readonly number[] = [200, 100, 200];
export const END_VIBRATION_PATTERN: readonly number[] = [400, 150, 400, 150, 400];

/** Mindestgroesse der Bedienelemente in der Kochansicht, fuer nasse Finger. */
export const MIN_CONTROL_PX = 56;
