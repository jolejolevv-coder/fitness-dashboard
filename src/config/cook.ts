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
