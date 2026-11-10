import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { COACH_RULES as R } from '../src/config/coachRules';
import { kcalOpinion, nextStep, stall } from '../src/coach/calories';
import { hardestPlanDay, macroPlan, trainingDaysPerWeek } from '../src/coach/macros';
import { ffmi, phaseOpinion, reverse } from '../src/coach/phase';
import { recoverySignal, sleepDuration, sleepSpread } from '../src/coach/recovery';
import { deload, muscleLoads, progression } from '../src/coach/training';
import { KCAL_PER_KG_BODYMASS, tdeeRange } from '../src/analytics/tdee';
import { refuse } from '../src/analytics/result';
import { MissingColumnsError } from '../src/parse/columns';
import { latestBodyfat, parseBody } from '../src/parse/body';
import { FALLBACK_GOALS, type Goals } from '../src/parse/goals';
import { parseTrainingSets } from '../src/parse/trainingSets';
import { buildOpinion } from '../src/ui/secondOpinion';
import type { DailyEntry, SheetValues } from '../src/types';
import { load } from './fixtures';

const DAY = 864e5;
const START = new Date(2026, 0, 1);

function day(index: number, values: Partial<DailyEntry> = {}): DailyEntry {
  const date = new Date(START.getTime() + index * DAY);
  return {
    date: `${date.getDate()}.${date.getMonth() + 1}.${date.getFullYear()}`,
    dateObj: date,
    weight: null, time: '', protein: null, carbs: null, fat: null, fiber: null,
    fv: null, calories: null, comment: '', sleep: null, sleepQ: null,
    digestion: null, stress: null, energy: null, steps: null, training: '',
    ...values,
  };
}

function series(days: number, make: (index: number) => Partial<DailyEntry>): DailyEntry[] {
  return Array.from({ length: days }, (_, i) => day(i, make(i)));
}

function goalsWith(kcal: number | null, rateOfLossPct: number | null = 0.25): Goals {
  const average = { ...FALLBACK_GOALS, caloriesKcal: kcal };
  return { average, highDay: average, lowDay: average, rateOfLossPct, startWeightKg: 100, heightCm: 180, missing: [] };
}

/** 60 Tage, 2300 kcal, 0.05 kg Verlust pro Tag: Erhaltung 2300 + 0.05 * 7700 = 2685. */
const INTAKE = 2300;
const LOSS_PER_DAY = 0.05;
const KNOWN_TDEE = INTAKE + LOSS_PER_DAY * KCAL_PER_KG_BODYMASS;
const TRAINING_PATTERN = ['D1 W1 M1', 'D2 W1 M1', 'Rest', 'D3 W1 M1', 'D4 W1 M1', 'Rest', 'Rest'];
const cut = series(60, (i) => ({
  weight: 100 - LOSS_PER_DAY * i,
  calories: INTAKE,
  training: TRAINING_PATTERN[i % 7]!,
  sleep: 7.5,
  energy: 7,
}));

