import { describe, it, expect } from 'vitest';

import { linearRegression, pearson } from '../src/analytics/regression';
import { detectPlateau, projectToTarget, weightTrend, MIN_R2_FOR_PROJECTION } from '../src/analytics/trend';
import { tdeeForWindow, tdeeRange, KCAL_PER_KG_BODYMASS } from '../src/analytics/tdee';
import { complianceOf, streakOf } from '../src/analytics/compliance';
import { correlations, pairs, trainingEffect } from '../src/analytics/correlation';
import type { DailyEntry } from '../src/types';

const DAY = 864e5;
const START = new Date(2026, 0, 1);

/** Baut einen Tag. Alles, was nicht gesetzt wird, gilt als nicht erfasst. */
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

/** Reihe mit linearem Gewichtsverlauf. */
function linearWeights(days: number, from: number, perDay: number, extra: Partial<DailyEntry> = {}): DailyEntry[] {
  return Array.from({ length: days }, (_, i) => day(i, { weight: from + perDay * i, ...extra }));
}

describe('Regression', () => {
  it('trifft eine exakte Gerade', () => {
    const r = linearRegression([{ x: 0, y: 10 }, { x: 1, y: 8 }, { x: 2, y: 6 }, { x: 3, y: 4 }])!;
    expect(r.slope).toBeCloseTo(-2, 10);
    expect(r.intercept).toBeCloseTo(10, 10);
    expect(r.r2).toBeCloseTo(1, 10);
    expect(r.slopeStdError).toBeCloseTo(0, 10);
  });

  it('verweigert unter drei Punkten und ohne Streuung in x', () => {
    expect(linearRegression([{ x: 0, y: 1 }, { x: 1, y: 2 }])).toBeNull();
    expect(linearRegression([{ x: 1, y: 1 }, { x: 1, y: 2 }, { x: 1, y: 3 }])).toBeNull();
  });

  it('rechnet Pearson r', () => {
    expect(pearson([{ x: 1, y: 2 }, { x: 2, y: 4 }, { x: 3, y: 6 }])).toBeCloseTo(1, 10);
    expect(pearson([{ x: 1, y: 6 }, { x: 2, y: 4 }, { x: 3, y: 2 }])).toBeCloseTo(-1, 10);
    expect(pearson([{ x: 1, y: 5 }, { x: 2, y: 5 }, { x: 3, y: 5 }])).toBeNull();
  });
});

describe('Trend', () => {
  it('findet die Rate eines exakt linearen Verlusts', () => {
    // 0.1 kg pro Tag entspricht 0.7 kg pro Woche.
    const trend = weightTrend(linearWeights(40, 100, -0.1));
    expect(trend.ok).toBe(true);
    if (!trend.ok) return;
    expect(trend.ratePerWeek).toBeCloseTo(-0.7, 6);
    expect(trend.r2).toBeCloseTo(1, 6);
    // Die ersten sechs Tage tragen kein volles Fenster und bleiben aussen vor.
    expect(trend.basisDays).toBe(34);
  });

  it('verweigert unter vierzehn geglaetteten Tagen', () => {
    const trend = weightTrend(linearWeights(10, 100, -0.1));
    expect(trend.ok).toBe(false);
    if (trend.ok) return;
    expect(trend.reason).toBe('Basis 4 von 14 Tagen');
  });

  it('haelt bei konstantem Gewicht die Rate bei null', () => {
    const trend = weightTrend(linearWeights(30, 90, 0));
    expect(trend.ok).toBe(true);
    if (!trend.ok) return;
    expect(trend.ratePerWeek).toBeCloseTo(0, 6);
  });

  it('kommt mit Datenluecken zurecht', () => {
    const entries = linearWeights(40, 100, -0.1).filter((_, i) => i % 3 !== 0);
    const trend = weightTrend(entries);
    expect(trend.ok).toBe(true);
    if (!trend.ok) return;
    expect(trend.ratePerWeek).toBeLessThan(0);
  });
});

