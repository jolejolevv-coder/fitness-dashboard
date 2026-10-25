/**
 * Content Security Policy der gebauten Seite. Sie steht als `meta` Element im
 * `index.html` des Builds, weil GitHub Pages keine eigenen Kopfzeilen setzt.
 * Im Entwicklungsmodus fehlt sie, Vite liefert dort Inline Skripte aus.
 *
 * `connect-src` begrenzt, wohin ein eingeschleustes Skript Daten schicken
 * koennte, siehe ADR 0004. Inline Styles bleiben vorerst erlaubt, `index.html`
 * traegt `style` Attribute.
 */

export const CSP_CONNECT_HOSTS: readonly string[] = ['https://sheets.googleapis.com', 'https://api.anthropic.com'];

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
