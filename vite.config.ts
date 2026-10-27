import { defineConfig } from 'vite';
import type { Plugin } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { cspMetaTag } from './src/config/csp';
import { APP_NAME, BOARD_COLOR, MANIFEST_ICONS } from './src/config/pwa';

/** CSP nur im Build. Im Dev Modus liefert Vite Inline Skripte, die sie blockieren wuerde. */
function contentSecurityPolicy(): Plugin {
  return {
    name: 'content-security-policy',
    apply: 'build',
    transformIndexHtml: (html) => html.replace('<meta charset="UTF-8">', `<meta charset="UTF-8">\n${cspMetaTag()}`),
  };
}

/**
 * App Huelle als PWA (ADR 0006). Eigener Service Worker `src/sw.ts`, damit die
 * Regel fuer erlaubte URLs eine testbare Funktion ist. Vorab gecacht werden nur
 * eigene Dateien, keine Sourcemaps, keine Fixtures unter `preview/`.
 */
function progressiveWebApp(): Plugin[] {
  return VitePWA({
    strategies: 'injectManifest',
    srcDir: 'src',
    filename: 'sw.ts',
    injectRegister: 'script-defer',
    registerType: 'prompt',
    manifest: {
      name: APP_NAME,
      short_name: APP_NAME,
      lang: 'de',
      display: 'standalone',
      background_color: BOARD_COLOR,
      theme_color: BOARD_COLOR,
      icons: [...MANIFEST_ICONS],
    },
    injectManifest: {
      globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
      globIgnores: ['preview/**'],
    },
  });
}

// Die Seite wird unter https://me.nahobinoco.com/fitness-dashboard/ ausgeliefert.
// Ohne diesen Basispfad zeigen alle Asset Verweise auf die Domainwurzel und die
// Seite bleibt weiss.
export default defineConfig({
  base: '/fitness-dashboard/',
  plugins: [contentSecurityPolicy(), progressiveWebApp()],
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        // Der nachgeladene Einstieg `src/charts/index.ts` heisst sonst `index`. Nur
        // umbenannt, nicht per `manualChunks`: das zoege gemeinsam genutzte Module
        // wie `ui/format` mit hinein und der Haupt Chunk muesste ihn sofort laden.
        chunkFileNames: (chunk) => {
          const facade = chunk.facadeModuleId ?? '';
          if (/[\\/]src[\\/]charts[\\/]index\.ts$/.test(facade)) return 'assets/charts-[hash].js';
          if (/[\\/]src[\\/]log[\\/]index\.ts$/.test(facade)) return 'assets/log-[hash].js';
          return 'assets/[name]-[hash].js';
        },
      },
    },
  },
});
