import type { Exercise, ParsedTraining } from '../types';
import { avgRepsFromStr, epley1RM } from '../analytics/strength';
import { baseOptions, Chart, destroyChart, register } from '../charts/base';
import { GOALS } from '../config/goals';
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

function loadOf(exercise: Exercise, weekIndex: number): number | null {
  return exercise.weeks[weekIndex]?.load ?? null;
}

function volumeOf(exercise: Exercise, weekIndex: number): number {
  const week = exercise.weeks[weekIndex];
  if (!week?.load) return 0;
  return (week.sets || FALLBACK_SETS) * (avgRepsFromStr(week.repsActual) ?? FALLBACK_REPS) * week.load;
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
  const weeksLabel = byId('t-week-count');
  if (weeksLabel) weeksLabel.textContent = `von ${GOALS.mesocycleWeeks} Wochen`;

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

function renderTopProgression(): void {
  if (!state) return;
  let topName = '–';
  let topPct = -Infinity;
  let topSub = '–';

  for (const [name, exercise] of Object.entries(state.exercises)) {
    const first = loadOf(exercise, 0);
    const current = loadOf(exercise, state.currentWeek - 1);
    if (!first || !current) continue;
    const pct = ((current - first) / first) * 100;
    if (pct > topPct) {
      topPct = pct;
      topName = name;
      topSub = `+${pct.toFixed(0)}% (${first}→${current} kg)`;
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

  destroyChart('t-volume-chart');
  const element = byId('t-volume-chart');
  if (!(element instanceof HTMLCanvasElement)) return;

  const options = baseOptions() as any;
  options.scales.x.stacked = true;
  options.scales.y.stacked = true;
  options.plugins.legend = { display: true, labels: { color: '#94a3b8', font: { size: 10 }, boxWidth: 10, padding: 8 } };

  register('t-volume-chart', new Chart(element, { type: 'bar', data: { labels: weekLabels, datasets }, options }));
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
  const names = Object.entries(state.exercises)
    .filter(([, exercise]) => !dayFilter || exercise.day === dayFilter)
    .map(([name]) => name)
    .sort();

  select.replaceChildren(...names.map((name) => new Option(name, name, false, name === previous)));
}

export function filterTrainingDay(): void {
  const select = byId<HTMLSelectElement>('t-day-select');
  populateExerciseSelect(select?.value ?? '');
  renderProgression();
  renderExerciseTable();
}

export function renderProgression(): void {
  if (!state) return;
  const name = byId<HTMLSelectElement>('t-exercise-select')?.value;
  if (!name) return;
  const exercise = state.exercises[name];
  if (!exercise) return;

  setText('t-prog-title', name);

  const labels: string[] = [];
  const loads: (number | null)[] = [];
  const oneRepMax: (number | null)[] = [];

  for (let weekIndex = 0; weekIndex < state.currentWeek; weekIndex++) {
    const week = exercise.weeks[weekIndex];
    labels.push(`W${weekIndex + 1}`);
    loads.push(week?.load ?? null);
    const reps = avgRepsFromStr(week?.repsActual);
    oneRepMax.push(week?.load && reps ? epley1RM(week.load, reps) : null);
  }

  destroyChart('t-prog-chart');
  const progressionCanvas = byId('t-prog-chart');
  if (progressionCanvas instanceof HTMLCanvasElement) {
    const options = baseOptions() as any;
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
            const reps = avgRepsFromStr(week?.repsActual);
            if (week?.load && reps) lines.push(`1RM est.: ${epley1RM(week.load, reps)} kg`);
            return lines;
          },
        },
      },
    };

    register('t-prog-chart', new Chart(progressionCanvas, {
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
    }));
  }

  destroyChart('t-1rm-chart');
  const oneRmCanvas = byId('t-1rm-chart');
  if (oneRmCanvas instanceof HTMLCanvasElement) {
    register('t-1rm-chart', new Chart(oneRmCanvas, {
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
      options: baseOptions() as any,
    }));
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
  const entries = Object.entries(state.exercises)
    .filter(([, exercise]) => !dayFilter || exercise.day === dayFilter)
    .sort((a, b) => (a[1].day || '').localeCompare(b[1].day || '') || a[0].localeCompare(b[0]));

  const rows = entries.map(([name, exercise]) => {
    const first = loadOf(exercise, 0);
    const current = loadOf(exercise, state!.currentWeek - 1);
    const delta = first && current ? ((current - first) / first) * 100 : null;

    const tr = document.createElement('tr');
    tr.append(
      textCell(name, 'font-weight:500;max-width:200px;overflow:hidden;text-overflow:ellipsis'),
      textCell(exercise.muscleGroup, `color:${COLORS.muted}`),
      textCell((exercise.day || '').replace('Day ', 'D'), `color:${COLORS.muted};font-size:11px`),
      textCell(first !== null ? `${first} kg` : '–', 'color:#94a3b8'),
      textCell(current !== null ? `${current} kg` : '–', `font-weight:600;color:${COLORS.accent}`),
    );

    const badgeCell = document.createElement('td');
    badgeCell.append(progressionBadge(delta));
    tr.append(badgeCell);

    tr.addEventListener('click', () => {
      const select = byId<HTMLSelectElement>('t-exercise-select');
      if (select) {
        select.value = name;
        renderProgression();
      }
    });

    return tr;
  });

  body.replaceChildren(...rows);
}
