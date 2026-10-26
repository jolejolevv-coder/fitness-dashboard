/**
 * Datenmodell des Ernaehrungsplans.
 *
 * Die Plandaten liegen als JSON unter `data/` und werden gebuendelt. Dieses
 * Modul beschreibt nur ihre Form, es rechnet nichts.
 */

export const WEEKDAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'] as const;
export type Weekday = (typeof WEEKDAYS)[number];

export const SLOTS = ['M1', 'M2', 'M3', 'M4'] as const;
export type Slot = (typeof SLOTS)[number];

/** Naehrwerte, bei Lebensmitteln je 100 g roh, bei Summen absolut. */
export interface Macros {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
}

/**
 * `food` und `sauce` haben Naehrwerte und gehen in die Makros ein. `spice` hat
 * keine und wird nie mitgerechnet.
 */
export type FoodKind = 'food' | 'sauce' | 'spice';

export interface Food extends Partial<Macros> {
  id: string;
  name: string;
  kind: FoodKind;
}

export interface Ingredient {
  foodId: string;
  /** Gramm, bei Soßen Millilitern gleichgesetzt. Gewuerze tragen 0. */
  grams: number;
}

/** Zuschlag, den ein Gericht auf ein anderes Gericht desselben Tages legt. */
export interface AddToSlot extends Ingredient {
  slot: Slot;
}

export interface Meal {
  id: string;
  slot: Slot;
  name: string;
  ingredients: Ingredient[];
  addToSlot?: AddToSlot;
}

export type Rotation = Record<Weekday, Record<Slot, string>>;

export type ShoppingCategory = 'meat_fish' | 'chilled' | 'produce' | 'frozen' | 'dry' | 'spices_sauces';

export interface MatchTerms {
  /** Ein Treffer genuegt. */
  include: string[];
  /** Ein Treffer schliesst aus, auch wenn `include` passt. */
  exclude: string[];
}

export interface ShoppingItem {
  foodId: string;
  category: ShoppingCategory;
  unit: 'g' | 'piece';
  gramsPerPiece?: number;
  /** Packungsgroessen in g, leer wenn lose gekauft wird. */
  packSizesG: number[];
  /** Vorrat, wird nur erinnert. */
  pantry: boolean;
  /** Lagerware, steht nie auf der Einkaufsliste. */
  stock: boolean;
  match: MatchTerms;
}

export const PREP_DEVICES = ['Mikrowelle', 'Airfryer', 'OptiGrill'] as const;
export type PrepDevice = (typeof PREP_DEVICES)[number];
/** Geraete mit Temperaturregler. Die Mikrowelle hat keinen. */
export const TEMPERATURE_DEVICES: readonly PrepDevice[] = ['Airfryer', 'OptiGrill'];

/**
 * Welche Gerichte ein Schritt abdeckt. `foods` schraenkt auf einzelne Zutaten
 * ein, ohne die Angabe zaehlen alle Zutaten des Gerichts.
 */
export interface PrepCover {
  slot: Slot;
  days: Weekday[];
  meals: string[];
  foods?: string[];
}

export interface PrepStep {
  /** Stabil, `recipes.json` verweist darauf. Im Seed Pflicht, generierte Plaene haben keine. */
  id?: string;
  title: string;
  device: PrepDevice;
  covers: PrepCover[];
}

export interface PrepSession {
  id: string;
  title: string;
  steps: PrepStep[];
}

/** Halt waehrend eines Schritts, etwa Wenden nach N Minuten. */
export interface RecipeHold {
  afterMinutes: number;
  action: string;
}

/**
 * Kochanweisung zu einem Prep Schritt aus `data/recipes.json`. Mengen stehen
 * nie hier, sie kommen aus `buildPrep`. Temperatur nur bei Geraeten mit Regler.
 */
export interface Recipe {
  stepId: string;
  device: PrepDevice;
  instruction: string;
  temperatureC?: number;
  minutes: number;
  hold?: RecipeHold;
}
