/**
 * Content Security Policy der gebauten Seite. Sie steht als `meta` Element im
 * `index.html` des Builds, weil GitHub Pages keine eigenen Kopfzeilen setzt.
 * Im Entwicklungsmodus fehlt sie, Vite liefert dort Inline Skripte aus.
 *
 * `connect-src` begrenzt, wohin ein eingeschleustes Skript Daten schicken
 * koennte, siehe ADR 0004. Inline Styles bleiben vorerst erlaubt, `index.html`
 * traegt `style` Attribute.
 */

/**
 * Das Apps Script nimmt den POST unter script.google.com an und leitet die
 * Antwort auf script.googleusercontent.com um, beide Hosts braucht `fetch`
 * (Training eintragen, ADR 0007).
 */
export const CSP_CONNECT_HOSTS: readonly string[] = [
  'https://sheets.googleapis.com',
  'https://api.anthropic.com',
  'https://script.google.com',
  'https://script.googleusercontent.com',
];

export const CSP_DIRECTIVES: Readonly<Record<string, readonly string[]>> = {
  'default-src': ["'self'"],
  'script-src': ["'self'"],
  'style-src': ["'self'", "'unsafe-inline'"],
  'img-src': ["'self'", 'data:', 'blob:'],
  'font-src': ["'self'"],
  'connect-src': ["'self'", ...CSP_CONNECT_HOSTS],
  'object-src': ["'none'"],
  'base-uri': ["'self'"],
  'form-action': ["'none'"],
  // Service Worker und Manifest der App Huelle, nur von der eigenen Herkunft (ADR 0006).
  'worker-src': ["'self'"],
  'manifest-src': ["'self'"],
};

export function buildCsp(directives: Readonly<Record<string, readonly string[]>> = CSP_DIRECTIVES): string {
  return Object.entries(directives)
    .map(([name, sources]) => `${name} ${sources.join(' ')}`)
    .join('; ');
}

/** Das `meta` Element fuer den Kopf der Seite. */
export function cspMetaTag(policy: string = buildCsp()): string {
  return `<meta http-equiv="Content-Security-Policy" content="${policy}">`;
}
