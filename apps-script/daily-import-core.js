/**
 * Daily Import, Kernlogik.
 *
 * Reine Funktionen ohne Zugriff auf SpreadsheetApp, PropertiesService oder
 * LockService. Die Huelle in daily-import.js liest das Blatt und die Script
 * Properties, ruft diese Funktionen auf und schreibt nur, was planWrites
 * zurueckgibt.
 *
 * Die Datei laeuft unveraendert im Apps Script Editor. Dort sind alle Funktionen
 * auf oberster Ebene global, deshalb kein import und kein export. Die Tests
 * laden sie ueber node:vm.
 *
 * Jede Funktion liefert ein Ergebnisobjekt statt zu werfen:
 *   { ok: true, ... }                      bei Erfolg
 *   { ok: false, error: <Code>, detail }   mit einem Fehlercode aus der Spec
 *
 * Zeilennummern sind 1 basiert wie im Sheet, Spaltenindizes 0 basiert wie in
 * den Arrays aus getDisplayValues.
 *
 * Spec: specs/features/daily-import.md, ADR 0005.
 */

/* exported validateRequest, mapHeaders, findDateRow, planWrites */

const ERROR_UNAUTHORIZED = 'unauthorized';
const ERROR_BAD_REQUEST = 'bad_request';
const ERROR_HEADER_MISSING = 'header_missing';
const ERROR_HEADER_AMBIGUOUS = 'header_ambiguous';
const ERROR_DATE_MISSING = 'date_missing';
const ERROR_DATE_AMBIGUOUS = 'date_ambiguous';

/** Datum im Format d.m.yyyy, fuehrende Nullen erlaubt. */
const DATE_PATTERN = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/;

/**
 * Prueft den Rumpf einer Anfrage.
 *
 * Das Token wird vor allem anderen geprueft, damit eine Anfrage ohne gueltiges
 * Token nichts ueber Datum oder Felder erfaehrt. Fehlt das erwartete Token,
 * etwa weil die Script Property nicht gesetzt ist, wird jede Anfrage abgelehnt.
 *
 * Werte muessen Zahl oder Text sein. Leerer Text wird verworfen, weil er im
 * Sheet dasselbe bedeutet wie ein nicht gesendetes Feld.
 *
 * @param {string} rawBody Rumpf der Anfrage, unveraendert
 * @param {string} expectedToken Wert der Script Property DAILY_IMPORT_TOKEN
 * @returns {{ok: true, date: {day: number, month: number, year: number}, values: Object<string, (string|number)>} | {ok: false, error: string, detail: string}}
 */
function validateRequest(rawBody, expectedToken) {
  const body = parseJsonObject(rawBody);
  if (body === null) return failure(ERROR_BAD_REQUEST, 'body is not a JSON object');

  if (!tokensMatch(body.token, expectedToken)) return failure(ERROR_UNAUTHORIZED, '');

  const date = parseSheetDate(body.date);
  if (date === null) return failure(ERROR_BAD_REQUEST, 'date must be d.m.yyyy');

  const values = cleanValues(body.values);
  if (values === null) return failure(ERROR_BAD_REQUEST, 'values must map header text to number or text');

  return { ok: true, date: date, values: values };
}

/**
 * Ordnet jeden gesuchten Kopf genau einer Spalte der Kopfzeile zu.
 *
 * Verglichen wird der Kopftext nach Zusammenfassen von Leerraum, damit ein
 * Zeilenumbruch im Kopf wie bei "Menstruation Cycle" nicht stoert. Gross und
 * Kleinschreibung zaehlen.
 *
 * @param {Array<string>} headerCells Anzeigewerte der Kopfzeile
 * @param {Array<string>} wantedHeaders gesuchte Koepfe, etwa Date plus die Schluessel aus values
 * @returns {{ok: true, columns: Object<string, number>} | {ok: false, error: string, detail: string}}
 */
function mapHeaders(headerCells, wantedHeaders) {
  const columns = {};
  for (let i = 0; i < wantedHeaders.length; i++) {
    const wanted = normalizeHeader(wantedHeaders[i]);
    const matches = indexesOf(headerCells, function (cellText) {
      return normalizeHeader(cellText) === wanted;
    });
    if (matches.length === 0) return failure(ERROR_HEADER_MISSING, wantedHeaders[i]);
    if (matches.length > 1) return failure(ERROR_HEADER_AMBIGUOUS, wantedHeaders[i]);
    columns[wantedHeaders[i]] = matches[0];
  }
  return { ok: true, columns: columns };
}

/**
 * Sucht die eine Zeile, deren Datumszelle das gesuchte Datum traegt.
 *
 * Gesucht wird ab firstDataRow. Zeilen ohne lesbares Datum, also Wochenbloecke
 * mit Durchschnitt, Gewichtsveraenderung und in %, sowie Leerzeilen, werden
 * uebersprungen. Kein Treffer oder mehr als ein Treffer ist ein Fehler.
 *
 * @param {Array<Array<string>>} grid Anzeigewerte des Blatts, grid[0] ist Zeile 1
 * @param {number} dateColumn Index der Spalte Date
 * @param {number} firstDataRow erste Datenzeile, 1 basiert
 * @param {{day: number, month: number, year: number}} date gesuchtes Datum
 * @returns {{ok: true, row: number} | {ok: false, error: string, detail: string}}
 */
