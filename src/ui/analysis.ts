import type { DailyEntry } from '../types';
import type { Goals } from '../parse/goals';
import { targetRateKgPerWeek } from '../parse/goals';
import { complianceOf, streakOf, type Picker, type Predicate } from '../analytics/compliance';
import { correlations } from '../analytics/correlation';
import { detectPlateau, projectToTarget, weightTrend, type PlateauStatus } from '../analytics/trend';
import { tdeeRange } from '../analytics/tdee';
import { byId } from './dom';
import { card, refusalCard, valueNode } from './cards';
import { decimal, dateFormat, integer, target } from './format';

/**
 * Anzeige der abgeleiteten Kennzahlen.
 *
 * Grundsatz: Zahl und Datenbasis, sonst nichts. Keine Erklaertexte, keine
 * Empfehlungen. Wo eine Kennzahl schweigt, steht ihr Grund an der Stelle der
 * Zahl, damit ein Strich nie mit einem Defekt verwechselt wird.
 */

/** Ab diesem Vielfachen der Sollrate gilt das Tempo als auffaellig. */
const RATE_TOLERANCE = 1.5;

/** Compliance: ab diesem Anteil getroffen, darunter daneben. */
const COMPLIANCE_OK_PCT = 80;
const COMPLIANCE_OFF_PCT = 60;

/** Ab diesem Betrag gilt eine Korrelation als nennenswert. */
const NOTABLE_R = 0.2;

/** Kurzes Datum fuer das Wort der Karte, `25. Okt. 2026`. */
const wordDate = new Intl.DateTimeFormat('de-DE', { day: 'numeric', month: 'short', year: 'numeric' });

const PLATEAU_LABELS: Record<PlateauStatus, string> = {
  'kein-plateau': 'Kein Plateau',
  plateau: 'Plateau',
  ausfuehrung: 'Stillstand',
};

/** Kein Plateau ist getroffen, Plateau und Stillstand sind daneben. */
const PLATEAU_TONES: Record<PlateauStatus, string> = {
  'kein-plateau': 'is-ok',
  plateau: 'is-off',
  ausfuehrung: 'is-off',
};

interface StreakDefinition {
  label: string;
  pick: Picker;
  hit: Predicate | null;
}

function streakDefinitions(goals: Goals): StreakDefinition[] {
  const goal = goals.average;
  return [
    { label: `Protein ≥ ${target(goal.proteinG)}`, pick: (e) => e.protein, hit: goal.proteinG === null ? null : (v) => v >= goal.proteinG! },
    { label: `Kalorien ≤ ${target(goal.caloriesKcal)}`, pick: (e) => e.calories, hit: goal.caloriesKcal === null ? null : (v) => v <= goal.caloriesKcal! },
    { label: `Schritte ≥ ${target(goal.steps)}`, pick: (e) => e.steps, hit: goal.steps === null ? null : (v) => v >= goal.steps! },
    { label: `Ballaststoffe ≥ ${target(goal.fiberG)}`, pick: (e) => e.fiber, hit: goal.fiberG === null ? null : (v) => v >= goal.fiberG! },
  ];
}

export function renderAnalysis(
  daily: readonly DailyEntry[],
  goals: Goals,
  targetWeightKg: number | null,
): void {
  const trend = weightTrend(daily);
  const proteinCompliance = goals.average.proteinG === null
    ? null
    : complianceOf(daily, (e) => e.protein, (v) => v >= goals.average.proteinG!).pct;

  renderKpis(daily, goals, targetWeightKg, trend, proteinCompliance);
  renderTrendDetail(trend);
  renderStreaks(daily, goals);
  renderCorrelations(daily);
}

