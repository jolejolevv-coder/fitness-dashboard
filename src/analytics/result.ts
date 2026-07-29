/**
 * Ergebnisform aller abgeleiteten Kennzahlen.
 *
 * Grundsatz aus `specs/features/analytics.md`: jede Kennzahl kennt ihre
 * Mindestdatenlage und verweigert die Aussage darunter, statt eine Zahl zu
 * erfinden. Verweigert wird nicht mit `null`, sondern mit einem Grund, den die
 * Oberflaeche anzeigen kann. Der Grund besteht aus Zahlen, nicht aus Prosa,
 * damit ein Strich nie mit einem Defekt verwechselt wird.
 */

export interface Refused {
  ok: false;
  /** Kurz und zahlenhaltig, etwa `Basis 11 von 14 Tagen`. */
  reason: string;
}

export type Insight<T> = ({ ok: true } & T) | Refused;

export function refuse(reason: string): Refused {
  return { ok: false, reason };
}

/** `Basis 11 von 14 Tagen`, die haeufigste Verweigerung. */
export function tooFewDays(available: number, required: number): Refused {
  return refuse(`Basis ${available} von ${required} Tagen`);
}
