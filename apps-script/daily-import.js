/**
 * Web App des Arbeitsblatts: Huelle um die beiden Kerne.
 *
 * Zwei Aktionen, beide schreiben nur in leere Zellen:
 *   daily     Daily Import aus dem Shortcut (ADR 0005), Vorgabe ohne `action`
 *   training  Training eintragen aus der App (ADR 0007)
 *
 * Ablauf je Anfrage: Rumpf pruefen (Token zuerst), Sperre holen, Tab lesen,
 * Kernfunktionen fragen, nur deren Schreibplan ausfuehren, JSON antworten.
 * Apps Script antwortet immer mit HTTP 200, der Aufrufer wertet `ok` aus.
 *
 * Keine Werte im Log: die Huelle schreibt gar nicht ins Log.
 *
 * Script Properties:
 *   DAILY_IMPORT_TOKEN   Token des Shortcuts
 *   TRAINING_TOKEN       Token der App
 *   HEADER_ROW           Kopfzeile in Daily Tracking, Vorgabe DEFAULT_HEADER_ROW
 *   FIRST_DATA_ROW       erste Datenzeile, Vorgabe DEFAULT_FIRST_DATA_ROW
 * Fehlt ein Token, lehnt die Aktion jede Anfrage ab.
 *
 * Einrichtung: apps-script/README.md.
 */

/* global failure, parseJsonObject, validateRequest, mapHeaders, findDateRow, planWrites,
   validateTrainingRequest, findDayHeader, findWeekBlock, findExerciseRow, planTrainingWrites, sheetValue,
   ERROR_BAD_REQUEST, ERROR_HEADER_MISSING, ERROR_UNKNOWN_SHEET,
   SpreadsheetApp, PropertiesService, LockService, ContentService */
/* exported doPost */

/** Kommt in jeder Antwort zurueck, damit Repo und Editor vergleichbar bleiben. */
const SCRIPT_VERSION = '13.3';

const ACTION_DAILY = 'daily';
const ACTION_TRAINING = 'training';

const ERROR_LOCKED = 'locked';
const ERROR_INTERNAL = 'internal';

/** So lange wartet ein Lauf auf einen anderen, danach `locked`. */
const LOCK_TIMEOUT_MS = 10000;

const DAILY_SHEET_NAME = 'Daily Tracking';
const DATE_HEADER = 'Date';

/** Vorgaben aus specs/features/daily-import.md, ueber Script Properties aenderbar. */
const DEFAULT_HEADER_ROW = 29;
const DEFAULT_FIRST_DATA_ROW = 31;

/**
 * Einstieg der Web App.
 *
 * @param {{postData: {contents: string}}} e Ereignis von Apps Script
 * @returns {Object} TextOutput mit JSON
 */
function doPost(e) {
  const rawBody = e && e.postData ? e.postData.contents : '';
  let result;
  try {
    result = handleRequest(rawBody);
  } catch {
    // Keine Fehlermeldung nach aussen, sie koennte Zellinhalte tragen.
    result = failure(ERROR_INTERNAL, '');
  }
  result.version = SCRIPT_VERSION;
  return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
}

function handleRequest(rawBody) {
  const body = parseJsonObject(rawBody);
  const action = body !== null && body.action !== undefined ? body.action : ACTION_DAILY;
  const properties = PropertiesService.getScriptProperties();

  if (action === ACTION_TRAINING) {
    const request = validateTrainingRequest(rawBody, properties.getProperty('TRAINING_TOKEN'));
    return request.ok ? withLock(function () { return runTraining(request); }) : request;
  }
  if (action === ACTION_DAILY) {
    const request = validateRequest(rawBody, properties.getProperty('DAILY_IMPORT_TOKEN'));
    return request.ok ? withLock(function () { return runDaily(request, properties); }) : request;
  }
  return failure(ERROR_BAD_REQUEST, 'unknown action');
}

/** Fuehrt work unter der Script Sperre aus, damit zwei Laeufe nicht ineinander greifen. */
function withLock(work) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(LOCK_TIMEOUT_MS)) return failure(ERROR_LOCKED, '');
  try {
    return work();
  } finally {
    lock.releaseLock();
  }
}

/**
 * Daily Import: eine Datumszeile in Daily Tracking.
 *
 * Unbekannte oder doppelte Koepfe brechen ab, bevor irgendetwas geschrieben wird.
 */
function runDaily(request, properties) {
  const sheet = SpreadsheetApp.getActive().getSheetByName(DAILY_SHEET_NAME);
  if (sheet === null) return failure(ERROR_HEADER_MISSING, DAILY_SHEET_NAME);

  const headerRow = rowProperty(properties, 'HEADER_ROW', DEFAULT_HEADER_ROW);
  const firstDataRow = rowProperty(properties, 'FIRST_DATA_ROW', DEFAULT_FIRST_DATA_ROW);
  const range = sheet.getDataRange();
  const display = range.getDisplayValues();
  const formulas = range.getFormulas();

  const wanted = [DATE_HEADER].concat(Object.keys(request.values));
  const mapping = mapHeaders(display[headerRow - 1] || [], wanted);
  if (!mapping.ok) return mapping;

  const found = findDateRow(display, mapping.columns[DATE_HEADER], firstDataRow, request.date);
  if (!found.ok) return found;

  const plan = planWrites(display[found.row - 1], formulas[found.row - 1], mapping.columns, request.values);
  for (let i = 0; i < plan.writes.length; i++) {
    sheet.getRange(found.row, plan.writes[i].column + 1).setValue(plan.writes[i].value);
  }
  return {
    ok: true,
    written: plan.writes.map(function (write) { return write.header; }),
    skipped: plan.skipped,
  };
}

/**
 * Training eintragen: Ist Werte eines Tags und einer Woche im Mesocycle Tab.
 *
 * Fehler eines Eintrags (unbekannte Uebung) stehen bei diesem Eintrag, die
 * uebrigen Eintraege werden trotzdem geschrieben.
 */
function runTraining(request) {
  const sheet = SpreadsheetApp.getActive().getSheetByName(request.sheet);
  if (sheet === null) return failure(ERROR_UNKNOWN_SHEET, request.sheet);

  const range = sheet.getDataRange();
  const display = range.getDisplayValues();
  const formulas = range.getFormulas();

  const header = findDayHeader(display, request.day);
  if (!header.ok) return header;
  const block = findWeekBlock(display[header.row - 1], request.week);
  if (!block.ok) return block;

  const results = request.entries.map(function (entry) {
    const result = { exercise: entry.exercise, occurrence: entry.occurrence };
    const found = findExerciseRow(display, header.row, block.columns.exercise, entry.exercise, entry.occurrence);
    if (!found.ok) {
      result.error = found.error;
      return result;
    }
    const plan = planTrainingWrites(display[found.row - 1], formulas[found.row - 1], block.columns, entry);
    for (let i = 0; i < plan.writes.length; i++) {
      sheet.getRange(found.row, plan.writes[i].column + 1).setValue(sheetValue(plan.writes[i].value));
    }
    result.status = plan.status;
    return result;
  });
  return { ok: true, results: results };
}

/** Zeilennummer aus den Script Properties, sonst die Vorgabe. */
function rowProperty(properties, name, fallback) {
  const value = Number(properties.getProperty(name));
  return value >= 1 && Math.floor(value) === value ? value : fallback;
}
