/** Eine Zeile der Sheets API: formatierte Zeichenketten, nachlaufend beschnitten. */
export type SheetRow = readonly string[];
export type SheetValues = readonly SheetRow[];

/** Ein Tag aus dem Daily Tracking Tab. */
export interface DailyEntry {
  /** Rohdatum, wie im Sheet dargestellt, etwa `7.5.2026`. */
  date: string;
  dateObj: Date | null;
  weight: number | null;
  time: string;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  fiber: number | null;
  fv: number | null;
  calories: number | null;
  comment: string;
  sleep: number | null;
  sleepQ: number | null;
  digestion: number | null;
  stress: number | null;
  energy: number | null;
  steps: number | null;
  training: string;
}

/** Ein Wochenblock, abgeschlossen durch die Zeile `Durchschnitt`. */
export interface WeekBlock {
  rows: DailyEntry[];
  /** Wochenmittel laut Sheet, nicht nachgerechnet. */
  avgWeight: number | null;
  /** Delta laut Sheet. Im ersten Block steht dort kein Delta. */
  delta: number | null;
}

export interface ParsedDaily {
  daily: DailyEntry[];
  weekBlocks: WeekBlock[];
}

/** Eine Uebungswoche innerhalb eines Mesozyklus. */
export interface ExerciseWeek {
  /** Gesamtlast in kg. `55x2` ergibt 110. */
  load: number | null;
  sets: number;
  repsActual: string;
  /** Unveraenderter Zellinhalt der Lastspalte. */
  loadRaw: string;
  /** Der Wert musste geraten werden, etwa bei einer Bereichsangabe. */
  uncertain: boolean;
  /** Weicht so stark vom Median der Uebung ab, dass ein Tippfehler naheliegt. */
  implausible: boolean;
}

export interface Exercise {
  /** Eindeutiger Schluessel aus Trainingstag und Name. */
  key: string;
  /** Anzeigename, wie im Sheet. */
  name: string;
  day: string;
  muscleGroup: string;
  weeks: ExerciseWeek[];
}

export interface ParsedTraining {
  /** Schluessel ist `day||name`, nicht der Name allein. */
  exercises: Record<string, Exercise>;
  weekCount: number;
  /** Hoechste Woche mit einer eingetragenen Last. */
  currentWeek: number;
  /** Zellen, die nicht gelesen werden konnten, fuer einen Hinweis in der Oberflaeche. */
  unparsableLoads: string[];
}
