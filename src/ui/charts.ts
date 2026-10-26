/**
 * Laedt die Diagramme samt Chart.js als eigenen Chunk.
 *
 * `Heute` und `Kueche` zeichnen keine Diagramme und starten ohne Chart.js. Der
 * erste Wechsel auf `Verlauf` oder `Training` holt den Chunk einmal, danach
 * liegt das Modul bereit.
 */

export type Charts = typeof import('../charts/index');

let pending: Promise<Charts> | null = null;
let loaded: Charts | null = null;

/** Scheitert der Abruf, etwa offline vor dem ersten Laden, versucht der naechste Aufruf es erneut. */
export function loadCharts(): Promise<Charts> {
  pending ??= import('../charts/index').then(
    (module) => {
      loaded = module;
      return module;
    },
    (error: unknown) => {
      pending = null;
      throw error;
    },
  );
  return pending;
}

/** Das Modul, falls schon geladen. Ohne geladenes Modul gibt es auch kein Diagramm. */
export function loadedCharts(): Charts | null {
  return loaded;
}
