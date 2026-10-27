/**
 * Training eintragen, Kernlogik.
 *
 * Reine Funktionen ohne Zugriff auf SpreadsheetApp, PropertiesService oder
 * LockService, wie in daily-import-core.js. Die Huelle liest den Mesocycle Tab,
 * ruft diese Funktionen auf und schreibt nur, was planTrainingWrites
 * zurueckgibt.
 *
 * Im Apps Script Editor teilen sich alle Dateien einen globalen Namensraum.
 * Diese Datei nutzt deshalb die Hilfsfunktionen aus daily-import-core.js
 * (failure, parseJsonObject, isPlainObject, tokensMatch, normalizeHeader,
 * cellAt, isCellEmpty) und die Fehlercodes ERROR_UNAUTHORIZED und
 * ERROR_BAD_REQUEST. Die Tests laden beide Dateien in denselben vm Kontext.
 *
 * Aufbau eines Mesocycle Tabs (specs/sheet-structure.md): Jeder Trainingstag
 * beginnt mit einer Kopfzeile, die links den Tag nennt (`Day 1 - Torso`) und je
 * Woche einen Spaltenblock, eingeleitet von `Excercise` (Schreibfehler im
 * Original). Im Block stehen `Load`, dahinter `Reps` (Ist, das erste `Reps`
 * vor `Load` ist Soll) und, nicht in jedem Tab, `Notes`. Die Abstaende der
 * Bloecke schwanken, deshalb wird jeder Block ueber seine Koepfe gelesen.
 * Darunter folgen die Uebungszeilen bis zur naechsten Kopfzeile. Dieselbe
 * Uebung kann am selben Tag in mehreren Zeilen stehen, `occurrence` zaehlt sie.
 *
 * Zeilennummern sind 1 basiert wie im Sheet, Spaltenindizes 0 basiert.
 *
 * Spec: specs/features/training-log.md, ADR 0007.
 */

/* global failure, parseJsonObject, isPlainObject, tokensMatch, normalizeHeader, cellAt, isCellEmpty,
   ERROR_UNAUTHORIZED, ERROR_BAD_REQUEST */
/* exported validateTrainingRequest, findDayHeader, findWeekBlock, findExerciseRow, planTrainingWrites, sheetValue */

const ERROR_UNKNOWN_SHEET = 'unknown_sheet';
const ERROR_UNKNOWN_DAY = 'unknown_day';
const ERROR_UNKNOWN_WEEK = 'unknown_week';
const ERROR_UNKNOWN_EXERCISE = 'unknown_exercise';
const ERROR_UNKNOWN_COLUMN = 'unknown_column';

const STATUS_WRITTEN = 'written';
const STATUS_OCCUPIED = 'occupied';

/** Nur Tabs dieses Namens sind beschreibbar. */
const TRAINING_SHEET_PATTERN = /^Mesocycle \d+$/;

/** Beschriftung, die einen Wochenblock einleitet. */
const WEEK_BLOCK_MARKER = 'Excercise';

/** Ab so vielen Markierungen gilt eine Zeile als Kopfzeile eines Tages, wie im Parser der App. */
const MIN_WEEK_BLOCKS = 3;

/** Koepfe im Wochenblock. `Reps Ist` wird gelesen, falls ein Tab die Spalte so nennt. */
const HEADER_LOAD = 'Load';
const HEADERS_REPS_ACTUAL = ['Reps Ist', 'Reps'];
const HEADER_NOTES = 'Notes';

/** Hoechstlaengen je Feld, wie die App sie prueft. */
const MAX_LENGTH = { load: 20, repsActual: 40, notes: 200 };

/** Reine Dezimalzahl mit Komma oder Punkt, wird als Zahl geschrieben. */
const PLAIN_NUMBER_PATTERN = /^\d+([,.]\d+)?$/;

/** Vorangestellt erzwingt es Text: kein Datum aus `9-9`, keine Formel aus `=...`. */
const TEXT_PREFIX = "'";

/** Felder eines Eintrags in Schreibreihenfolge. */
const TRAINING_FIELDS = ['load', 'repsActual', 'notes'];

/**
 * Prueft den Rumpf einer Anfrage der Aktion `training`.
 *
 * Das Token wird vor allem anderen geprueft, wie im Daily Import. Ein Eintrag
 * braucht den Uebungsnamen und mindestens ein nicht leeres Feld.
 *
 * @param {string} rawBody Rumpf der Anfrage, unveraendert
 * @param {string} expectedToken Wert der Script Property TRAINING_TOKEN
 * @returns {{ok: true, sheet: string, week: number, day: string, entries: Array<Object>} | {ok: false, error: string, detail: string}}
 */
