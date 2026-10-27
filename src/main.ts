import './styles.css';

import type { DailyEntry, ParsedTraining, SheetValues, WeekBlock } from './types';
import { parseDaily } from './parse/daily';
import { parseTraining } from './parse/training';
import { parseGoals, type Goals } from './parse/goals';
import { MissingColumnsError } from './parse/columns';
import { fetchDailySheet, fetchSheetTitles, fetchTrainingSheet } from './sheets';
import {
  DEFAULT_DAILY_SHEET,
  DEFAULT_TRAINING_SHEET,
  getCredentials,
  hasCredentials,
  loadCache,
  saveCache,
  saveCredentials,
  type Credentials,
} from './config/credentials';
import { getTargets, saveTargets } from './config/targets';
import { loadApiKey, saveApiKey } from './generator/state';
import { byId, show } from './ui/dom';
import { renderDashboard, type SectionRenderers } from './ui/dashboard';
import { renderAnalysis } from './ui/analysis';
import { renderHero } from './ui/hero';
import { renderCoach } from './ui/coach';
import { renderMetrics } from './ui/metrics';
import type { WeightMode } from './charts/weight';
import { renderTraining } from './ui/training';
import { closeSettings, currentRoute, navigate, openSettings, setCanLog, setHasSheet, setupRangeButtons, setupShell } from './ui/shell';
import { getLogAccess, isValidEndpoint, saveLogAccess } from './config/logAccess';
import { kuecheRouteFor, planViewFor, sectionFor, type Route } from './ui/router';
import { onPlanViewChange, renderPlan, setPlanView } from './ui/plan';
import { renderShopping } from './ui/shopping';
import { onPlanSourceChange } from './ui/planSource';
import { sheetDayGoals } from './nutrition/goals';
import { attachChartExports, downloadCsv } from './ui/export';
import { loadCharts, loadedCharts, type Charts } from './ui/charts';

/**
 * Ladepolitik.
 *
 * Kein Intervall mehr. Die Daten aendern sich einmal am Tag, alles dazwischen
 * war Flackern ohne Informationsgewinn. Geladen wird beim Oeffnen, auf Knopfdruck
 * und bei Rueckkehr auf den Tab, letzteres nur wenn der letzte Abruf laenger als
 * die Sperre zurueckliegt.
 */
const REFRESH_LOCK_MS = 15 * 60 * 1000;

/** Wie oft die Altersangabe der Daten neu geschrieben wird. Ohne Netzzugriff. */
const AGE_TICK_MS = 60 * 1000;

const MS_PER_DAY = 864e5;

const SECTION_NAMES = ['overview', 'nutrition', 'wellness', 'weeks', 'training', 'log', 'analysis', 'plan', 'shopping'] as const;

let allDaily: DailyEntry[] = [];
let allWeekBlocks: WeekBlock[] = [];
let goals: Goals | null = null;
let training: ParsedTraining | null = null;
/** Rohzeilen des Mesocycle Tabs, das Segment `Eintragen` liest sie selbst. */
let trainingRows: SheetValues = [];
let sections: SectionRenderers | null = null;
let dateRangeDays = 0;
let weightMode: WeightMode = 'weight';

let lastFetchAt = 0;
let dataTimestamp: number | null = null;
let dataFromCache = false;
let statusSuffix = '';

const dirty = new Set<string>(['plan', 'shopping']);

function input(id: string): HTMLInputElement | null {
  return byId<HTMLInputElement>(id);
}

// ── Konfiguration ────────────────────────────────────────────────────────────

