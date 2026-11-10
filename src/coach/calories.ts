import type { DailyEntry } from '../types';
import { COACH_RULES as R } from '../config/coachRules';
import { KCAL_PER_KG_BODYMASS, tdeeRange } from '../analytics/tdee';
import { PLATEAU_COMPLIANCE_PCT, PLATEAU_THRESHOLD_KG_PER_WEEK, weightTrend } from '../analytics/trend';
import { refuse, type Insight } from '../analytics/result';
import { targetRateKgPerWeek, type Goals } from '../parse/goals';
import { mean, show, windowOf } from './window';

/** Regeln A1 bis A3, siehe `docs/coach-regeln.md`. Reine Funktionen. */

export interface KcalOpinion {
  /** Zweitmeinung in kcal pro Tag. */
  kcal: number;
  tdeeMid: number;
  /** Tagesdifferenz zur Erhaltung aus der Sollrate, negativ im Defizit. */
  dailyDeltaKcal: number;
  trainerKcal: number | null;
  /** Zweitmeinung minus Vorgabe. */
  diffKcal: number | null;
  weightKg: number;
  basisDays: number;
}

/** A1: Erhaltungsbedarf plus Tagesdifferenz aus der Sollrate des Sheets. */
export function kcalOpinion(daily: readonly DailyEntry[], goals: Goals): Insight<KcalOpinion> {
  const tdee = tdeeRange(daily);
  if (!tdee.ok) return tdee;
  const trend = weightTrend(daily);
  if (!trend.ok) return trend;
  const rate = targetRateKgPerWeek(goals.rateOfLossPct, trend.currentSmoothed);
  if (rate === null) return refuse('Sollrate fehlt im Sheet');

  const tdeeMid = (tdee.low + tdee.high) / 2;
  const dailyDeltaKcal = (rate * KCAL_PER_KG_BODYMASS) / R.DAYS_PER_WEEK;
  const kcal = tdeeMid + dailyDeltaKcal;
  const trainerKcal = goals.average.caloriesKcal;
  return {
    ok: true,
    kcal,
    tdeeMid,
    dailyDeltaKcal,
    trainerKcal,
    diffKcal: trainerKcal === null ? null : kcal - trainerKcal,
    weightKg: trend.currentSmoothed,
    basisDays: Math.max(...tdee.estimates.map((e) => e.windowDays)),
  };
}

export type StallStatus = 'kein-handlungsbedarf' | 'plateau' | 'ausfuehrung';

export interface Stall {
  status: StallStatus;
  /** Wochen in Folge ohne Bewegung, von heute rueckwaerts. */
  stalledWeeks: number;
  /** Wochenmittel, aelteste Woche zuerst. */
  weeklyMeans: number[];
  /** Anteil der Tage mit getroffener Kalorienvorgabe, null ohne Vorgabe oder Daten. */
  compliancePct: number | null;
  basisDays: number;
}

const hasWeight = (entry: DailyEntry): boolean => entry.weight !== null;

function calorieCompliance(days: readonly DailyEntry[], targetKcal: number | null): number | null {
  if (targetKcal === null) return null;
  const limit = targetKcal * (1 + R.KCAL_TOLERANCE_PCT / 100);
  const recorded = days.filter((e) => e.calories !== null);
  if (!recorded.length) return null;
  return (recorded.filter((e) => e.calories! <= limit).length / recorded.length) * 100;
}

/**
 * A2: Stillstand zaehlt erst nach `STALL_WEEKS` Wochen. Vorher besteht kein
 * Handlungsbedarf, danach entscheidet die Compliance zwischen Plateau und
 * Ausfuehrung.
 */
export function stall(daily: readonly DailyEntry[], goals: Goals): Insight<Stall> {
  const weekCount = R.STALL_WEEKS + 1;
  const weeklyMeans: number[] = [];
  for (let week = weekCount - 1; week >= 0; week--) {
    const weights = windowOf(daily, R.DAYS_PER_WEEK, week * R.DAYS_PER_WEEK, hasWeight)
      .filter(hasWeight)
      .map((e) => e.weight!);
    if (weights.length < R.STALL_MIN_WEIGH_INS_PER_WEEK) {
      return refuse(`Woche ${weekCount - week} von ${weekCount}: ${weights.length} von ${R.STALL_MIN_WEIGH_INS_PER_WEEK} Wägungen`);
    }
    weeklyMeans.push(mean(weights));
  }

  let stalledWeeks = 0;
  for (let i = weeklyMeans.length - 1; i > 0; i--) {
    if (Math.abs(weeklyMeans[i]! - weeklyMeans[i - 1]!) >= PLATEAU_THRESHOLD_KG_PER_WEEK) break;
    stalledWeeks++;
  }

  const basisDays = weekCount * R.DAYS_PER_WEEK;
  const compliancePct = calorieCompliance(windowOf(daily, basisDays, 0, hasWeight), goals.average.caloriesKcal);
  let status: StallStatus = 'kein-handlungsbedarf';
  if (stalledWeeks >= R.STALL_WEEKS) {
    status = compliancePct !== null && compliancePct < PLATEAU_COMPLIANCE_PCT ? 'ausfuehrung' : 'plateau';
  }
  return { ok: true, status, stalledWeeks, weeklyMeans, compliancePct, basisDays };
}

export interface NextStep {
  /** Vorgabe plus Schritt. */
  kcal: number;
  /** Aenderung gegen die Vorgabe, gekappt auf `KCAL_STEP`. */
  stepKcal: number;
  trainerKcal: number;
}

/** A3: hoechstens ein Schritt je Anpassung, bei schwacher Ausfuehrung keiner. */
export function nextStep(opinion: Insight<KcalOpinion>, stalled: Insight<Stall>): Insight<NextStep> {
  if (!opinion.ok) return opinion;
  if (opinion.trainerKcal === null) return refuse('Vorgabe fehlt im Sheet');
  if (stalled.ok && stalled.status === 'ausfuehrung') {
    return refuse(`Compliance ${show(stalled.compliancePct ?? 0, 0)} unter ${PLATEAU_COMPLIANCE_PCT} Prozent`);
  }
  const wanted = opinion.kcal - opinion.trainerKcal;
  const stepKcal = Math.max(-R.KCAL_STEP, Math.min(R.KCAL_STEP, wanted));
  return { ok: true, kcal: opinion.trainerKcal + stepKcal, stepKcal, trainerKcal: opinion.trainerKcal };
}