function renderKpis(
  daily: readonly DailyEntry[],
  goals: Goals,
  targetWeightKg: number | null,
  trend: ReturnType<typeof weightTrend>,
  proteinCompliance: number | null,
): void {
  const container = byId('a-kpis');
  if (!container) return;

  const cards: HTMLElement[] = [];

  // Erhaltungsbedarf als Spanne ueber die verfuegbaren Fenster.
  const tdee = tdeeRange(daily);
  if (tdee.ok) {
    const windows = tdee.estimates.map((e) => e.windowDays).join(', ');
    const same = Math.round(tdee.low) === Math.round(tdee.high);
    cards.push(card(
      'Erhaltungsbedarf',
      valueNode(same ? integer(tdee.low) : `${integer(tdee.low)} bis ${integer(tdee.high)}`, 'kcal/Tag', 'is-word'),
      `Basis ${windows} Tage`,
    ));
  } else {
    cards.push(refusalCard('Erhaltungsbedarf', tdee.reason));
  }

  // Rate gegen Sollrate.
  if (trend.ok) {
    const soll = targetRateKgPerWeek(goals.rateOfLossPct, trend.currentSmoothed);
    const direction = trend.ratePerWeek < 0 ? 'Abnahme' : 'Zunahme';
    const offPlan = soll !== null && Math.abs(trend.ratePerWeek) > Math.abs(soll) * RATE_TOLERANCE;
    cards.push(card(
      'Rate',
      valueNode(decimal(Math.abs(trend.ratePerWeek), 2), 'kg/Woche', offPlan ? 'is-off' : soll !== null ? 'is-ok' : ''),
      [soll !== null ? `${direction}, Soll ${decimal(Math.abs(soll), 2)}` : direction, `Basis ${integer(trend.basisDays)} Tage`],
    ));
  } else {
    cards.push(refusalCard('Rate', trend.reason));
  }

  // Plateau.
  const plateau = detectPlateau(daily, proteinCompliance);
  if (plateau.ok) {
    const basis = plateau.status === 'ausfuehrung' && proteinCompliance !== null
      ? `Compliance ${integer(proteinCompliance)} %`
      : `Basis ${integer(plateau.basisDays)} Tage`;
    cards.push(card(
      'Letzte 14 Tage',
      valueNode(PLATEAU_LABELS[plateau.status], undefined, `is-word ${PLATEAU_TONES[plateau.status]}`),
      [`${decimal(Math.abs(plateau.ratePerWeek), 2)} kg/Woche`, basis],
    ));
  } else {
    cards.push(refusalCard('Letzte 14 Tage', plateau.reason));
  }

  // Zielprojektion.
  const projection = projectToTarget(trend, targetWeightKg);
  if (projection.ok) {
    cards.push(card(
      `Ziel ${targetWeightKg} kg`,
      valueNode(wordDate.format(projection.date), undefined, 'is-word'),
      `${dateFormat.format(projection.earliest)} bis ${dateFormat.format(projection.latest)}`,
    ));
  } else {
    cards.push(refusalCard(targetWeightKg === null ? 'Zielprojektion' : `Ziel ${targetWeightKg} kg`, projection.reason));
  }

  container.replaceChildren(...cards);
}

function renderTrendDetail(trend: ReturnType<typeof weightTrend>): void {
  const container = byId('a-trend-detail');
  if (!container) return;

  container.replaceChildren(trend.ok
    ? card(
      'Bestimmtheitsmaß R²',
      valueNode(decimal(trend.r2, 2)),
      [`Geglättetes Gewicht ${decimal(trend.currentSmoothed, 1)} kg`, `Basis ${integer(trend.basisDays)} Tage`],
    )
    : refusalCard('Bestimmtheitsmaß R²', trend.reason));
}

function renderStreaks(daily: readonly DailyEntry[], goals: Goals): void {
  const container = byId('a-streaks');
  if (!container) return;

  container.replaceChildren(...streakDefinitions(goals).map((definition) => {
    if (!definition.hit) return refusalCard(definition.label, 'Kein Zielwert');

    const compliance = complianceOf(daily, definition.pick, definition.hit);
    if (compliance.pct === null) return refusalCard(definition.label, `Basis 0 von ${integer(daily.length)} Tagen`);

    const streak = streakOf(daily, definition.pick, definition.hit);
    const tone = compliance.pct >= COMPLIANCE_OK_PCT ? 'is-ok' : compliance.pct < COMPLIANCE_OFF_PCT ? 'is-off' : '';
    return card(
      definition.label,
      valueNode(`${integer(compliance.hit)} von ${integer(compliance.recorded)}`, 'Tage', tone),
      [`Laufend ${integer(streak.current)}, Bestserie ${integer(streak.best)}`, `${integer(streak.gaps)} Lücken`],
    );
  }));
}

function renderCorrelations(daily: readonly DailyEntry[]): void {
  const container = byId('correlation-pairs');
  if (!container) return;

  const result = correlations(daily);
  const cards = result.found.map((entry) => {
    const tone = Math.abs(entry.r) < NOTABLE_R ? '' : entry.r > 0 ? 'is-ok' : 'is-off';
    return card(entry.label, valueNode(decimal(entry.r, 2), 'r', tone), `Basis ${integer(entry.n)} Paare`);
  });
  for (const skipped of result.skipped) cards.push(refusalCard(skipped.label, skipped.reason));

  container.replaceChildren(...cards);
}
