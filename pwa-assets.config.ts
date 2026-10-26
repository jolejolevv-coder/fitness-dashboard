import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config';

/**
 * Icons der installierbaren App aus Icon B (`public/icon.svg`), erzeugt mit
 * `npm run icons` und als PNG committet. Die Vorlage traegt ihren Schiefergrund
 * selbst, darum ohne Rand. Nur das maskierbare Icon bekommt Rand, damit Linie
 * und Magnet im runden Ausschnitt von Android bleiben.
 */
const SLATE = '#1b1e20';
const MASKABLE_PADDING = 0.3;

export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset: {
    ...minimal2023Preset,
    transparent: { ...minimal2023Preset.transparent, padding: 0 },
    maskable: { ...minimal2023Preset.maskable, padding: MASKABLE_PADDING, resizeOptions: { background: SLATE } },
    apple: { ...minimal2023Preset.apple, padding: 0, resizeOptions: { background: SLATE } },
  },
  images: ['public/icon.svg'],
});