function showConfig(): void {
  const credentials = getCredentials();
  const set = (id: string, value: string): void => {
    const element = input(id);
    if (element) element.value = value;
  };
  set('input-sheet-id', credentials.sheetId ?? '');
  set('input-api-key', credentials.apiKey ?? '');
  set('input-sheet-name', credentials.sheetName ?? DEFAULT_DAILY_SHEET);
  set('input-training-sheet-name', credentials.trainingSheetName ?? DEFAULT_TRAINING_SHEET);
  set('input-anthropic-key', loadApiKey() ?? '');
  const target = getTargets().targetWeightKg;
  set('input-target-weight', target === null ? '' : String(target));
  const access = getLogAccess();
  set('input-log-endpoint', access?.endpoint ?? '');
  set('input-log-token', access?.token ?? '');
  openSettings();
  input('input-sheet-id')?.focus();
}

function handleSaveConfig(): void {
  const credentials: Credentials = {
    sheetId: input('input-sheet-id')?.value.trim() ?? '',
    apiKey: input('input-api-key')?.value.trim() ?? '',
    sheetName: input('input-sheet-name')?.value.trim() || DEFAULT_DAILY_SHEET,
    trainingSheetName: input('input-training-sheet-name')?.value.trim() || DEFAULT_TRAINING_SHEET,
  };
  if (!credentials.sheetId || !credentials.apiKey) {
    alert('Bitte Sheet ID und API Key eingeben.');
    return;
  }

  // Zielgewicht ist optional und steht nirgends im Sheet. Leer heisst: keine Projektion.
  const rawTarget = input('input-target-weight')?.value.trim() ?? '';
  const parsedTarget = rawTarget === '' ? null : Number(rawTarget.replace(',', '.'));
  if (parsedTarget !== null && !Number.isFinite(parsedTarget)) {
    alert('Zielgewicht muss eine Zahl sein.');
    return;
  }

  // Training eintragen: beide oder keins, und nur an eine Apps Script Adresse.
  const logEndpoint = input('input-log-endpoint')?.value.trim() ?? '';
  const logToken = input('input-log-token')?.value.trim() ?? '';
  if (Boolean(logEndpoint) !== Boolean(logToken) || (logEndpoint && !isValidEndpoint(logEndpoint))) {
    alert('Apps Script URL (https://script.google.com/…) und Token gehören zusammen.');
    return;
  }

  saveCredentials(credentials);
  saveTargets({ targetWeightKg: parsedTarget });
  // Eigener Schluessel, getrennt von den Google Zugangsdaten. Leer entfernt ihn.
  saveApiKey(input('input-anthropic-key')?.value ?? null);
  saveLogAccess(logEndpoint, logToken);
  dirty.add('log');
  setCanLog(getLogAccess() !== null);
  closeSettings();
  if (goals) renderShared();
  void loadData(true);
}

// ── Status ───────────────────────────────────────────────────────────────────

/**
 * Ohne Sheet Daten (keine Zugangsdaten, Abruf gescheitert, kein Cache) bleibt
 * die Kueche nutzbar, die anderen Ziele sind ausgeblendet. Der Hash bleibt
 * stehen, mit den Daten kehrt das gewuenschte Ziel zurueck, siehe `resolveRoute`.
 */
function enterStandaloneMode(): void {
  document.body.classList.add('no-sheet');
  show('dashboard', true);
  setHasSheet(false);
}

function leaveStandaloneMode(): void {
  document.body.classList.remove('no-sheet');
  setHasSheet(true);
}

function showError(message: string): void {
  const status = byId('status');
  if (status) {
    const paragraph = document.createElement('p');
    paragraph.className = 'err';
    paragraph.textContent = message;

    const button = document.createElement('button');
    button.className = 'btn';
    button.style.marginTop = '12px';
    button.textContent = 'Konfiguration';
    button.addEventListener('click', showConfig);

    status.replaceChildren(paragraph, button);
    status.style.display = 'block';
  }
  enterStandaloneMode();
}

function showSpinner(text: string): void {
  const status = byId('status');
  if (!status) return;
  const spinner = document.createElement('div');
  spinner.className = 'spinner';
  const paragraph = document.createElement('p');
  paragraph.textContent = text;
  status.replaceChildren(spinner, paragraph);
  status.style.display = 'block';
}

