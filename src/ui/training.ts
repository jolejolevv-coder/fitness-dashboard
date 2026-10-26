import type { Exercise, ParsedTraining } from '../types';
import { avgRepsFromStr, epley1RM } from '../analytics/strength';
import { baselineLoad, usableLoad } from '../parse/training';
import { byId, COLORS, setText, show } from './dom';
import { el } from './build';
import { EMPTY, integer, signed, target as plain } from './format';
import { withAlpha } from './palette';
import type { Charts } from './charts';

const MUSCLE_COLORS = [
  '#38bdf8', '#f59e0b', '#4ade80', '#f87171', '#c084fc', '#818cf8', '#fb923c',
  '#34d399', '#fbbf24', '#60a5fa', '#e879f9', '#a3e635', '#94a3b8', '#f472b6',
] as const;

/** Rueckfallwerte, wenn Saetze oder Wiederholungen fehlen, fuer die Volumenrechnung. */
const FALLBACK_SETS = 3;
const FALLBACK_REPS = 8;

/** Ab dieser prozentualen Veraenderung gilt eine Progression als Fortschritt. */
const PROGRESSION_THRESHOLD_PCT = 1;

/** Alpha der Flaeche unter den Linien. */
const AREA_ALPHA = 0.12;

interface State {
  exercises: Record<string, Exercise>;
  weekCount: number;
  currentWeek: number;
  /** Geladener Chunk `charts`. Die Auswahlfelder zeichnen nach, ohne neu zu laden. */
  charts: Charts;
}

let state: State | null = null;
/** Gewaehlter Trainingstag, leer heisst alle. */
let dayFilter = '';
/** Schluessel der Uebung in der Detailansicht. */
let selectedKey = '';

/**
 * Volumen einer Uebungswoche.
 *
 * Unplausible Lasten gehen nicht ein, sonst schlaegt ein Tippfehler in der
 * Lastspalte bis in die Volumenverteilung durch.
 */
function volumeOf(exercise: Exercise, weekIndex: number): number {
  const load = usableLoad(exercise, weekIndex);
  if (!load) return 0;
  const week = exercise.weeks[weekIndex]!;
  return (week.sets || FALLBACK_SETS) * (avgRepsFromStr(week.repsActual) ?? FALLBACK_REPS) * load;
}

export function renderTraining(parsed: ParsedTraining | null, charts: Charts): void {
  if (!parsed || !Object.keys(parsed.exercises).length) {
    show('t-no-data', true, 'grid');
    show('t-content', false);
    state = null;
    return;
  }

  show('t-no-data', false);
  show('t-content', true);
  state = { exercises: parsed.exercises, weekCount: parsed.weekCount, currentWeek: parsed.currentWeek, charts };

  const days = trainingDays();
  if (!days.includes(dayFilter)) dayFilter = '';

  renderCards();
  renderVolumeChart();
  renderDayChips(days);
  renderExerciseList();
}

function weekVolume(): number {
  if (!state) return 0;
  let total = 0;
  for (const exercise of Object.values(state.exercises)) {
    total += volumeOf(exercise, state.currentWeek - 1);
  }
  return total;
}

function trainingDays(): string[] {
  if (!state) return [];
  return [...new Set(Object.values(state.exercises).map((e) => e.day).filter(Boolean))].sort();
}

function dayLabel(day: string): string {
  // Das Sheet schreibt `Day 1 - Torso`, in der Oberflaeche steht kein Bindestrich.
  return day.replace('Day ', 'Tag ').replace(/\s+-\s+/g, ' ');
}

/**
 * Progression einer Uebung in Prozent.
 *
 * PHASE 2: Grundlage ist die erste Woche mit brauchbarer Last, nicht mehr
 * zwingend Woche 1. Als unplausibel markierte Werte bleiben aussen vor. Vorher
 * meldete die Kachel 900 Prozent, weil in einer Zelle `9-9` statt `90` stand.
 */
function progressionPct(exercise: Exercise, currentWeek: number): number | null {
  const base = baselineLoad(exercise);
  const current = usableLoad(exercise, currentWeek - 1);
  if (!base || current === null || current <= 0) return null;
  return ((current - base.load) / base.load) * 100;
}

function card(label: string, value: HTMLElement, basis: (Node | string)[]): HTMLElement {
  return el('div', { class: 'card' }, [
    el('div', { class: 'card-label', text: label }),
    value,
    el('div', { class: 'card-basis' }, basis.map((part) => (typeof part === 'string' ? document.createTextNode(part) : part))),
  ]);
}