describe('Zielprojektion', () => {
  const trend = weightTrend(linearWeights(40, 100, -0.1));

  it('rechnet das Zieldatum aus der Rate', () => {
    // Letzter geglaetteter Wert liegt bei rund 96.4, Ziel 92, Rate 0.7 pro Woche.
    const projection = projectToTarget(trend, 92);
    expect(projection.ok).toBe(true);
    if (!projection.ok) return;
    expect(projection.weeks).toBeGreaterThan(5);
    expect(projection.weeks).toBeLessThan(8);
    expect(projection.earliest.getTime()).toBeLessThanOrEqual(projection.date.getTime());
    expect(projection.latest.getTime()).toBeGreaterThanOrEqual(projection.date.getTime());
  });

  it('verweigert ohne Zielgewicht', () => {
    const projection = projectToTarget(trend, null);
    expect(projection.ok).toBe(false);
    if (projection.ok) return;
    expect(projection.reason).toBe('Kein Zielgewicht gesetzt');
  });

  it('verweigert, wenn der Trend vom Ziel weg zeigt', () => {
    const projection = projectToTarget(trend, 110);
    expect(projection.ok).toBe(false);
    if (projection.ok) return;
    expect(projection.reason).toBe('Trend zeigt vom Ziel weg');
  });

  it('verweigert bei zu unruhigem Verlauf', () => {
    // Zickzack ohne Richtung, R² faellt unter die Schwelle.
    const noisy = Array.from({ length: 40 }, (_, i) => day(i, { weight: 90 + (i % 2 === 0 ? 1.5 : -1.5) }));
    const noisyTrend = weightTrend(noisy);
    expect(noisyTrend.ok).toBe(true);
    if (!noisyTrend.ok) return;
    expect(noisyTrend.r2).toBeLessThan(MIN_R2_FOR_PROJECTION);
    const projection = projectToTarget(noisyTrend, 85);
    expect(projection.ok).toBe(false);
    if (projection.ok) return;
    expect(projection.reason).toContain('zu unruhig');
  });

  it('reicht die Verweigerung des Trends durch', () => {
    const projection = projectToTarget(weightTrend(linearWeights(5, 100, -0.1)), 90);
    expect(projection.ok).toBe(false);
    if (projection.ok) return;
    expect(projection.reason).toBe('Basis 0 von 14 Tagen');
  });
});

describe('Plateau', () => {
  it('erkennt Stillstand bei erfuellter Ausfuehrung als Plateau', () => {
    const plateau = detectPlateau(linearWeights(30, 90, 0), 95);
    expect(plateau.ok).toBe(true);
    if (!plateau.ok) return;
    expect(plateau.status).toBe('plateau');
    expect(plateau.basisDays).toBe(14);
  });

  it('nennt Stillstand bei schwacher Compliance Ausfuehrung', () => {
    const plateau = detectPlateau(linearWeights(30, 90, 0), 50);
    expect(plateau.ok).toBe(true);
    if (!plateau.ok) return;
    expect(plateau.status).toBe('ausfuehrung');
  });

  it('meldet kein Plateau bei laufender Abnahme', () => {
    const plateau = detectPlateau(linearWeights(30, 95, -0.1), 95);
    expect(plateau.ok).toBe(true);
    if (!plateau.ok) return;
    expect(plateau.status).toBe('kein-plateau');
  });

  it('verweigert unter vierzehn Tagen', () => {
    const plateau = detectPlateau(linearWeights(9, 90, 0), 95);
    expect(plateau.ok).toBe(false);
  });
});

describe('TDEE', () => {
  /** Sieben Tage auf 100 kg, sieben auf 99 kg, dazwischen linear. Zufuhr konstant. */
  function balanced(days: number, intake: number, from: number, to: number): DailyEntry[] {
    return Array.from({ length: days }, (_, i) => {
      const weight = i < 7 ? from : i >= days - 7 ? to : from + ((to - from) * (i - 6)) / (days - 13);
      return day(i, { weight, calories: intake });
    });
  }

  it('rechnet Zufuhr plus Energiebilanz', () => {
    const result = tdeeForWindow(balanced(28, 2000, 100, 99), 28);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.weightChangeKg).toBeCloseTo(-1, 6);
    expect(result.kcal).toBeCloseTo(2000 + KCAL_PER_KG_BODYMASS / 28, 4);
    expect(result.daysWithCalories).toBe(28);
  });

  it('liefert bei stabilem Gewicht die Zufuhr selbst', () => {
    const result = tdeeForWindow(balanced(28, 2500, 90, 90), 28);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.kcal).toBeCloseTo(2500, 6);
  });

  it('verweigert bei luckenhafter Kalorienerfassung', () => {
    const entries = balanced(28, 2000, 100, 99).map((e, i) => (i % 3 === 0 ? { ...e, calories: null } : e));
    const result = tdeeForWindow(entries, 28);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toMatch(/Kalorien an \d+ von 28 Tagen/);
  });

  it('verweigert unter vierzehn Tagen', () => {
    expect(tdeeForWindow(balanced(28, 2000, 100, 99), 10).ok).toBe(false);
    expect(tdeeForWindow(balanced(10, 2000, 100, 99), 14).ok).toBe(false);
  });

  it('gibt eine Spanne ueber die verfuegbaren Fenster und nennt die uebrigen', () => {
    const range = tdeeRange(balanced(30, 2000, 100, 99));
    expect(range.ok).toBe(true);
    if (!range.ok) return;
    expect(range.estimates.map((e) => e.windowDays)).toEqual([14, 28]);
    expect(range.low).toBeLessThanOrEqual(range.high);
    expect(range.skipped).toEqual([{ windowDays: 56, reason: 'Basis 30 von 56 Tagen' }]);
  });
});

