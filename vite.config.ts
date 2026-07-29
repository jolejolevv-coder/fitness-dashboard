import { defineConfig } from 'vite';

// Die Seite wird unter https://me.nahobinoco.com/fitness-dashboard/ ausgeliefert.
// Ohne diesen Basispfad zeigen alle Asset Verweise auf die Domainwurzel und die
// Seite bleibt weiss.
export default defineConfig({
  base: '/fitness-dashboard/',
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});