/** Alter der angezeigten Daten, damit nie unklar ist, was gerade zu sehen ist. */
function updateDataAge(): void {
  const element = byId('last-updated');
  if (!element) return;
  if (dataTimestamp === null) {
    element.textContent = statusSuffix;
    return;
  }

  const minutes = Math.floor((Date.now() - dataTimestamp) / 60000);
  const age = minutes < 1 ? 'gerade eben'
    : minutes < 60 ? `vor ${minutes} min`
    : minutes < 60 * 24 ? `vor ${Math.floor(minutes / 60)} h`
    : `vor ${Math.floor(minutes / (60 * 24))} Tagen`;

  const clock = new Date(dataTimestamp).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  element.textContent = `${dataFromCache ? 'Cache' : 'Sheet'} · ${clock} Uhr · ${age}${statusSuffix}`;
}

// ── Zeitraum und Abschnitte ──────────────────────────────────────────────────

function cutoffDate(): Date | null {
  return dateRangeDays > 0 ? new Date(Date.now() - dateRangeDays * MS_PER_DAY) : null;
}

function filteredDaily(): DailyEntry[] {
  const cutoff = cutoffDate();
  if (!cutoff) return allDaily;
  return allDaily.filter((r) => r.dateObj && r.dateObj >= cutoff);
}

/**
 * Der Zeitraumfilter wirkt auch auf die Wochenansicht. Ein Block zaehlt dazu,
 * wenn sein letzter Tag im Zeitraum liegt.
 */
function filteredWeekBlocks(): WeekBlock[] {
  const cutoff = cutoffDate();
  if (!cutoff) return allWeekBlocks;
  return allWeekBlocks.filter((block) => {
    const last = block.rows[block.rows.length - 1]?.dateObj;
    return last ? last >= cutoff : false;
  });
}

function markAllDirty(): void {
  for (const name of SECTION_NAMES) dirty.add(name);
}

/** Abschnitte mit Diagrammen. Sie warten auf den Chunk `charts`, alle anderen zeichnen sofort. */
const CHART_SECTIONS: ReadonlySet<string> = new Set(['overview', 'nutrition', 'wellness', 'weeks', 'training']);

function chartRendererFor(name: string): ((charts: Charts) => void) | undefined {
  if (name === 'training') return (charts) => renderTraining(training, charts);
  return sections?.[name];
}

function rendererFor(name: string): (() => void) | undefined {
  if (name === 'analysis') return renderAnalysisTab;
  if (name === 'plan') return () => renderPlan(sheetDayGoals(goals));
  if (name === 'shopping') return () => renderShopping(sheetDayGoals(goals));
  return undefined;
}

function activeSection(): string | null {
  const route = currentRoute();
  return route ? sectionFor(route) : null;
}

/** Zeichnet den sichtbaren Abschnitt, falls seine Daten sich geaendert haben. */
function renderActiveSection(): void {
  const name = activeSection();
  if (!name) return;
  if (CHART_SECTIONS.has(name)) {
    void renderChartSection(name);
    return;
  }
  if (name === 'log') {
    void renderLogSection();
    return;
  }
  if (dirty.has(name)) {
    rendererFor(name)?.();
    dirty.delete(name);
  }
}

/**
 * Wie `renderActiveSection`, nach dem Laden des Chunks `charts`. Scheitert der
 * Abruf, bleibt der Abschnitt markiert und der naechste Aufruf versucht es neu.
 */
async function renderChartSection(name: string): Promise<void> {
  let charts: Charts;
  try {
    charts = await loadCharts();
  } catch (error) {
    statusSuffix = ` · Diagramme nicht geladen: ${describe(error)}`;
    updateDataAge();
    return;
  }
  // Waehrend des Ladens kann die Route gewechselt haben.
  if (activeSection() !== name) return;
  if (dirty.has(name)) {
    chartRendererFor(name)?.(charts);
    dirty.delete(name);
  }
  // Nach dem Einblenden nachmessen, siehe resizeVisibleCharts.
  requestAnimationFrame(charts.resizeVisibleCharts);
}