describe('Compliance und Serien', () => {
  const entries = [
    day(0, { protein: 210 }), day(1, { protein: 190 }), day(2, { protein: 205 }),
    day(3, {}), day(4, { protein: 220 }), day(5, { protein: 201 }),
  ];

  it('fuehrt getroffene von erfassten Tagen', () => {
    const result = complianceOf(entries, (e) => e.protein, (v) => v >= 200);
    expect(result).toEqual({ hit: 4, recorded: 5, pct: 80 });
  });

  it('laesst eine Luecke die Serie weder verlaengern noch brechen', () => {
    const streak = streakOf(entries, (e) => e.protein, (v) => v >= 200);
    expect(streak.current).toBe(3);
    expect(streak.best).toBe(3);
    expect(streak.gaps).toBe(1);
  });

  it('bricht die Serie bei einem verfehlten Tag', () => {
    const streak = streakOf(entries.slice(0, 3), (e) => e.protein, (v) => v >= 200);
    expect(streak.best).toBe(1);
    expect(streak.current).toBe(1);
  });

  it('meldet bei fehlender Erfassung keinen Prozentwert', () => {
    expect(complianceOf([day(0)], (e) => e.protein, (v) => v >= 200).pct).toBeNull();
  });
});

describe('Korrelationen', () => {
  it('paart den Folgetag nur, wenn er wirklich folgt', () => {
    const entries = [day(0, { sleep: 8 }), day(1, { energy: 4 }), day(5, { energy: 2 })];
    expect(pairs(entries, (e) => e.sleep, (e) => e.energy, 1)).toEqual([{ x: 8, y: 4 }]);
  });

  it('findet einen perfekten Zusammenhang', () => {
    const entries: DailyEntry[] = [];
    for (let i = 0; i < 30; i++) {
      entries.push(day(i, { sleep: 5 + (i % 5) * 0.5, energy: null }));
    }
    // Energie am Folgetag spiegelt den Schlaf des Vortags.
    for (let i = 1; i < 30; i++) entries[i]!.energy = entries[i - 1]!.sleep;
    const result = correlations(entries);
    const sleepEnergy = result.found.find((f) => f.key === 'sleep-energy')!;
    expect(sleepEnergy.r).toBeCloseTo(1, 6);
    expect(sleepEnergy.n).toBeGreaterThanOrEqual(20);
  });

  it('nennt zu duenne Paare mit Grund statt sie zu verschweigen', () => {
    const result = correlations([day(0, { sleep: 8 }), day(1, { energy: 3 })]);
    expect(result.found).toEqual([]);
    expect(result.skipped.some((s) => s.reason.includes('von 20 Paaren'))).toBe(true);
  });
});

describe('Trainingstag gegen Ruhetag', () => {
  it('trennt Training, Ruhe und Unbekanntes', () => {
    const entries = [
      day(0, { training: 'D1 W1 M1' }), day(1, { energy: 4, sleep: 8 }),
      day(2, { training: 'Rest' }), day(3, { energy: 2, sleep: 7 }),
      day(4, { training: 'Tracker kaputt' }), day(5, { energy: 5, sleep: 9 }),
    ];
    const effect = trainingEffect(entries);
    expect(effect.ok).toBe(true);
    if (!effect.ok) return;
    expect(effect.afterTraining.energy).toBe(4);
    expect(effect.afterRest.energy).toBe(2);
    // Der Tag mit freier Notiz zaehlt in keinen der beiden Toepfe.
    expect(effect.afterTraining.n + effect.afterRest.n).toBe(2);
    expect(effect.energyDifference).toBe(2);
  });

  it('verweigert ohne verwertbare Folgetage', () => {
    expect(trainingEffect([day(0, { training: 'D1 W1 M1' })]).ok).toBe(false);
  });
});