function validateTrainingRequest(rawBody, expectedToken) {
  const body = parseJsonObject(rawBody);
  if (body === null) return failure(ERROR_BAD_REQUEST, 'body is not a JSON object');

  if (!tokensMatch(body.token, expectedToken)) return failure(ERROR_UNAUTHORIZED, '');

  if (typeof body.sheet !== 'string' || !TRAINING_SHEET_PATTERN.test(body.sheet)) {
    return failure(ERROR_UNKNOWN_SHEET, 'sheet must be named Mesocycle N');
  }
  if (!isPositiveInteger(body.week)) return failure(ERROR_BAD_REQUEST, 'week must be a positive integer');
  if (typeof body.day !== 'string' || body.day.trim() === '') return failure(ERROR_BAD_REQUEST, 'day must be text');
  if (!Array.isArray(body.entries) || body.entries.length === 0) {
    return failure(ERROR_BAD_REQUEST, 'entries must be a non empty list');
  }

  const entries = [];
  for (let i = 0; i < body.entries.length; i++) {
    const entry = cleanEntry(body.entries[i]);
    if (entry === null) return failure(ERROR_BAD_REQUEST, 'entry ' + i + ' is invalid');
    entries.push(entry);
  }
  return { ok: true, sheet: body.sheet, week: body.week, day: body.day, entries: entries };
}

/**
 * Sucht die Kopfzeile des Trainingstags.
 *
 * Kopfzeile ist eine Zeile mit mindestens MIN_WEEK_BLOCKS Markierungen, in der
 * links vor der ersten Markierung der Tag steht. Verglichen wird nach
 * Zusammenfassen von Leerraum.
 *
 * @param {Array<Array<string>>} grid Anzeigewerte des Tabs, grid[0] ist Zeile 1
 * @param {string} day Tag wie im Tab, etwa `Day 1 - Torso`
 * @returns {{ok: true, row: number} | {ok: false, error: string, detail: string}}
 */
function findDayHeader(grid, day) {
  const wanted = normalizeHeader(day);
  const hits = [];
  for (let index = 0; index < grid.length; index++) {
    const markers = markerColumns(grid[index]);
    if (markers.length < MIN_WEEK_BLOCKS) continue;
    for (let column = 0; column < markers[0]; column++) {
      if (normalizeHeader(cellAt(grid[index], column)) === wanted) {
        hits.push(index + 1);
        break;
      }
    }
  }
  if (hits.length !== 1) return failure(ERROR_UNKNOWN_DAY, day);
  return { ok: true, row: hits[0] };
}

/**
 * Findet den Spaltenblock einer Woche in der Kopfzeile eines Tages.
 *
 * Der Block reicht von seiner Markierung bis vor die naechste. `Load` und
 * `Reps` Ist muessen vorhanden sein, `Notes` ist optional und dann null.
 *
 * @param {Array<string>} headerCells Anzeigewerte der Kopfzeile des Tages
 * @param {number} week Woche, 1 basiert
 * @returns {{ok: true, columns: {exercise: number, load: number, repsActual: number, notes: (number|null)}} | {ok: false, error: string, detail: string}}
 */
function findWeekBlock(headerCells, week) {
  const markers = markerColumns(headerCells);
  if (week < 1 || week > markers.length) return failure(ERROR_UNKNOWN_WEEK, String(week));

  const start = markers[week - 1];
  const end = week < markers.length ? markers[week] : headerCells.length;
  const load = firstColumnOf(headerCells, [HEADER_LOAD], start, end);
  if (load === null) return failure(ERROR_UNKNOWN_COLUMN, HEADER_LOAD);
  const repsActual = firstColumnOf(headerCells, HEADERS_REPS_ACTUAL, load + 1, end);
  if (repsActual === null) return failure(ERROR_UNKNOWN_COLUMN, 'Reps Ist');
  const notes = firstColumnOf(headerCells, [HEADER_NOTES], load + 1, end);

  return { ok: true, columns: { exercise: start, load: load, repsActual: repsActual, notes: notes } };
}

/**
 * Sucht die Zeile einer Uebung unter der Kopfzeile eines Tages.
 *
 * Gesucht wird bis zur naechsten Kopfzeile. Steht die Uebung mehrmals am Tag,
 * waehlt occurrence die n te Zeile.
 *
 * @param {Array<Array<string>>} grid Anzeigewerte des Tabs
 * @param {number} headerRow Kopfzeile des Tages, 1 basiert
 * @param {number} exerciseColumn Spalte `Excercise` des Wochenblocks
 * @param {string} exercise Uebungsname
 * @param {number} occurrence Vorkommen am Tag, 1 basiert
 * @returns {{ok: true, row: number} | {ok: false, error: string, detail: string}}
 */