describe('Keine Schwellen als Literal unter src/coach', () => {
  it('nutzt nur 0, 1, 2 und 100 als Zahlen', () => {
    const dir = join(import.meta.dirname, '..', 'src', 'coach');
    const allowed = new Set(['0', '1', '2', '100']);
    const offenders: string[] = [];
    for (const name of readdirSync(dir)) {
      const code = readFileSync(join(dir, name), 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\/\/.*$/gm, '')
        .replace(/`(?:[^`\\]|\\.)*`|'(?:[^'\\]|\\.)*'/g, "''");
      for (const match of code.matchAll(/(?<![\w.])\d+(?:\.\d+)?\b/g)) {
        if (!allowed.has(match[0])) offenders.push(`${name}: ${match[0]}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe('A1 Kalorien', () => {
  it('rechnet Mitte der TDEE Spanne plus Tagesdifferenz der Sollrate auf 1 kcal', () => {
    const opinion = kcalOpinion(cut, goalsWith(INTAKE));
    const tdee = tdeeRange(cut);
    expect(opinion.ok && tdee.ok).toBe(true);
    if (!opinion.ok || !tdee.ok) return;
    const mid = (tdee.low + tdee.high) / 2;
    const expected = mid - (opinion.weightKg * 0.25 / 100) * KCAL_PER_KG_BODYMASS / 7;
    expect(Math.abs(opinion.kcal - expected)).toBeLessThanOrEqual(1);
    expect(opinion.diffKcal).toBeCloseTo(opinion.kcal - INTAKE, 6);
  });

  it('trifft den bekannten Erhaltungsbedarf auf 1 kcal', () => {
    const opinion = kcalOpinion(cut, goalsWith(INTAKE));
    expect(opinion.ok).toBe(true);
    if (!opinion.ok) return;
    expect(Math.abs(opinion.tdeeMid - KNOWN_TDEE)).toBeLessThanOrEqual(1);
    const expected = KNOWN_TDEE - (opinion.weightKg * 0.25 / 100) * KCAL_PER_KG_BODYMASS / 7;
    expect(Math.abs(opinion.kcal - expected)).toBeLessThanOrEqual(1);
  });

  it('verweigert unter der Mindestdatenlage und ohne Sollrate', () => {
    expect(kcalOpinion(cut.slice(0, 10), goalsWith(INTAKE)).ok).toBe(false);
    const noRate = kcalOpinion(cut, goalsWith(INTAKE, null));
    expect(noRate).toEqual({ ok: false, reason: 'Sollrate fehlt im Sheet' });
  });
});

describe('A2 Stillstand und A3 Schritt', () => {
  const flat = (kcal: number, firstWeek = 90): DailyEntry[] =>
    series(28, (i) => ({ weight: i < 7 ? firstWeek : 90, calories: kcal }));

  it('meldet erst nach drei Wochen ein Plateau', () => {
    const three = stall(flat(INTAKE), goalsWith(INTAKE));
    expect(three.ok && three.status).toBe('plateau');
    expect(three.ok && three.stalledWeeks).toBe(R.STALL_WEEKS);

    const two = stall(flat(INTAKE, 90.5), goalsWith(INTAKE));
    expect(two.ok && two.status).toBe('kein-handlungsbedarf');
    expect(two.ok && two.stalledWeeks).toBe(2);
  });

  it('unterscheidet Plateau von Ausfuehrung', () => {
    const sloppy = stall(flat(INTAKE + 400), goalsWith(INTAKE));
    expect(sloppy.ok && sloppy.status).toBe('ausfuehrung');
    const step = nextStep(kcalOpinion(cut, goalsWith(INTAKE)), sloppy);
    expect(step.ok).toBe(false);
  });

  it('verweigert bei zu wenigen Waegungen mit Zahlenzeile', () => {
    const sparse = series(28, (i) => ({ weight: i % 3 === 0 ? 90 : null }));
    const result = stall(sparse, goalsWith(INTAKE));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/\d von 4 Wägungen/);
  });

  it('kappt die Aenderung auf einen Schritt', () => {
    const opinion = kcalOpinion(cut, goalsWith(INTAKE - 400));
    const step = nextStep(opinion, refuse('ohne Basis'));
    expect(step.ok && step.stepKcal).toBe(R.KCAL_STEP);
    expect(step.ok && step.kcal).toBe(INTAKE - 400 + R.KCAL_STEP);
    const down = nextStep(kcalOpinion(cut, goalsWith(INTAKE + 400)), refuse('ohne Basis'));
    expect(down.ok && down.stepKcal).toBe(-R.KCAL_STEP);
  });
});

describe('A4 bis A6 Koerperdaten', () => {
  const now = new Date(2026, 10, 10);
  const body = parseBody(load<{ values: SheetValues }>('test/fixtures/body/body.json').values);

  it('liest den Tab Body ueber Kopfzeilen', () => {
    expect(body).toHaveLength(3);
    expect(latestBodyfat(body)?.bodyfatPct).toBe(20);
    expect(body[1]!.waistCm).toBe(94.5);
    expect(() => parseBody([['date', 'waist_cm'], ['2026-11-01', '94']])).toThrow(MissingColumnsError);
    expect(parseBody([])).toEqual([]);
  });

  it('rechnet den FFMI', () => {
    const result = ffmi(90, 180, latestBodyfat(body), now);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.leanKg).toBeCloseTo(72, 6);
    expect(result.ffmi).toBeCloseTo(72 / (1.8 * 1.8), 6);
    expect(result.ageDays).toBe(9);
  });

  it('verweigert ohne oder mit veralteter Messung', () => {
    expect(ffmi(90, 180, null, now).ok).toBe(false);
    const stale = ffmi(90, 180, latestBodyfat(body), new Date(2027, 0, 10));
    expect(stale.ok).toBe(false);
    if (!stale.ok) expect(stale.reason).toMatch(/\d+ Tage alt, höchstens 42/);
    expect(phaseOpinion(stale).ok).toBe(false);
  });

  it('waehlt die Phase nach der Tabelle', () => {
    const at = (bodyfatPct: number, weightKg: number): string => {
      const result = phaseOpinion(ffmi(weightKg, 180, { date: now, bodyfatPct, waistCm: null, note: '' }, now));
      return result.ok ? `${result.band} ${result.phase}` : result.reason;
    };
    expect(at(20, 70)).toBe('gering cut');
    expect(at(16, 68)).toBe('gering mini-cut');
    expect(at(12, 64)).toBe('gering recomp');
    expect(at(16, 75)).toBe('mittel cut');
    expect(at(12, 72)).toBe('mittel mini-cut');
    expect(at(13, 80)).toBe('entwickelt cut');
    expect(at(11, 80)).toBe('entwickelt halten');
    expect(at(9, 70)).toBe('mittel lean-bulk');
  });

  it('gibt die Reverse Stufen erst am Ziel aus', () => {
    const opinion = kcalOpinion(cut, goalsWith(INTAKE));
    const early = reverse({ opinion, bodyfatPct: 20, targetWeightKg: 82 });
    expect(early.ok).toBe(false);
    if (!early.ok) expect(early.reason).toMatch(/^Gewicht \d+,\d über Ziel 82,0$/);

    const done = reverse({ opinion, bodyfatPct: 11, targetWeightKg: null });
    expect(done.ok).toBe(true);
    if (!done.ok || !opinion.ok) return;
    const deficit = opinion.tdeeMid - INTAKE;
    expect(done.steps[0]).toBeCloseTo(INTAKE + deficit * R.REVERSE_FIRST_STEP_SHARE, 6);
    expect(done.steps[1]! - done.steps[0]!).toBeCloseTo(R.REVERSE_WEEKLY_STEP_KCAL, 6);
    expect(done.steps[done.steps.length - 1]).toBeCloseTo(opinion.tdeeMid + R.REVERSE_END_SURPLUS_KCAL, 6);
  });
});

describe('B Makros je Tagestyp', () => {
  const opinion = kcalOpinion(cut, goalsWith(INTAKE));
  const trainingDays = trainingDaysPerWeek(cut);

  it('zaehlt Trainingstage und verweigert ohne Eintraege', () => {
    expect(trainingDays.ok && trainingDays.perWeek).toBe(4);
    expect(trainingDaysPerWeek(series(30, () => ({ training: 'Notiz' }))).ok).toBe(false);
  });

  it('trifft im Wochenschnitt A1 und haelt die Boeden', () => {
    const plan = macroPlan({ opinion, trainingDays, surplus: false });
    expect(plan.ok).toBe(true);
    if (!plan.ok || !opinion.ok) return;
    expect(Math.abs(plan.weeklyAvgKcal - opinion.kcal)).toBeLessThanOrEqual(1);
    expect(plan.days.map((d) => `${d.type} ${d.daysPerWeek}`)).toEqual(['low 3', 'medium 3', 'high 1']);
    for (const d of plan.days) {
      expect(d.fatG).toBeGreaterThanOrEqual(R.FAT_FLOOR_G);
      expect(d.proteinG).toBeGreaterThanOrEqual(opinion.weightKg * R.PROTEIN_FLOOR_G_PER_KG - 1e-9);
      expect(d.proteinG * 4 + d.carbsG * 4 + d.fatG * 9).toBeCloseTo(d.kcal, 6);
    }
    const [low, medium, high] = plan.days;
    expect(high!.carbsG).toBeCloseTo(medium!.carbsG * R.HIGH_DAY_CARBS_FACTOR, 6);
    expect(low!.carbsG).toBeCloseTo(opinion.weightKg * R.LOW_DAY_CARBS_G_PER_KG, 6);
    expect(high!.kcal).toBeGreaterThan(medium!.kcal);
  });

  it('verweigert, wenn der Medium Day unter den Low Day faellt', () => {
    const starved = kcalOpinion(cut, goalsWith(INTAKE, 1.5));
    const plan = macroPlan({ opinion: starved, trainingDays, surplus: false });
    expect(plan.ok).toBe(false);
    if (!plan.ok) expect(plan.reason).toMatch(/^Carbs Medium -?\d+ g unter Low \d+ g$/);
  });

  it('legt den High Day auf den Plantag mit den meisten Saetzen', () => {
    const exercise = (sets: number) => ({ sets }) as never;
    const plan = { days: [
      { tag: 'Tag 1', label: 'Montag Push', exercises: [exercise(3), exercise(3)] },
      { tag: 'Tag 2', label: 'Mittwoch Beine', exercises: [exercise(4), exercise(4)] },
    ] };
    expect(hardestPlanDay(plan)).toBe('Mittwoch Beine');
    expect(hardestPlanDay(null)).toBeNull();
  });
});

/** Vier Wochen, Brust zweimal je Woche steigend, Bizeps einmal je Woche fallend. */
function trainingRows(weeks: number): SheetValues {
  const rows: string[][] = [['id', 'date', 'tag', 'exercise', 'muscle', 'set', 'kg', 'reps']];
  const add = (week: number, weekday: number, tag: string, exercise: string, muscle: string, kg: number, sets: number): void => {
    const date = new Date(2026, 9, 5 + week * 7 + weekday);
    const iso = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    for (let set = 1; set <= sets; set++) rows.push([`${iso}-${tag}`, iso, tag, exercise, muscle, String(set), String(kg), '8']);
  };
  for (let week = 0; week < weeks; week++) {
    add(week, 0, 'Tag 1', 'Bankdruecken', 'Brust', 80 + week * 2.5, 4);
    add(week, 3, 'Tag 3', 'Schraegbank', 'Brust', 60 + week * 2.5, 4);
    add(week, 0, 'Tag 1', 'Curls', 'Bizeps', 20 - week, 3);
  }
  return rows;
}

describe('C Training', () => {
  const training = parseTrainingSets(trainingRows(4));

  it('rechnet Frequenz und Wochensaetze je Muskelgruppe', () => {
    const loads = muscleLoads(training);
    expect(loads.ok).toBe(true);
    if (!loads.ok) return;
    expect(loads.basisWeeks).toBe(4);
    const chest = loads.muscles.find((m) => m.muscle === 'Brust')!;
    const biceps = loads.muscles.find((m) => m.muscle === 'Bizeps')!;
    expect(chest).toMatchObject({ daysPerWeek: 2, setsPerWeek: 8, belowFrequency: false, belowSets: false });
    expect(biceps).toMatchObject({ daysPerWeek: 1, setsPerWeek: 3, belowFrequency: true, belowSets: true });
  });

  it('erkennt stehende und ruecklaeufige Uebungen', () => {
    const progress = progression(training);
    expect(progress.ok).toBe(true);
    if (!progress.ok) return;
    expect(progress.rated).toBe(3);
    const curls = progress.exercises[0]!;
    expect(curls).toMatchObject({ name: 'Curls', stalledWeeks: 3, stalled: true, regressing: true });
    const bench = progress.exercises.find((e) => e.name === 'Bankdruecken')!;
    expect(bench).toMatchObject({ stalledWeeks: 0, stalled: false, regressing: false });
    expect(progress.regressingShare).toBeCloseTo(1 / 3, 6);
  });

  it('verweigert unter der Mindestdatenlage', () => {
    expect(muscleLoads(null)).toEqual({ ok: false, reason: 'Basis 0 von 2 Wochen' });
    expect(muscleLoads(parseTrainingSets(trainingRows(1)))).toEqual({ ok: false, reason: 'Basis 1 von 2 Wochen' });
    expect(progression(parseTrainingSets(trainingRows(2))).ok).toBe(false);
    const few = deload(progression(training), refuse('ohne Basis'));
    expect(few).toEqual({ ok: false, reason: 'Basis 3 von 4 Übungen' });
  });

  it('meldet eine fehlende Spalte sichtbar', () => {
    expect(() => parseTrainingSets([['id', 'date', 'tag', 'exercise', 'muscle', 'set', 'reps'], ['a', '2026-11-03', 'Tag 1', 'X', 'Brust', '1', '8']]))
      .toThrow(MissingColumnsError);
  });

  it('laeuft auf dem Fixture von TrainingSets', () => {
    const fixture = parseTrainingSets(load<{ values: SheetValues }>('test/fixtures/training-sets/training-sets.json').values);
    const loads = muscleLoads(fixture);
    const progress = progression(fixture);
    expect(loads.ok || /^Basis \d von 2 Wochen$/.test(loads.reason)).toBe(true);
    expect(progress.ok || /^Keine Übung mit 3 geloggten Wochen$/.test(progress.reason)).toBe(true);
  });
});

describe('D Schlaf und Erholung', () => {
  const tired = series(14, (i) => ({ sleep: i % 2 ? 5.5 : 7, energy: i < 7 ? 7 : 5 }));

  it('misst Schlafdauer gegen den Korridor', () => {
    const good = sleepDuration(cut);
    expect(good.ok && good.status).toBe('im-korridor');
    const short = sleepDuration(tired);
    expect(short.ok && short.status).toBe('unter');
    expect(short.ok && short.basisDays).toBe(7);
    expect(sleepDuration(series(7, (i) => ({ sleep: i < 3 ? 7 : null })))).toEqual({ ok: false, reason: 'Basis 3 von 5 Tagen' });
  });

  it('misst die Streuung', () => {
    const spread = sleepSpread(tired);
    expect(spread.ok && spread.sdH).toBeCloseTo(0.75, 6);
    expect(spread.ok && spread.irregular).toBe(false);
    const wild = sleepSpread(series(14, (i) => ({ sleep: i % 2 ? 4 : 9 })));
    expect(wild.ok && wild.irregular).toBe(true);
    expect(sleepSpread(tired.slice(0, 5)).ok).toBe(false);
  });

  it('meldet das Erholungssignal nur, wenn alle drei Zeichen zusammentreffen', () => {
    const signal = recoverySignal(tired, 0.4);
    expect(signal.ok && signal.active).toBe(true);
    expect(signal.ok && signal.energyChange).toBeCloseTo(-2, 6);
    const strong = recoverySignal(tired, 0);
    expect(strong.ok && strong.active).toBe(false);
    const rested = recoverySignal(cut, 0.4);
    expect(rested.ok && rested.active).toBe(false);
    expect(recoverySignal(tired, null).ok).toBe(false);
  });

  it('gibt das Deload Signal nur mit Erholungssignal', () => {
    const progress = { ok: true as const, exercises: [], regressingShare: 0.5, rated: 6 };
    const on = deload(progress, recoverySignal(tired, 0.5));
    expect(on.ok && on.signal).toBe(true);
    const off = deload(progress, recoverySignal(cut, 0.5));
    expect(off.ok && off.signal).toBe(false);
  });
});

describe('Bereich Zweitmeinung', () => {
  const input = {
    daily: cut,
    goals: goalsWith(INTAKE),
    training: parseTrainingSets(trainingRows(4)),
    plan: null,
    body: [],
    bodyError: null,
    targetWeightKg: 82,
    now: new Date(2026, 2, 5),
  };

  it('liefert vier Gruppen, jede Zeile mit Kennung, Zahl und Datenbasis', () => {
    const groups = buildOpinion(input);
    expect(groups.map((g) => g.title)).toEqual(['Phase und Kalorien', 'Makros je Tagestyp', 'Training', 'Schlaf und Erholung']);
    const rows = groups.flatMap((g) => g.rows);
    for (const row of rows) {
      expect(row.rule).toMatch(/^[A-D]\d$/);
      expect(row.value).not.toBe('');
      if (!row.refused) expect(row.basis).not.toBe('');
    }
    const kcal = rows.find((r) => r.rule === 'A1')!;
    expect(kcal.value).toMatch(/^\d\.\d{3} kcal$/);
    expect(kcal.basis).toMatch(/^Vorgabe 2\.300 · Differenz [+−]\d+ · Erhaltung 2\.685 · Basis 56 Tage$/);
  });

  it('verweigert ohne Tab Body nur A4 bis A6, der Rest laeuft', () => {
    const rows = buildOpinion(input).flatMap((g) => g.rows);
    const refused = rows.filter((r) => r.refused).map((r) => r.rule);
    expect(refused).toEqual(['A4', 'A5', 'A6', 'C4']);
    expect(rows.find((r) => r.rule === 'A4')!.value).toBe('Körperfett: 0 Messungen im Tab Body');

    const broken = buildOpinion({ ...input, bodyError: 'Spalten nicht gefunden: bodyfat_pct' }).flatMap((g) => g.rows);
    expect(broken.find((r) => r.rule === 'A5')!.value).toBe('Spalten nicht gefunden: bodyfat_pct');
  });
});
