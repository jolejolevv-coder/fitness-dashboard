import type { DailyEntry, ParsedTraining } from '../types';
import type { Insight } from '../analytics/result';
import { weightTrend } from '../analytics/trend';
import { COACH_RULES as R } from '../config/coachRules';
import { latestBodyfat, type BodyEntry } from '../parse/body';
import type { DayGoals, Goals } from '../parse/goals';
import type { Plan } from '../parse/plan';
import { kcalOpinion, nextStep, stall, type StallStatus } from '../coach/calories';
import { hardestPlanDay, macroPlan, trainingDaysPerWeek, type DayMacros, type DayType } from '../coach/macros';
import { ffmi, phaseOpinion, reverse, type Phase } from '../coach/phase';
import { recoverySignal, sleepDuration, sleepSpread } from '../coach/recovery';
import { deload, muscleLoads, progression } from '../coach/training';
import { MIN_CALORIE_COVERAGE, MIN_TDEE_DAYS } from '../analytics/tdee';
import { byId } from './dom';
import { el } from './build';
import { decimal, integer, signed, target } from './format';

/**
 * Bereich `Zweitmeinung` (Phase 21, ADR 0011).
 *
 * Je Zeile: Bezeichner, eigene Zahl, Vorgabe und Datenbasis, dazu die Kennung
 * der Regel. Die Herleitung steht in `docs/coach-regeln.md`, hier steht kein
 * Erklaertext. `buildOpinion` ist frei von DOM Zugriff und wird getestet.
 */

export type RowTone = 'warn' | 'ok' | 'neutral';

export interface OpinionRow {
  /** Kennung im Regelkatalog, etwa `A1`. */
  rule: string;
  label: string;
  /** Zahl oder Zustand. Bei einer Verweigerung der Grund. */
  value: string;
  basis: string;
  tone: RowTone;
  refused: boolean;
  /** Bei einer Verweigerung: welche Daten die Regel braucht. Sonst leer. */
  need: string;
}

export interface OpinionGroup {
  title: string;
  rows: OpinionRow[];
}

export interface OpinionInput {
  daily: readonly DailyEntry[];
  goals: Goals;
  training: ParsedTraining | null;
  plan: Plan | null;
  body: readonly BodyEntry[];
  /** Grund, warum der Tab `Body` nicht lesbar ist. */
  bodyError: string | null;
  targetWeightKg: number | null;
  now: Date;
}

/** Hoechstzahl einzeln genannter Muskelgruppen und Uebungen je Regel. */
const MAX_LISTED = 5;
const SEP = ' · ';

const STALL_WORD: Record<StallStatus, string> = {
  'kein-handlungsbedarf': 'Kein Handlungsbedarf',
  plateau: 'Plateau',
  ausfuehrung: 'Ausführung',
};
const PHASE_WORD: Record<Phase, string> = {
  cut: 'Cut',
  'mini-cut': 'Mini Cut',
  recomp: 'Recomp',
  'lean-bulk': 'Lean Bulk',
  halten: 'Halten',
};
const DAY_WORD: Record<DayType, string> = { low: 'Low Day', medium: 'Medium Day', high: 'High Day' };

/** Ueberschrift einer Zeile ohne Ergebnis. */
export const NO_NUMBER = 'Noch keine Zahl';

const KCAL_NEED = `Eine Zeile für jeden der letzten ${MIN_TDEE_DAYS} Tage, Kalorien an ${MIN_CALORIE_COVERAGE * 100} % davon, dazu Gewicht`;
const BODY_NEED = `Körperfettmessung im Tab Body, höchstens ${R.BODY_MAX_AGE_DAYS} Tage alt`;
const TRAINING_NEED = `${R.TRAINING_MIN_WEEKS} Wochen Training im Logbuch`;

/**
 * Was eine Regel an Daten braucht, je Kennung. Steht unter `Noch keine Zahl`,
 * damit klar ist, was nachzutragen ist. Die Zahlen kommen aus den Regeln.
 */