function findExerciseRow(grid, headerRow, exerciseColumn, exercise, occurrence) {
  const wanted = normalizeHeader(exercise);
  let seen = 0;
  for (let index = headerRow; index < grid.length; index++) {
    if (markerColumns(grid[index]).length >= MIN_WEEK_BLOCKS) break;
    if (normalizeHeader(cellAt(grid[index], exerciseColumn)) !== wanted) continue;
    seen++;
    if (seen === occurrence) return { ok: true, row: index + 1 };
  }
  return failure(ERROR_UNKNOWN_EXERCISE, exercise + ' #' + occurrence);
}

/**
 * Plant, welche Zellen der Uebungszeile beschrieben werden.
 *
 * Nur leere Zellen ohne Formel. Belegte Zellen bleiben unveraendert und melden
 * `occupied`. Fehlt dem Block die Spalte `Notes`, meldet das Feld
 * `unknown_column`.
 *
 * @param {Array<string>} rowDisplay Anzeigewerte der Uebungszeile
 * @param {Array<string>} rowFormulas Formeln der Uebungszeile, leerer Text ohne Formel
 * @param {{load: number, repsActual: number, notes: (number|null)}} columns Ergebnis von findWeekBlock
 * @param {Object} entry Eintrag aus validateTrainingRequest
 * @returns {{ok: true, writes: Array<{field: string, column: number, value: string}>, status: Object<string, string>}}
 */
function planTrainingWrites(rowDisplay, rowFormulas, columns, entry) {
  const writes = [];
  const status = {};
  for (let i = 0; i < TRAINING_FIELDS.length; i++) {
    const field = TRAINING_FIELDS[i];
    if (entry[field] === undefined) continue;
    const column = columns[field];
    if (column === null || column === undefined) {
      status[field] = ERROR_UNKNOWN_COLUMN;
    } else if (isCellEmpty(cellAt(rowDisplay, column), cellAt(rowFormulas, column))) {
      writes.push({ field: field, column: column, value: entry[field] });
      status[field] = STATUS_WRITTEN;
    } else {
      status[field] = STATUS_OCCUPIED;
    }
  }
  return { ok: true, writes: writes, status: status };
}

/**
 * Wert fuer setValue.
 *
 * Eine reine Dezimalzahl wie `62,5` wird Zahl, damit Formeln des Trainers mit
 * ihr rechnen koennen. Alles andere, etwa `55x2`, `9-9` oder `10,9,8`, wird mit
 * Apostroph als Text geschrieben. Sonst deutet Sheets `9-9` als Datum, und ein
 * Text mit `=` am Anfang wuerde zur Formel.
 *
 * @param {string} text bereinigter Wert eines Felds
 * @returns {(number|string)}
 */
function sheetValue(text) {
  if (PLAIN_NUMBER_PATTERN.test(text)) return Number(text.replace(',', '.'));
  return TEXT_PREFIX + text;
}

/** Bereinigter Eintrag oder null. Leere Felder fallen weg, mindestens eins muss bleiben. */
function cleanEntry(raw) {
  if (!isPlainObject(raw)) return null;
  if (typeof raw.exercise !== 'string' || raw.exercise.trim() === '') return null;

  const occurrence = raw.occurrence === undefined ? 1 : raw.occurrence;
  if (!isPositiveInteger(occurrence)) return null;

  const entry = { exercise: raw.exercise, occurrence: occurrence };
  let filled = 0;
  for (let i = 0; i < TRAINING_FIELDS.length; i++) {
    const field = TRAINING_FIELDS[i];
    const value = raw[field];
    if (value === undefined || value === null) continue;
    if (typeof value !== 'string' || value.length > MAX_LENGTH[field]) return null;
    if (value.trim() === '') continue;
    entry[field] = value.trim();
    filled++;
  }
  return filled > 0 ? entry : null;
}

function isPositiveInteger(value) {
  return typeof value === 'number' && isFinite(value) && Math.floor(value) === value && value >= 1;
}

function markerColumns(row) {
  const found = [];
  if (!row) return found;
  for (let column = 0; column < row.length; column++) {
    if (normalizeHeader(row[column]) === WEEK_BLOCK_MARKER) found.push(column);
  }
  return found;
}

/** Erste Spalte in [from, to), deren Kopf einem der Namen entspricht, sonst null. */
function firstColumnOf(cells, names, from, to) {
  for (let column = from; column < to; column++) {
    if (names.indexOf(normalizeHeader(cellAt(cells, column))) !== -1) return column;
  }
  return null;
}