function findDateRow(grid, dateColumn, firstDataRow, date) {
  const hits = [];
  for (let index = firstDataRow - 1; index < grid.length; index++) {
    const cellDate = parseSheetDate(cellAt(grid[index], dateColumn));
    if (cellDate !== null && sameDate(cellDate, date)) hits.push(index + 1);
  }
  if (hits.length === 0) return failure(ERROR_DATE_MISSING, formatSheetDate(date));
  if (hits.length > 1) return failure(ERROR_DATE_AMBIGUOUS, formatSheetDate(date) + ' in rows ' + hits.join(', '));
  return { ok: true, row: hits[0] };
}

/**
 * Plant, welche Zellen der Zielzeile beschrieben werden.
 *
 * Nur leere Zellen werden beschrieben. Leer heisst: Anzeigewert leer und keine
 * Formel. Befuellte Zellen bleiben unveraendert und landen in skipped, damit
 * Korrekturen des Trainers erhalten bleiben und ein zweiter Lauf harmlos ist.
 *
 * @param {Array<string>} rowDisplay Anzeigewerte der Zielzeile
 * @param {Array<string>} rowFormulas Formeln der Zielzeile, leerer Text ohne Formel
 * @param {Object<string, number>} columns Ergebnis von mapHeaders
 * @param {Object<string, (string|number)>} values Werte aus validateRequest
 * @returns {{ok: true, writes: Array<{header: string, column: number, value: (string|number)}>, skipped: Array<string>}}
 */
function planWrites(rowDisplay, rowFormulas, columns, values) {
  const writes = [];
  const skipped = [];
  const headers = Object.keys(values);
  for (let i = 0; i < headers.length; i++) {
    const header = headers[i];
    const column = columns[header];
    if (isCellEmpty(cellAt(rowDisplay, column), cellAt(rowFormulas, column))) {
      writes.push({ header: header, column: column, value: values[header] });
    } else {
      skipped.push(header);
    }
  }
  return { ok: true, writes: writes, skipped: skipped };
}

function failure(code, detail) {
  return { ok: false, error: code, detail: detail };
}

function parseJsonObject(rawBody) {
  if (typeof rawBody !== 'string') return null;
  try {
    const parsed = JSON.parse(rawBody);
    return isPlainObject(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Vergleicht zwei Token ohne fruehen Abbruch beim ersten abweichenden Zeichen,
 * damit die Laufzeit nicht verraet, wie viele Zeichen stimmen.
 */
function tokensMatch(given, expected) {
  if (typeof given !== 'string' || typeof expected !== 'string') return false;
  if (expected.length === 0 || given.length !== expected.length) return false;
  let difference = 0;
  for (let i = 0; i < expected.length; i++) {
    difference |= given.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return difference === 0;
}

/** Liest d.m.yyyy und prueft, dass das Datum im Kalender existiert. */
function parseSheetDate(text) {
  if (typeof text !== 'string') return null;
  const match = DATE_PATTERN.exec(text.trim());
  if (match === null) return null;
  const date = { day: Number(match[1]), month: Number(match[2]), year: Number(match[3]) };
  const check = new Date(Date.UTC(date.year, date.month - 1, date.day));
  const exists = check.getUTCFullYear() === date.year
    && check.getUTCMonth() === date.month - 1
    && check.getUTCDate() === date.day;
  return exists ? date : null;
}

function formatSheetDate(date) {
  return date.day + '.' + date.month + '.' + date.year;
}

function sameDate(a, b) {
  return a.day === b.day && a.month === b.month && a.year === b.year;
}

/** Gibt die bereinigten Werte zurueck oder null, wenn ein Wert unzulaessig ist. */
function cleanValues(values) {
  if (!isPlainObject(values)) return null;
  const cleaned = {};
  const headers = Object.keys(values);
  for (let i = 0; i < headers.length; i++) {
    const value = values[headers[i]];
    if (typeof value === 'number' && isFinite(value)) {
      cleaned[headers[i]] = value;
    } else if (typeof value === 'string') {
      if (value.trim() !== '') cleaned[headers[i]] = value;
    } else {
      return null;
    }
  }
  return cleaned;
}

function normalizeHeader(text) {
  return String(text === undefined || text === null ? '' : text).replace(/\s+/g, ' ').trim();
}

function indexesOf(cells, predicate) {
  const found = [];
  for (let i = 0; i < cells.length; i++) {
    if (predicate(cells[i])) found.push(i);
  }
  return found;
}

/** Zeilen aus dem Sheet koennen kuerzer sein als die Kopfzeile, fehlende Zellen gelten als leer. */
function cellAt(row, column) {
  if (!row) return '';
  const value = row[column];
  return value === undefined || value === null ? '' : String(value);
}

function isCellEmpty(display, formula) {
  return display === '' && formula === '';
}