function valueNode(text: string, unit?: string, tone?: string): HTMLElement {
  return el('div', { class: tone ? `card-value ${tone}` : 'card-value' }, [
    document.createTextNode(text),
    unit ? el('small', { text: unit }) : null,
  ]);
}

interface TopProgression {
  name: string;
  pct: number;
  base: number;
  current: number;
}

/** Staerkste Progression der aktuellen Woche, oder `null`, wenn keine Uebung zulegt. */
function topProgression(): TopProgression | null {
  if (!state) return null;
  let top: TopProgression | null = null;
  for (const exercise of Object.values(state.exercises)) {
    const pct = progressionPct(exercise, state.currentWeek);
    if (pct === null || pct <= 0 || (top && pct <= top.pct)) continue;
    top = {
      name: exercise.name,
      pct,
      base: baselineLoad(exercise)!.load,
      current: usableLoad(exercise, state.currentWeek - 1)!,
    };
  }
  return top;
}

function renderCards(): void {
  const container = byId('t-cards');
  if (!container || !state) return;
  const top = topProgression();
  const topCard = top
    ? card('Stärkste Progression', valueNode(signed(top.pct, 0), '%', 'is-ok'), [
      el('b', { text: top.name }),
      ` ${plain(top.base)} → ${plain(top.current)} kg`,
    ])
    : el('div', { class: 'card' }, [
      el('div', { class: 'card-label', text: 'Stärkste Progression' }),
      el('div', { class: 'refusal', text: 'Keine Progression' }),
      el('div', { class: 'card-basis', text: 'keine Aussage' }),
    ]);

  container.replaceChildren(
    card('Aktuelle Woche', valueNode(String(state.currentWeek)), [`von ${state.weekCount} Wochen`]),
    card('Übungen', valueNode(String(Object.keys(state.exercises).length)), ['im Mesozyklus']),
    card('Volumen aktuelle Woche', valueNode(integer(weekVolume()), 'kg'), [`Woche ${state.currentWeek}`]),
    topCard,
  );
}

function renderVolumeChart(): void {
  if (!state) return;
  const { charts } = state;
  const weekLabels = Array.from({ length: state.currentWeek }, (_, i) => `W${i + 1}`);
  const groups = [...new Set(Object.values(state.exercises).map((e) => e.muscleGroup).filter(Boolean))].sort();

  const datasets = groups.map((group, index) => {
    const color = MUSCLE_COLORS[index % MUSCLE_COLORS.length]!;
    return {
      label: group,
      data: Array.from({ length: state!.currentWeek }, (_, weekIndex) => {
        let volume = 0;
        for (const exercise of Object.values(state!.exercises)) {
          if (exercise.muscleGroup !== group) continue;
          volume += volumeOf(exercise, weekIndex);
        }
        return Math.round(volume) || null;
      }),
      backgroundColor: `${color}bb`,
      borderColor: color,
      borderWidth: 1,
      borderRadius: 2,
    };
  });

  const options = charts.mutableOptions();
  options.scales.x.stacked = true;
  options.scales.y.stacked = true;
  options.plugins.legend = { display: true, labels: { color: COLORS.muted, font: { size: 10 }, boxWidth: 10, padding: 8 } };

  charts.upsert('t-volume-chart', { type: 'bar', data: { labels: weekLabels, datasets }, options });
}

function renderDayChips(days: string[]): void {
  const container = byId('t-days');
  if (!container) return;
  const choices = [{ value: '', text: 'Alle' }, ...days.map((day) => ({ value: day, text: dayLabel(day) }))];
  container.replaceChildren(...choices.map((choice) => {
    const chip = el('button', {
      class: 'chip',
      text: choice.text,
      attrs: { type: 'button', 'aria-pressed': String(choice.value === dayFilter) },
    });
    chip.addEventListener('click', () => {
      dayFilter = choice.value;
      renderDayChips(days);
      renderExerciseList();
    });
    return chip;
  }));
}

function visibleExercises(): Exercise[] {
  if (!state) return [];
  return Object.values(state.exercises)
    .filter((exercise) => !dayFilter || exercise.day === dayFilter)
    .sort((a, b) => (a.day || '').localeCompare(b.day || '') || a.name.localeCompare(b.name));
}

