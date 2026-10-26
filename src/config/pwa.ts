/**
 * Web App Manifest. Name ohne Klarnamen. Farbe `board` aus `DESIGN.md`, die
 * helle Grundform, damit Startbildschirm und erste Seite gleich aussehen.
 */
export const APP_NAME = 'Body Recomp';
export const BOARD_COLOR = '#eceeed';

export const MANIFEST_ICONS = [
  { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
  { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
  { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
  { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
] as const;
