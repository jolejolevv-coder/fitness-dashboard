import './styles.css';

import type { DailyEntry, SheetValues, WeekBlock } from './types';
import { parseDaily } from './parse/daily';
import { parseTraining } from './parse/training';
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
import { byId, show } from './ui/dom';
import { renderDashboard } from './ui/dashboard';
import { filterTrainingDay, renderExerciseTable, renderProgression, renderTraining } from './ui/training';

/** PHASE 1: Ladepolitik unveraendert. Die Umstellung erfolgt in Phase 5. */
const REFRESH_INTERVAL_MS = 5 * 60 * 1000;

const MS_PER_DAY = 864e5;

let allDaily: DailyEntry[] = [];
let allWeekBlocks: WeekBlock[] = [];
let dateRangeDays = 0;

function input(id: string): HTMLInputElement | null {
  return byId<HTMLInputElement>(id);
}

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
  show('config-banner', true);
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
  saveCredentials(credentials);
  show('config-banner', false);
  void loadData();
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

function setLastUpdated(text: string): void {
  const element = byId('last-updated');
  if (element) element.textContent = text;
}

function cutoffDate(): Date | null {
  return dateRangeDays > 0 ? new Date(Date.now() - dateRangeDays * MS_PER_DAY) : null;
}

function filteredDaily(): DailyEntry[] {
  const cutoff = cutoffDate();
  if (!cutoff) return allDaily;
  return allDaily.filter((r) => r.dateObj && r.dateObj >= cutoff);
}

/**
 * PHASE 2: der Zeitraumfilter wirkt auch auf die Wochenansicht.
 *
 * Vorher filterte er nur die Tagesdaten, waehrend Wochenkarten und Wochenchart
 * unveraendert alle Wochen zeigten. Ein Block zaehlt dazu, wenn sein letzter Tag
 * im Zeitraum liegt.
 */
function filteredWeekBlocks(): WeekBlock[] {
  const cutoff = cutoffDate();
  if (!cutoff) return allWeekBlocks;
  return allWeekBlocks.filter((block) => {
    const last = block.rows[block.rows.length - 1]?.dateObj;
    return last ? last >= cutoff : false;
  });
}

function applyDateRange(days: number): void {
  dateRangeDays = days;
  for (const button of document.querySelectorAll<HTMLElement>('.range-btn')) {
    button.classList.toggle('active', Number(button.dataset['range']) === days);
  }
  renderDashboard(filteredDaily(), filteredWeekBlocks(), showError);
}

function showTab(name: string, element: HTMLElement): void {
  for (const section of document.querySelectorAll('.section')) section.classList.remove('active');
  for (const tab of document.querySelectorAll('.tab')) tab.classList.remove('active');
  byId(name)?.classList.add('active');
  element.classList.add('active');
}

function applyParsed(raw: SheetValues, rawTraining: SheetValues): void {
  const { daily, weekBlocks } = parseDaily(raw);
  allDaily = daily;
  allWeekBlocks = weekBlocks;

  show('status', false);
  show('dashboard', true);
  renderDashboard(filteredDaily(), filteredWeekBlocks(), showError);
  renderTraining(rawTraining.length ? parseTraining(rawTraining) : null);
}

function describe(error: unknown): string {
  if (error instanceof MissingColumnsError) {
    return `${error.message}. Die Kopfzeile im Sheet hat sich geaendert.`;
  }
  return error instanceof Error ? error.message : String(error);
}

export async function loadData(): Promise<void> {
  const credentials = getCredentials();
  if (!hasCredentials(credentials)) {
    show('config-banner', true);
    show('status', false);
    return;
  }

  const cache = loadCache();
  if (cache) {
    try {
      applyParsed(cache.raw, cache.rawTraining);
      setLastUpdated(`Cache: ${new Date(cache.ts).toLocaleTimeString('de-DE')} · Aktualisiere…`);
    } catch {
      // Ein unlesbarer Cache darf den frischen Abruf nicht verhindern.
    }
  } else {
    showSpinner('Lade Daten von Google Sheets…');
    show('dashboard', false);
  }

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
    applyParsed(raw, rawTraining);
  } catch (error) {
    if (!cache) showError(describe(error));
    else setLastUpdated(`Cache · Abruf fehlgeschlagen: ${describe(error)}`);
  }
}

function wire(): void {
  byId('btn-save-config')?.addEventListener('click', handleSaveConfig);
  byId('btn-cancel-config')?.addEventListener('click', () => show('config-banner', false));
  byId('btn-refresh')?.addEventListener('click', () => void loadData());
  byId('btn-config')?.addEventListener('click', showConfig);
  byId('t-day-select')?.addEventListener('change', filterTrainingDay);
  byId('t-exercise-select')?.addEventListener('change', renderProgression);

  for (const tab of document.querySelectorAll<HTMLElement>('.tab')) {
    tab.addEventListener('click', () => {
      const target = tab.dataset['tab'];
      if (target) showTab(target, tab);
    });
  }

  for (const button of document.querySelectorAll<HTMLElement>('.range-btn')) {
    button.addEventListener('click', () => applyDateRange(Number(button.dataset['range'])));
  }

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) void loadData();
  });
  window.setInterval(() => {
    if (!document.hidden) void loadData();
  }, REFRESH_INTERVAL_MS);
}

wire();
void loadData();

// Wird von der Uebungstabelle nach einem Klick gebraucht.
export { renderExerciseTable };