function renderProgression(): void {
  if (!state) return;
  const exercise = state.exercises[selectedKey];
  if (!exercise) return;
  const { charts } = state;

  setText('t-prog-title', exercise.name);

  const labels: string[] = [];
  const loads: (number | null)[] = [];
  const oneRepMax: (number | null)[] = [];

  for (let weekIndex = 0; weekIndex < state.currentWeek; weekIndex++) {
    const week = exercise.weeks[weekIndex];
    labels.push(`W${weekIndex + 1}`);
    const load = usableLoad(exercise, weekIndex);
    loads.push(load);
    const reps = avgRepsFromStr(week?.repsActual);
    oneRepMax.push(load && reps ? epley1RM(load, reps) : null);
  }

  {
    const options = charts.mutableOptions();
    options.plugins = {
      legend: { display: false },
      tooltip: {
        mode: 'index',
        intersect: false,
        callbacks: {
          afterBody: (items: { dataIndex: number }[]) => {
            const weekIndex = items[0]?.dataIndex;
            if (weekIndex === undefined) return [];
            const week = exercise.weeks[weekIndex];
            const lines: string[] = [];
            if (week?.sets) lines.push(`Saetze: ${week.sets}`);
            if (week?.repsActual) lines.push(`Reps: ${week.repsActual}`);
            const load = usableLoad(exercise, weekIndex);
            const reps = avgRepsFromStr(week?.repsActual);
            if (load && reps) lines.push(`1RM est.: ${epley1RM(load, reps)} kg`);
            if (week && week.loadRaw && week.loadRaw !== String(week.load)) {
              lines.push(`Eintrag: ${week.loadRaw}`);
            }
            if (week?.implausible) lines.push('Wert unplausibel, nicht verrechnet');
            if (week?.uncertain) lines.push('Bereichsangabe, Mittelwert verwendet');
            return lines;
          },
        },
      },
    };

    charts.upsert('t-prog-chart', {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Load (kg)',
          data: loads,
          borderColor: COLORS.accent,
          backgroundColor: withAlpha(COLORS.accent, AREA_ALPHA),
          borderWidth: 2.5,
          pointRadius: 5,
          pointHoverRadius: 8,
          fill: true,
          tension: 0.3,
          spanGaps: true,
        }],
      },
      options,
    });
  }

  {
    charts.upsert('t-1rm-chart', {
      type: 'line',
      data: {
        labels,
        datasets: [{
          data: oneRepMax,
          borderColor: COLORS.ink,
          backgroundColor: withAlpha(COLORS.ink, AREA_ALPHA),
          borderWidth: 2,
          pointRadius: 4,
          fill: true,
          tension: 0.3,
          spanGaps: true,
        }],
      },
      options: charts.mutableOptions(),
    });
  }
}

function exerciseRow(exercise: Exercise): HTMLElement {
  const base = baselineLoad(exercise);
  const current = usableLoad(exercise, state!.currentWeek - 1);
  const delta = progressionPct(exercise, state!.currentWeek);

  const tone = delta === null ? '' : delta > PROGRESSION_THRESHOLD_PCT ? ' is-ok' : delta < -PROGRESSION_THRESHOLD_PCT ? ' is-off' : '';
  const sub = [exercise.muscleGroup, exercise.day ? dayLabel(exercise.day) : ''].filter(Boolean).join(' · ');
  const range = base && current !== null ? `${plain(base.load)} → ${plain(current)} kg` : '';

  const row = el('button', {
    class: 't-row',
    attrs: { type: 'button', 'aria-current': String(exercise.key === selectedKey) },
  }, [
    el('span', { class: 't-main' }, [
      el('span', { class: 't-name', text: exercise.name }),
      el('span', { class: 't-sub', text: sub }),
    ]),
    el('span', { class: 't-side' }, [
      el('span', { class: `t-delta${tone}`, text: delta === null ? EMPTY : `${signed(delta, 0)}%` }),
      el('span', { class: 'card-basis', text: range }),
    ]),
  ]);
  row.addEventListener('click', () => {
    selectedKey = exercise.key;
    renderExerciseList();
  });
  return row;
}

function renderExerciseList(): void {
  const list = byId('t-list');
  if (!list || !state) return;
  const entries = visibleExercises();
  if (!entries.some((exercise) => exercise.key === selectedKey)) selectedKey = entries[0]?.key ?? '';

  list.replaceChildren(...entries.map(exerciseRow));
  renderProgression();
}
