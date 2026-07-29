import type { Exercise, ParsedTraining } from '../types';
import { avgRepsFromStr, epley1RM } from '../analytics/strength';
import { mutableOptions, upsert } from '../charts/base';
import { baselineLoad, usableLoad } from '../parse/training';
import { byId, COLORS, setText, show } from './dom';

const MUSCLE_COLORS = [
  '#38bdf8', '#f59e0b', '#4ade80', '#f87171', '#c084fc', '#818cf8', '#fb923c',
  '#34d399', '#fbbf24', '#60a5fa', '#e879f9', '#a3e635', '#94a3b8', '#f472b6',
] as const;

/** Rueckfallwerte, wenn Saetze oder Wiederholungen fehlen, fuer die Volumenrechnung. */
const FALLBACK_SETS = 3;
const FALLBACK_REPS = 8;

/** Ab dieser prozentualen Veraenderung gilt eine Progression als Fortschritt. */
const PROGRESSION_THRESHOLD_PCT = 1;

/** Maximale Laenge des Uebungsnamens in der Kennzahlkachel. */
const TOP_NAME_MAX = 22;
const TOP_NAME_CUT = 20;

interface State {
  exercises: Record<string, Exercise>;
  weekCount: number;
  currentWeek: number;
}

let state: State | null = null;

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

export function renderTraining(parsed: ParsedTraining | null): void {
  if (!parsed || !Object.keys(parsed.exercises).length) {
    show('t-no-data', true);
    show('t-content', false);
    state = null;
    return;
  }

  show('t-no-data', false);
  show('t-content', true);
  state = { exercises: parsed.exercises, weekCount: parsed.weekCount, currentWeek: parsed.currentWeek };

  setText('t-current-week', String(state.currentWeek));
  setText('t-exercise-count', String(Object.keys(state.exercises).length));
  // PHASE 2: Wochenzahl aus dem Sheet statt der verdrahteten 12.
  setText('t-week-count', `von ${state.weekCount} Wochen`);

  renderVolumeKpi();
  renderTopProgression();
  renderVolumeChart();
  populateDaySelect();
  populateExerciseSelect('');
  renderProgression();
  renderExerciseTable();
}

