/// <reference lib="webworker" />
/**
 * Service Worker der App Huelle, gebaut von `vite-plugin-pwa` (injectManifest).
 *
 * Updateweg: kein `skipWaiting`. Eine neue Version wartet, bis keine Seite der
 * alten mehr offen ist, und nimmt ihr damit keine nachgeladenen Chunks weg.
 * Navigationen gehen trotzdem zuerst ans Netz, der naechste Start mit Netz
 * zeigt also die neue Version. Deren Chunks kommen dann ueber `asset` aus dem
 * Netz, bis die neue Version aktiv ist und sie vorab im Cache hat.
 */
import { cleanupOutdatedCaches, matchPrecache, precacheAndRoute } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { CacheFirst, NetworkFirst, NetworkOnly } from 'workbox-strategies';
import { classifyRequest, type RequestKind } from './pwa/policy';

declare const self: ServiceWorkerGlobalScope;

const ASSET_CACHE = 'assets-runtime';
const DATA_CACHE = 'data';
const INDEX_HTML = 'index.html';
/** Danach gilt das Netz als weg und die App startet aus dem Cache. */
const NETWORK_TIMEOUT_S = 4;

const isKind = (kind: RequestKind) => ({ request }: { request: Request }): boolean =>
  classifyRequest(request, self.registration.scope) === kind;

const pageFromNetwork = new NetworkOnly({ networkTimeoutSeconds: NETWORK_TIMEOUT_S });

// Vor der Precache Route registriert, sonst kaeme `index.html` immer aus dem Cache.
registerRoute(isKind('page'), async (options) => {
  try {
    return await pageFromNetwork.handle(options);
  } catch (error) {
    const cached = await matchPrecache(INDEX_HTML);
    if (cached) return cached;
    throw error;
  }
});

precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

registerRoute(isKind('asset'), new CacheFirst({ cacheName: ASSET_CACHE }));
registerRoute(isKind('data'), new NetworkFirst({ cacheName: DATA_CACHE, networkTimeoutSeconds: NETWORK_TIMEOUT_S }));

// Die aktive Version hat alle eigenen Assets vorab im Cache. Was eine neuere
// Seite vorher aus dem Netz geholt hat, ist damit ueberzaehlig.
self.addEventListener('activate', (event) => {
  event.waitUntil(caches.delete(ASSET_CACHE));
});
