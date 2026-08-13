import './styles.css';

import type { DailyEntry, ParsedTraining, SheetValues, WeekBlock } from './types';
import { parseDaily } from './parse/daily';
import { parseTraining } from './parse/training';
import { parseGoals, type Goals } from './parse/goals';
import { MissingColumnsError } from './parse/columns';
import { fetchDailySheet, fetchTrainingSheet } from './sheets';
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
import { byId, show } from './ui/dom';
import { renderDashboard, type SectionRenderers } from './ui/dashboard';
import { renderAnalysis } from './ui/analysis';
import { renderHero } from './ui/hero';
import { renderCoach } from './ui/coach';
import { renderMetrics } from './ui/metrics';
import type { WeightMode } from './charts/weight';
import { filterTrainingDay, renderProgression, renderTraining } from './ui/training';
import { activeTab, setupRangeButtons, setupTabs } from './ui/tabs';
import { attachChartExports, downloadCsv } from './ui/export';
import { resizeVisibleCharts } from './charts/base';

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

const SECTION_NAMES = ['overview', 'nutrition', 'wellness', 'weeks', 'training', 'analysis'] as const;

let allDaily: DailyEntry[] = [];
let allWeekBlocks: WeekBlock[] = [];
let goals: Goals | null = null;
let training: ParsedTraining | null = null;
let sections: SectionRenderers | null = null;
let dateRangeDays = 0;
let weightMode: WeightMode = 'weight';

let lastFetchAt = 0;
let dataTimestamp: number | null = null;
let dataFromCache = false;
let statusSuffix = '';

const dirty = new Set<string>();

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
  const target = getTargets().targetWeightKg;
  set('input-target-weight', target === null ? '' : String(target));
  show('config-banner', true);
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

  saveCredentials(credentials);
  saveTargets({ targetWeightKg: parsedTarget });
  show('config-banner', false);
  if (goals) renderShared();
  void loadData(true);
}

// ── Status ───────────────────────────────────────────────────────────────────

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
  show('dashboard', false);
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

function rendererFor(name: string): (() => void) | undefined {
  if (name === 'training') return () => renderTraining(training);
  if (name === 'analysis') return renderAnalysisTab;
  return sections?.[name];
}

/** Zeichnet den sichtbaren Abschnitt, falls seine Daten sich geaendert haben. */
function renderActiveSection(): void {
  const name = activeTab();
  if (!name) return;
  if (dirty.has(name)) {
    rendererFor(name)?.();
    dirty.delete(name);
  }
  // Nach dem Einblenden nachmessen, siehe resizeVisibleCharts.
  requestAnimationFrame(resizeVisibleCharts);
}

/**
 * Die Analytik rechnet immer ueber den gesamten Zeitraum, nie ueber die Auswahl
 * der Zeitraumknoepfe. Ein Filter auf 14 Tage wuerde das 28 und das 56 Tage
 * Fenster des Erhaltungsbedarfs unmoeglich machen.
 */
function renderAnalysisTab(): void {
  if (!goals) return;
  renderAnalysis(allDaily, goals, getTargets().targetWeightKg);
}

function applyDateRange(days: number): void {
  dateRangeDays = days;
  renderShared();
}

/**
 * Kopf, Hero, Coaching und sekundaere Kennzahlen.
 *
 * Hero, Coaching und Kennzahlen rechnen ueber den gesamten Bestand, weil ihre
 * Aussagen Fenster von bis zu 56 Tagen brauchen. Die Diagramme folgen dem
 * Zeitraumfilter.
 */
function renderShared(): void {
  if (!goals) return;
  const targetWeightKg = getTargets().targetWeightKg;

  renderHero({ daily: allDaily, goals, targetWeightKg });
  renderCoach(allDaily, goals);
  renderMetrics(allDaily, goals);

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
  for (const button of document.querySelectorAll<HTMLButtonElement>('.seg')) {
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
  sections?.['overview']?.();
}

function applyParsed(raw: SheetValues, rawTraining: SheetValues, timestamp: number, fromCache: boolean): void {
  const parsed = parseDaily(raw);
  allDaily = parsed.daily;
  allWeekBlocks = parsed.weekBlocks;
  goals = parseGoals(raw, rawTraining);
  training = rawTraining.length ? parseTraining(rawTraining) : null;
  dataTimestamp = timestamp;
  dataFromCache = fromCache;

  show('status', false);
  show('dashboard', true);
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
    show('config-banner', true);
    show('status', false);
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

function wire(): void {
  byId('btn-save-config')?.addEventListener('click', handleSaveConfig);
  byId('btn-cancel-config')?.addEventListener('click', () => show('config-banner', false));
  byId('btn-refresh')?.addEventListener('click', () => void loadData(true));
  byId('btn-config')?.addEventListener('click', showConfig);
  byId('btn-export-csv')?.addEventListener('click', () => downloadCsv(filteredDaily()));
  byId('t-day-select')?.addEventListener('change', filterTrainingDay);
  byId('t-exercise-select')?.addEventListener('change', renderProgression);

  for (const button of document.querySelectorAll<HTMLButtonElement>('.seg')) {
    button.addEventListener('click', () => setWeightMode((button.dataset['mode'] ?? 'weight') as WeightMode));
  }

  setupTabs(() => renderActiveSection());
  setupRangeButtons(applyDateRange);
  attachChartExports();

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) void loadData();
  });

  window.setInterval(updateDataAge, AGE_TICK_MS);
}

wire();
void loadData(true);