const NEED: Record<string, string> = {
  A1: KCAL_NEED,
  A2: `${R.STALL_MIN_WEIGH_INS_PER_WEEK} Wägungen je Woche, ${R.STALL_WEEKS} Wochen lang, dazu Kalorien`,
  A3: `${KCAL_NEED}. Außerdem die Kalorienvorgabe im Sheet`,
  A4: `${BODY_NEED}, dazu Gewicht und Größe`,
  A5: `${BODY_NEED}, dazu Gewicht und Größe`,
  A6: `${KCAL_NEED}. Außerdem Zielgewicht oder Körperfett`,
  B4: `${KCAL_NEED}. Außerdem die Spalte Trainingday an ${R.DAY_TYPE_MIN_DAYS} der letzten ${R.DAY_TYPE_WINDOW_DAYS} Tage`,
  C1: TRAINING_NEED,
  C2: `Übungen mit ${R.PROGRESSION_STALL_WEEKS} geloggten Wochen im Logbuch`,
  C3: TRAINING_NEED,
  C4: `Progression von ${R.DELOAD_MIN_EXERCISES} Übungen, dazu Schlaf und Energylevel`,
  D1: `Schlaf an ${R.SLEEP_MIN_DAYS} der letzten ${R.SLEEP_WINDOW_DAYS} Tage`,
  D2: `Schlaf an ${R.SLEEP_SPREAD_MIN_DAYS} der letzten ${R.SLEEP_SPREAD_WINDOW_DAYS} Tage`,
  D3: `Schlaf und Energylevel an ${R.SLEEP_MIN_DAYS} Tagen je Woche, zwei Wochen lang, dazu Progression`,
};

function row(rule: string, label: string, value: string, basis: string, tone: RowTone = 'neutral'): OpinionRow {
  return { rule, label, value, basis, tone, refused: false, need: '' };
}

function refusedRow(rule: string, label: string, reason: string): OpinionRow {
  return { rule, label, value: reason, basis: '', tone: 'neutral', refused: true, need: NEED[rule] ?? '' };
}

/** Zeile aus einem Insight, bei Verweigerung der Grund. */
function from<T>(
  rule: string,
  label: string,
  insight: Insight<T>,
  build: (value: { ok: true } & T) => OpinionRow,
): OpinionRow {
  return insight.ok ? build(insight) : refusedRow(rule, label, insight.reason);
}

function macros(proteinG: number | null, carbsG: number | null, fatG: number | null): string {
  return `P ${integer(proteinG)}${SEP}C ${integer(carbsG)}${SEP}F ${integer(fatG)}`;
}

function trainerDay(goals: Goals, type: DayType): DayGoals {
  if (type === 'low') return goals.lowDay ?? goals.average;
  return goals.highDay ?? goals.average;
}

function dayRow(day: DayMacros, goals: Goals, highLabel: string | null): OpinionRow {
  const trainer = trainerDay(goals, day.type);
  const parts = [
    `${integer(day.kcal)} kcal`,
    `${integer(day.daysPerWeek)} je Woche`,
    `Vorgabe ${macros(trainer.proteinG, trainer.carbsG, trainer.fatG)}${SEP}${target(trainer.caloriesKcal)} kcal`,
  ];
  if (day.type === 'high' && highLabel) parts.push(highLabel);
  return row('B4', DAY_WORD[day.type], macros(day.proteinG, day.carbsG, day.fatG), parts.join(SEP));
}