/**
 * Segment `Eintragen` als Chunk `log`. Wie bei den Diagrammen bleibt der
 * Abschnitt markiert, wenn der Abruf scheitert.
 */
async function renderLogSection(): Promise<void> {
  const container = byId('log');
  const access = getLogAccess();
  if (!container || !access || !dirty.has('log')) return;
  let log: typeof import('./log/index');
  try {
    log = await import('./log/index');
  } catch (error) {
    statusSuffix = ` · Eintragen nicht geladen: ${describe(error)}`;
    updateDataAge();
    return;
  }
  if (activeSection() !== 'log') return;
  const credentials = getCredentials();
  if (!hasCredentials(credentials)) return;
  log.renderLog(container, {
    analysisSheet: credentials.trainingSheetName || DEFAULT_TRAINING_SHEET,
    analysisRows: trainingRows,
    access,
    loadTitles: () => fetchSheetTitles(credentials.sheetId, credentials.apiKey),
    loadRows: (sheet) => fetchTrainingSheet(credentials.sheetId, credentials.apiKey, sheet),
    reload: () => loadData(true),
  });
  dirty.delete('log');
}

/**
 * Die Analytik rechnet immer ueber den gesamten Zeitraum, nie ueber die Auswahl
 * der Zeitraumknoepfe. Ein Filter auf 14 Tage wuerde das 28 und das 56 Tage
 * Fenster des Erhaltungsbedarfs unmoeglich machen.
 */
function renderAnalysisTab(): void {
  if (!goals) return;
  renderAnalysis(allDaily, goals, getTargets().targetWeightKg);
  renderCoach(allDaily, goals);
  renderMetrics(allDaily, goals);
}

function applyDateRange(days: number): void {
  dateRangeDays = days;
  renderShared();
}

/**
 * Kopf, Heute und die Diagrammabschnitte.
 *
 * Heute rechnet ueber den gesamten Bestand, die Diagramme folgen dem
 * Zeitraumfilter. Coaching und Tagesdurchschnitt stehen in `Analyse`.
 */
function renderShared(): void {
  if (!goals) return;
  const targetWeightKg = getTargets().targetWeightKg;

  renderHero({ daily: allDaily, goals });

  sections = renderDashboard({
    daily: filteredDaily(),
    weekBlocks: filteredWeekBlocks(),
    goals,
    weightMode,
    targetWeightKg,
    onError: showError,
  });

  markAllDirty();
  renderActiveSection();
}

/** Umschalter ueber dem Gewichtsverlauf. Zeichnet nur diesen Abschnitt neu. */
function setWeightMode(mode: WeightMode): void {
  weightMode = mode;
  for (const button of document.querySelectorAll<HTMLButtonElement>('.chip[data-mode]')) {
    button.setAttribute('aria-pressed', String(button.dataset['mode'] === mode));
  }
  if (!goals) return;
  sections = renderDashboard({
    daily: filteredDaily(),
    weekBlocks: filteredWeekBlocks(),
    goals,
    weightMode,
    targetWeightKg: getTargets().targetWeightKg,
    onError: showError,
  });
  dirty.add('overview');
  renderActiveSection();
}

function applyParsed(raw: SheetValues, rawTraining: SheetValues, timestamp: number, fromCache: boolean): void {
  const parsed = parseDaily(raw);
  allDaily = parsed.daily;
  allWeekBlocks = parsed.weekBlocks;
  goals = parseGoals(raw, rawTraining);
  training = rawTraining.length ? parseTraining(rawTraining) : null;
  trainingRows = rawTraining;
  dataTimestamp = timestamp;
  dataFromCache = fromCache;

  show('status', false);
  show('dashboard', true);
  leaveStandaloneMode();
  renderShared();
  updateDataAge();
}

