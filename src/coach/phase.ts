import { COACH_RULES as R } from '../config/coachRules';
import { refuse, type Insight } from '../analytics/result';
import type { BodyEntry } from '../parse/body';
import type { KcalOpinion } from './calories';
import { show } from './window';

/** Regeln A4 bis A6, siehe `docs/coach-regeln.md`. Reine Funktionen. */

export interface Ffmi {
  ffmi: number;
  leanKg: number;
  bodyfatPct: number;
  measuredOn: Date;
  /** Alter der Messung in Tagen. */
  ageDays: number;
}

/** A4: normalisierter FFMI. Verweigert ohne oder mit veralteter Messung. */
export function ffmi(
  weightKg: number | null,
  heightCm: number | null,
  body: BodyEntry | null,
  now: Date,
): Insight<Ffmi> {
  if (!body || body.bodyfatPct === null) return refuse('Körperfett: 0 Messungen im Tab Body');
  const ageDays = Math.floor((now.getTime() - body.date.getTime()) / R.MS_PER_DAY);
  if (ageDays > R.BODY_MAX_AGE_DAYS) return refuse(`Messung ${ageDays} Tage alt, höchstens ${R.BODY_MAX_AGE_DAYS}`);
  if (weightKg === null) return refuse('Gewicht fehlt');
  if (heightCm === null || heightCm <= 0) return refuse('Größe fehlt im Sheet');

  const heightM = heightCm / 100;
  const leanKg = weightKg * (1 - body.bodyfatPct / 100);
  const value = leanKg / (heightM * heightM) + R.FFMI_HEIGHT_CORRECTION * (R.FFMI_REFERENCE_HEIGHT_M - heightM);
  return { ok: true, ffmi: value, leanKg, bodyfatPct: body.bodyfatPct, measuredOn: body.date, ageDays };
}

export type Phase = 'cut' | 'mini-cut' | 'recomp' | 'lean-bulk' | 'halten';
export type MuscleBand = 'gering' | 'mittel' | 'entwickelt';

export interface PhaseOpinion {
  phase: Phase;
  band: MuscleBand;
  bodyfatPct: number;
  ffmi: number;
  ageDays: number;
}

function bandOf(value: number): MuscleBand {
  if (value < R.FFMI_LOW_BELOW) return 'gering';
  return value >= R.FFMI_DEVELOPED_FROM ? 'entwickelt' : 'mittel';
}

function phaseFor(bodyfatPct: number, band: MuscleBand): Phase {
  if (bodyfatPct > R.BF_HIGH_ABOVE_PCT) return 'cut';
  if (bodyfatPct < R.BF_LEAN_BELOW_PCT) return 'lean-bulk';
  if (bodyfatPct > R.BF_MID_FROM_PCT) return band === 'gering' ? 'mini-cut' : 'cut';
  if (band === 'gering') return 'recomp';
  if (band === 'mittel') return 'mini-cut';
  return bodyfatPct <= R.BF_DEVELOPED_HOLD_MAX_PCT ? 'halten' : 'cut';
}

/** A5: Phase aus Koerperfett und Muskelmasse. */
export function phaseOpinion(measured: Insight<Ffmi>): Insight<PhaseOpinion> {
  if (!measured.ok) return measured;
  const band = bandOf(measured.ffmi);
  return {
    ok: true,
    phase: phaseFor(measured.bodyfatPct, band),
    band,
    bodyfatPct: measured.bodyfatPct,
    ffmi: measured.ffmi,
    ageDays: measured.ageDays,
  };
}

export interface Reverse {
  /** Kalorien je Woche, erste Woche zuerst. */
  steps: number[];
  cutKcal: number;
  endKcal: number;
}

export interface ReverseInput {
  opinion: Insight<KcalOpinion>;
  bodyfatPct: number | null;
  targetWeightKg: number | null;
}

/**
 * A6: Stufenfolge nach dem Cut. Aktiv, sobald das Zielgewicht oder das
 * Koerperfettziel erreicht ist, sonst verweigert mit dem Abstand zum Ziel.
 */
export function reverse(input: ReverseInput): Insight<Reverse> {
  const { opinion, bodyfatPct, targetWeightKg } = input;
  if (!opinion.ok) return opinion;

  const leanEnough = bodyfatPct !== null && bodyfatPct <= R.CUT_TARGET_BF_PCT;
  const atTarget = targetWeightKg !== null && opinion.weightKg <= targetWeightKg;
  if (!leanEnough && !atTarget) {
    if (targetWeightKg !== null) return refuse(`Gewicht ${show(opinion.weightKg)} über Ziel ${show(targetWeightKg)}`);
    if (bodyfatPct !== null) return refuse(`Körperfett ${show(bodyfatPct)} über ${R.CUT_TARGET_BF_PCT}`);
    return refuse('Zielgewicht und Körperfett fehlen');
  }

  const cutKcal = opinion.trainerKcal ?? opinion.kcal;
  const deficit = opinion.tdeeMid - cutKcal;
  if (deficit <= 0) return refuse(`Vorgabe ${show(cutKcal, 0)} ohne Defizit zu ${show(opinion.tdeeMid, 0)}`);

  const endKcal = opinion.tdeeMid + R.REVERSE_END_SURPLUS_KCAL;
  const steps: number[] = [];
  let kcal = cutKcal + deficit * R.REVERSE_FIRST_STEP_SHARE;
  while (kcal < endKcal && steps.length < R.REVERSE_MAX_WEEKS - 1) {
    steps.push(kcal);
    kcal += R.REVERSE_WEEKLY_STEP_KCAL;
  }
  steps.push(endKcal);
  return { ok: true, steps, cutKcal, endKcal };
}