export function buildOpinion(input: OpinionInput): OpinionGroup[] {
  const { daily, goals, training } = input;

  // A Phase und Kalorien
  const opinion = kcalOpinion(daily, goals);
  const stalled = stall(daily, goals);
  const step = nextStep(opinion, stalled);
  const trend = weightTrend(daily);
  const bodyfat = input.bodyError ? null : latestBodyfat(input.body);
  const measured = ffmi(trend.ok ? trend.currentSmoothed : null, goals.heightCm, bodyfat, input.now);
  const phase = phaseOpinion(measured);
  const reversed = reverse({
    opinion,
    bodyfatPct: measured.ok ? measured.bodyfatPct : null,
    targetWeightKg: input.targetWeightKg,
  });

  const bodyRefusal = input.bodyError;
  const phaseRows: OpinionRow[] = [
    from('A1', 'Kalorien', opinion, (o) => row(
      'A1',
      'Kalorien',
      `${integer(o.kcal)} kcal`,
      [
        `Vorgabe ${target(o.trainerKcal)}`,
        `Differenz ${signed(o.diffKcal, 0)}`,
        `Erhaltung ${integer(o.tdeeMid)}`,
        `Basis ${integer(o.basisDays)} Tage`,
      ].join(SEP),
    )),
    from('A2', 'Stillstand', stalled, (s) => row(
      'A2',
      'Stillstand',
      STALL_WORD[s.status],
      [
        `${integer(s.stalledWeeks)} von ${R.STALL_WEEKS} Wochen`,
        `Compliance ${integer(s.compliancePct)} %`,
        `Basis ${integer(s.basisDays)} Tage`,
      ].join(SEP),
      s.status === 'kein-handlungsbedarf' ? 'neutral' : 'warn',
    )),
    from('A3', 'Nächster Schritt', step, (n) => row(
      'A3',
      'Nächster Schritt',
      `${integer(n.kcal)} kcal`,
      `Schritt ${signed(n.stepKcal, 0)}${SEP}Vorgabe ${target(n.trainerKcal)}`,
    )),
    bodyRefusal ? refusedRow('A4', 'FFMI', bodyRefusal) : from('A4', 'FFMI', measured, (m) => row(
      'A4',
      'FFMI',
      decimal(m.ffmi, 1),
      [
        `Magermasse ${decimal(m.leanKg, 1)} kg`,
        `Körperfett ${decimal(m.bodyfatPct, 1)} %`,
        `Messung ${integer(m.ageDays)} Tage alt`,
      ].join(SEP),
    )),
    bodyRefusal ? refusedRow('A5', 'Phase', bodyRefusal) : from('A5', 'Phase', phase, (p) => row(
      'A5',
      'Phase',
      PHASE_WORD[p.phase],
      `Muskelmasse ${p.band}${SEP}FFMI ${decimal(p.ffmi, 1)}${SEP}Körperfett ${decimal(p.bodyfatPct, 1)} %`,
    )),
    from('A6', 'Reverse', reversed, (r) => row(
      'A6',
      'Reverse',
      r.steps.map((kcal) => integer(kcal)).join(' → '),
      `kcal je Woche${SEP}Start ${integer(r.cutKcal)}${SEP}Ende ${integer(r.endKcal)}`,
    )),
  ];

  // B Makros je Tagestyp
  const plan = macroPlan({
    opinion,
    trainingDays: trainingDaysPerWeek(daily),
    surplus: phase.ok && phase.phase === 'lean-bulk',
  });
  const highLabel = hardestPlanDay(input.plan);
  const macroRows: OpinionRow[] = plan.ok
    ? [
        ...plan.days.map((day) => dayRow(day, goals, highLabel)),
        row(
          'B4',
          'Wochenschnitt',
          `${integer(plan.weeklyAvgKcal)} kcal`,
          `Vorgabe ${target(goals.average.caloriesKcal)}${SEP}${integer(plan.trainingDaysPerWeek)} Trainingstage je Woche`,
        ),
      ]
    : [refusedRow('B4', 'Tagestypen', plan.reason)];

  // C Training und D Erholung
  const loads = muscleLoads(training);
  const progress = progression(training);
  const sleep = sleepDuration(daily);
  const spread = sleepSpread(daily);
  const recovery = recoverySignal(daily, progress.ok ? progress.regressingShare : null);
  const rest = deload(progress, recovery);

  const trainingRows: OpinionRow[] = [];
  if (loads.ok) {
    const lowFrequency = loads.muscles.filter((m) => m.belowFrequency);
    const lowSets = loads.muscles.filter((m) => m.belowSets);
    const total = loads.muscles.length;
    trainingRows.push(row(
      'C1',
      'Frequenz',
      `${integer(total - lowFrequency.length)} von ${integer(total)} im Ziel`,
      `Ziel ${R.FREQUENCY_TARGET_PER_WEEK} je Woche${SEP}Basis ${integer(loads.basisWeeks)} Wochen`,
      lowFrequency.length ? 'warn' : 'ok',
    ));
    for (const muscle of lowFrequency.slice(0, MAX_LISTED)) {
      trainingRows.push(row('C1', muscle.muscle, `${decimal(muscle.daysPerWeek, 1)} je Woche`, `${decimal(muscle.setsPerWeek, 1)} Sätze je Woche`, 'warn'));
    }
    trainingRows.push(row(
      'C3',
      'Wochensätze',
      `${integer(total - lowSets.length)} von ${integer(total)} im Ziel`,
      [`Untergrenze ${R.MIN_WEEKLY_SETS}`, ...lowSets.slice(0, MAX_LISTED).map((m) => `${m.muscle} ${decimal(m.setsPerWeek, 1)}`)].join(SEP),
      lowSets.length ? 'warn' : 'ok',
    ));
  } else {
    trainingRows.push(refusedRow('C1', 'Frequenz', loads.reason), refusedRow('C3', 'Wochensätze', loads.reason));
  }
  if (progress.ok) {
    const flagged = progress.exercises.filter((e) => e.stalled || e.regressing);
    trainingRows.push(row(
      'C2',
      'Progression',
      `${integer(progress.rated - flagged.length)} von ${integer(progress.rated)} steigen`,
      `Basis ${integer(progress.rated)} Übungen`,
      flagged.length ? 'warn' : 'ok',
    ));
    for (const exercise of flagged.slice(0, MAX_LISTED)) {
      trainingRows.push(row(
        'C2',
        exercise.name,
        `${signed(exercise.changePct, 1)} %`,
        `${integer(exercise.stalledWeeks)} Wochen ohne Bestwert${SEP}${exercise.day}`,
        'warn',
      ));
    }
  } else {
    trainingRows.push(refusedRow('C2', 'Progression', progress.reason));
  }
  trainingRows.push(from('C4', 'Deload', rest, (d) => row(
    'C4',
    'Deload',
    d.signal ? 'Signal' : 'Kein Signal',
    `Rückläufig ${integer(d.regressingShare * 100)} %${SEP}Basis ${integer(d.rated)} Übungen`,
    d.signal ? 'warn' : 'neutral',
  )));

  const recoveryRows: OpinionRow[] = [
    from('D1', 'Schlaf', sleep, (s) => row(
      'D1',
      'Schlaf',
      `${decimal(s.meanH, 1)} h`,
      `Korridor ${R.SLEEP_MIN_H} bis ${R.SLEEP_MAX_H}${SEP}Basis ${integer(s.basisDays)} Tage`,
      s.status === 'im-korridor' ? 'ok' : 'warn',
    )),
    from('D2', 'Streuung', spread, (s) => row(
      'D2',
      'Streuung',
      `${decimal(s.sdH, 1)} h`,
      `Grenze ${R.SLEEP_SPREAD_MAX_H}${SEP}Basis ${integer(s.basisDays)} Tage`,
      s.irregular ? 'warn' : 'ok',
    )),
    from('D3', 'Erholung', recovery, (r) => row(
      'D3',
      'Erholung',
      r.active ? 'Signal' : 'Kein Signal',
      [
        `Schlaf ${decimal(r.sleepMeanH, 1)} h`,
        `Energylevel ${signed(r.energyChange, 1)}`,
        `Rückläufig ${integer(r.regressingShare * 100)} %`,
        `Basis ${integer(r.basisDays)} Tage`,
      ].join(SEP),
      r.active ? 'warn' : 'neutral',
    )),
  ];

  return [
    { title: 'Phase und Kalorien', rows: phaseRows },
    { title: 'Makros je Tagestyp', rows: macroRows },
    { title: 'Training', rows: trainingRows },
    { title: 'Schlaf und Erholung', rows: recoveryRows },
  ];
}