function describe(error: unknown): string {
  if (error instanceof MissingColumnsError) {
    return `${error.message}. Die Kopfzeile im Sheet hat sich geaendert.`;
  }
  return error instanceof Error ? error.message : String(error);
}

// ── Laden ────────────────────────────────────────────────────────────────────

export async function loadData(force = false): Promise<void> {
  const credentials = getCredentials();
  if (!hasCredentials(credentials)) {
    showConfig();
    show('status', false);
    enterStandaloneMode();
    return;
  }

  if (!force && Date.now() - lastFetchAt < REFRESH_LOCK_MS) return;

  if (dataTimestamp === null) {
    const cache = loadCache();
    if (cache) {
      try {
        statusSuffix = ' · aktualisiere';
        applyParsed(cache.raw, cache.rawTraining, cache.ts, true);
      } catch {
        // Ein unlesbarer Cache darf den frischen Abruf nicht verhindern.
      }
    } else {
      showSpinner('Lade Daten von Google Sheets…');
      show('dashboard', false);
    }
  }

  lastFetchAt = Date.now();
  try {
    const [raw, rawTraining] = await Promise.all([
      fetchDailySheet(credentials.sheetId, credentials.apiKey, credentials.sheetName || DEFAULT_DAILY_SHEET),
      fetchTrainingSheet(credentials.sheetId, credentials.apiKey, credentials.trainingSheetName || DEFAULT_TRAINING_SHEET)
        .catch((error: unknown) => {
          console.warn('Training fetch:', describe(error));
          return [] as SheetValues;
        }),
    ]);
    saveCache(raw, rawTraining);
    statusSuffix = '';
    applyParsed(raw, rawTraining, Date.now(), false);
  } catch (error) {
    if (dataTimestamp === null) {
      showError(describe(error));
    } else {
      statusSuffix = ` · Abruf fehlgeschlagen: ${describe(error)}`;
      updateDataAge();
    }
  }
}

// ── Verdrahtung ──────────────────────────────────────────────────────────────

/** Jede Route, ob per Tipp, Zurueck Geste oder Neuladen. */
function showRoute(route: Route): void {
  const view = planViewFor(route);
  if (view && setPlanView(view)) dirty.add('plan');
  renderActiveSection();
}

function wire(): void {
  byId('btn-save-config')?.addEventListener('click', handleSaveConfig);
  byId('btn-cancel-config')?.addEventListener('click', closeSettings);
  byId('btn-close-settings')?.addEventListener('click', closeSettings);
  byId('btn-refresh')?.addEventListener('click', () => void loadData(true));
  byId('btn-config')?.addEventListener('click', showConfig);
  byId('btn-export-csv')?.addEventListener('click', () => downloadCsv(filteredDaily()));

  for (const button of document.querySelectorAll<HTMLButtonElement>('.chip[data-mode]')) {
    button.addEventListener('click', () => setWeightMode((button.dataset['mode'] ?? 'weight') as WeightMode));
  }

  setupShell(showRoute, hasCredentials(getCredentials()), getLogAccess() !== null);
  // Der Plan wechselt nach einer Uebernahme selbst auf Woche, der Hash zieht nach.
  onPlanViewChange((view) => navigate(kuecheRouteFor(view)));
  setupRangeButtons(applyDateRange);
  // Ein Wechsel der Planquelle passiert im Reiter Plan, der Einkauf zeichnet beim naechsten Oeffnen neu.
  onPlanSourceChange(() => dirty.add('shopping'));
  attachChartExports();

  // Diagrammfarben folgen dem Schema, ein Wechsel zeichnet die sichtbaren Diagramme neu.
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    loadedCharts()?.destroyAllCharts();
    for (const name of CHART_SECTIONS) dirty.add(name);
    renderActiveSection();
  });

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) void loadData();
  });

  window.setInterval(updateDataAge, AGE_TICK_MS);
}

wire();
void loadData(true);
