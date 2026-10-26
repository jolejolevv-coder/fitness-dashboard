import { defineConfig } from 'vite';
import type { Plugin } from 'vite';
import { cspMetaTag } from './src/config/csp';

/** CSP nur im Build. Im Dev Modus liefert Vite Inline Skripte, die sie blockieren wuerde. */
function contentSecurityPolicy(): Plugin {
  return {
    name: 'content-security-policy',
    apply: 'build',
    transformIndexHtml: (html) => html.replace('<meta charset="UTF-8">', `<meta charset="UTF-8">\n${cspMetaTag()}`),
  };
}

// Die Seite wird unter https://me.nahobinoco.com/fitness-dashboard/ ausgeliefert.
// Ohne diesen Basispfad zeigen alle Asset Verweise auf die Domainwurzel und die
// Seite bleibt weiss.
export default defineConfig({
  base: '/fitness-dashboard/',
  plugins: [contentSecurityPolicy()],
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        // Der nachgeladene Einstieg `src/charts/index.ts` heisst sonst `index`. Nur
        // umbenannt, nicht per `manualChunks`: das zoege gemeinsam genutzte Module
        // wie `ui/format` mit hinein und der Haupt Chunk muesste ihn sofort laden.
        chunkFileNames: (chunk) => (/[\\/]src[\\/]charts[\\/]index\.ts$/.test(chunk.facadeModuleId ?? '')
          ? 'assets/charts-[hash].js'
          : 'assets/[name]-[hash].js'),
      },
    },
  },
});