function headNode(item: OpinionRow): HTMLElement {
  return el('div', { class: 'op-head' }, [
    el('span', { class: 'op-label', text: item.label }),
    el('span', { class: 'op-rule', text: item.rule }),
  ]);
}

/** Zeile ohne Ergebnis: was fehlt und wie der Stand ist, statt einer leeren Zahl. */
function refusedNode(item: OpinionRow): HTMLElement {
  return el('div', { class: 'op-row is-refused' }, [
    headNode(item),
    el('div', { class: 'op-value is-refused', text: NO_NUMBER }),
    item.need ? el('div', { class: 'op-need' }, [el('b', { text: 'Fehlt: ' }), document.createTextNode(item.need)]) : null,
    el('div', { class: 'card-basis' }, [el('b', { text: 'Stand: ' }), document.createTextNode(item.value)]),
  ]);
}

function rowNode(item: OpinionRow): HTMLElement {
  if (item.refused) return refusedNode(item);
  const tone = item.tone === 'warn' ? ' is-off' : item.tone === 'ok' ? ' is-ok' : '';
  return el('div', { class: 'op-row' }, [
    headNode(item),
    el('div', { class: `op-value${tone}`, text: item.value }),
    item.basis ? el('div', { class: 'card-basis', text: item.basis }) : null,
  ]);
}

function groupNode(group: OpinionGroup): HTMLElement {
  return el('div', { class: 'card' }, [
    el('div', { class: 'card-label', text: group.title }),
    ...group.rows.map(rowNode),
  ]);
}

export function renderSecondOpinion(input: OpinionInput): void {
  const container = byId('second-opinion');
  if (!container) return;
  container.replaceChildren(...buildOpinion(input).map(groupNode));
}