function renderVolumeKpi(): void {
  if (!state) return;
  let total = 0;
  for (const exercise of Object.values(state.exercises)) {
    total += volumeOf(exercise, state.currentWeek - 1);
  }
  setText('t-volume-current', Math.round(total).toLocaleString('de'));
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

function renderTopProgression(): void {
  if (!state) return;
  let topName = '–';
  let topPct = -Infinity;
  let topSub = '–';

  for (const exercise of Object.values(state.exercises)) {
    const pct = progressionPct(exercise, state.currentWeek);
    if (pct === null) continue;
    if (pct > topPct) {
      const base = baselineLoad(exercise)!;
      const current = usableLoad(exercise, state.currentWeek - 1)!;
      topPct = pct;
      topName = exercise.name;
      topSub = `+${pct.toFixed(0)}% (${base.load}→${current} kg)`;
    }
  }

  const element = byId('t-top-prog');
  if (element) {
    element.textContent = topName.length > TOP_NAME_MAX ? `${topName.substring(0, TOP_NAME_CUT)}…` : topName;
    element.title = topName;
  }
  setText('t-top-prog-sub', topPct > 0 ? topSub : '–');
}

function renderVolumeChart(): void {
  if (!state) return;
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

  const options = mutableOptions();
  options.scales.x.stacked = true;
  options.scales.y.stacked = true;
  options.plugins.legend = { display: true, labels: { color: '#94a3b8', font: { size: 10 }, boxWidth: 10, padding: 8 } };

  upsert('t-volume-chart', { type: 'bar', data: { labels: weekLabels, datasets }, options });
}

function populateDaySelect(): void {
  const select = byId<HTMLSelectElement>('t-day-select');
  if (!select || !state) return;
  const days = [...new Set(Object.values(state.exercises).map((e) => e.day).filter(Boolean))].sort();

  const options = [new Option('Alle Tage', '')];
  for (const day of days) options.push(new Option(day, day));
  select.replaceChildren(...options);
}

function populateExerciseSelect(dayFilter: string): void {
  const select = byId<HTMLSelectElement>('t-exercise-select');
  if (!select || !state) return;

  const previous = select.value;
  const entries = Object.values(state.exercises)
    .filter((exercise) => !dayFilter || exercise.day === dayFilter)
    .sort((a, b) => a.name.localeCompare(b.name));

  // Wert ist der Schluessel aus Tag und Name, damit gleichnamige Uebungen an
  // verschiedenen Tagen unterscheidbar bleiben.
  select.replaceChildren(...entries.map((exercise) => new Option(
    dayFilter ? exercise.name : `${exercise.name} · ${exercise.day.replace('Day ', 'D')}`,
    exercise.key,
    false,
    exercise.key === previous,
  )));
}

export function filterTrainingDay(): void {
  const select = byId<HTMLSelectElement>('t-day-select');
  populateExerciseSelect(select?.value ?? '');
  renderProgression();
  renderExerciseTable();
}

export function renderProgression(): void {
  if (!state) return;
  const key = byId<HTMLSelectElement>('t-exercise-select')?.value;
  if (!key) return;
  const exercise = state.exercises[key];
  if (!exercise) return;

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
    const options = mutableOptions();
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

    upsert('t-prog-chart', {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Load (kg)',
          data: loads,
          borderColor: COLORS.accent,
          backgroundColor: `${COLORS.accent}25`,
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
    upsert('t-1rm-chart', {
      type: 'line',
      data: {
        labels,
        datasets: [{
          data: oneRepMax,
          borderColor: COLORS.indigo,
          backgroundColor: `${COLORS.indigo}25`,
          borderWidth: 2,
          pointRadius: 4,
          fill: true,
          tension: 0.3,
          spanGaps: true,
        }],
      },
      options: mutableOptions(),
    });
  }
}

function progressionBadge(delta: number | null): HTMLElement {
  if (delta === null) {
    const dash = document.createElement('span');
    dash.style.color = COLORS.dim;
    dash.textContent = '–';
    return dash;
  }
  const badge = document.createElement('span');
  const kind = delta > PROGRESSION_THRESHOLD_PCT ? 'pos' : delta < -PROGRESSION_THRESHOLD_PCT ? 'neg' : 'neu';
  badge.className = `t-badge t-badge-${kind}`;
  badge.textContent = `${delta > 0 ? '+' : ''}${delta.toFixed(0)}%`;
  return badge;
}

function textCell(text: string, style = ''): HTMLTableCellElement {
  const td = document.createElement('td');
  if (style) td.style.cssText = style;
  td.textContent = text;
  return td;
}

export function renderExerciseTable(): void {
  if (!state) return;
  const body = byId<HTMLTableSectionElement>('t-table-body');
  if (!body) return;

  const dayFilter = byId<HTMLSelectElement>('t-day-select')?.value ?? '';
  const entries = Object.values(state.exercises)
    .filter((exercise) => !dayFilter || exercise.day === dayFilter)
    .sort((a, b) => (a.day || '').localeCompare(b.day || '') || a.name.localeCompare(b.name));

  const rows = entries.map((exercise) => {
    const base = baselineLoad(exercise);
    const current = usableLoad(exercise, state!.currentWeek - 1);
    const delta = progressionPct(exercise, state!.currentWeek);

    const tr = document.createElement('tr');
    tr.append(
      textCell(exercise.name, 'font-weight:500;max-width:200px;overflow:hidden;text-overflow:ellipsis'),
      textCell(exercise.muscleGroup, `color:${COLORS.muted}`),
      textCell((exercise.day || '').replace('Day ', 'D'), `color:${COLORS.muted};font-size:11px`),
      textCell(base ? `${base.load} kg` : '–', 'color:#94a3b8'),
      textCell(current !== null ? `${current} kg` : '–', `font-weight:600;color:${COLORS.accent}`),
    );

    const badgeCell = document.createElement('td');
    badgeCell.append(progressionBadge(delta));
    tr.append(badgeCell);

    tr.addEventListener('click', () => {
      const select = byId<HTMLSelectElement>('t-exercise-select');
      if (select) {
        select.value = exercise.key;
        renderProgression();
      }
    });

    return tr;
  });

  body.replaceChildren(...rows);
}
