import type { DailyEntry } from '../types';
import { getChart } from '../charts/base';

/**
 * Ausgabe von Daten und Diagrammen.
 *
 * CSV mit Semikolon und Dezimalkomma, damit es sich in einer deutschen
 * Tabellenkalkulation ohne Importdialog oeffnen laesst. Mit Byte Order Mark,
 * sonst zerlegt Excel die Umlaute.
 */

const SEPARATOR = ';';
const BOM = '﻿';

const COLUMNS: readonly (readonly [string, (e: DailyEntry) => string])[] = [
  ['Datum', (e) => e.date],
  ['Gewicht', (e) => number(e.weight)],
  ['Zeit', (e) => e.time],
  ['Protein', (e) => number(e.protein)],
  ['Carbs', (e) => number(e.carbs)],
  ['Fett', (e) => number(e.fat)],
  ['Ballaststoffe', (e) => number(e.fiber)],
  ['Obst und Gemuese', (e) => number(e.fv)],
  ['Kalorien', (e) => number(e.calories)],
  ['Schlaf', (e) => number(e.sleep)],
  ['Schlafqualitaet', (e) => number(e.sleepQ)],
  ['Verdauung', (e) => number(e.digestion)],
  ['Stress', (e) => number(e.stress)],
  ['Energie', (e) => number(e.energy)],
  ['Schritte', (e) => number(e.steps)],
  ['Trainingstag', (e) => e.training],
  ['Notiz', (e) => e.comment],
];

function number(value: number | null): string {
  return value === null ? '' : String(value).replace('.', ',');
}

/** Feldinhalt maskieren. Semikolon, Anfuehrungszeichen und Zeilenumbrueche kommen vor. */
function escape(value: string): string {
  if (!/[";\n\r]/.test(value)) return value;
  return `"${value.replace(/"/g, '""')}"`;
}

export function toCsv(entries: readonly DailyEntry[]): string {
  const lines = [COLUMNS.map(([header]) => header).join(SEPARATOR)];
  for (const entry of entries) {
    lines.push(COLUMNS.map(([, read]) => escape(read(entry))).join(SEPARATOR));
  }
  return BOM + lines.join('\r\n');
}

function download(filename: string, href: string): void {
  const link = document.createElement('a');
  link.href = href;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
}

function stamp(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export function downloadCsv(entries: readonly DailyEntry[]): void {
  const blob = new Blob([toCsv(entries)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  download(`tracking-${stamp()}.csv`, url);
  URL.revokeObjectURL(url);
}

/**
 * Haengt an jede Diagrammkarte einen Knopf, der das Diagramm als PNG speichert.
 *
 * Wird einmal beim Start aufgerufen. Die Knoepfe lesen das Diagramm erst beim
 * Klick aus, deshalb stoert es nicht, dass zu diesem Zeitpunkt noch keines
 * gezeichnet ist.
 */
export function attachChartExports(): void {
  for (const card of document.querySelectorAll<HTMLElement>('.chart-card')) {
    const canvas = card.querySelector('canvas');
    const title = card.querySelector('.chart-title');
    if (!canvas || !title || card.querySelector('.chart-export')) continue;

    const button = document.createElement('button');
    button.className = 'btn chart-export';
    button.type = 'button';
    button.textContent = 'PNG';
    button.style.cssText = 'float:right;padding:2px 8px;font-size:10px;margin-top:-2px';
    button.setAttribute('aria-label', `Diagramm ${title.textContent ?? ''} als Bild speichern`);

    button.addEventListener('click', () => {
      const chart = getChart(canvas.id);
      if (!chart) return;
      download(`${canvas.id}-${stamp()}.png`, chart.toBase64Image('image/png', 1));
    });

    title.append(button);
  }
}
