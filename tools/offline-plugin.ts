import { createHash } from 'node:crypto';
import type { Plugin } from 'vite';

// Each worker pins a complete immutable build, including the lazily loaded 3D engine.
export function offlinePlugin(): Plugin {
  return {
    name: 'riftcasters-offline',
    apply: 'build',
    enforce: 'post',
    generateBundle(_options, bundle) {
      const files = Object.keys(bundle).filter(
        (name) => !name.endsWith('.map'),
      );
      const version = createHash('sha256')
        .update(files.sort().join('|'))
        .digest('hex')
        .slice(0, 14);
      const assets = [
        ...new Set([
          '/',
          '/favicon.svg',
          '/manifest.webmanifest',
          ...files.map((name) => `/${name}`),
        ]),
      ];
      this.emitFile({
        type: 'asset',
        fileName: 'sw.js',
        source: `
const CACHE = 'riftcasters-${version}';
const ASSETS = ${JSON.stringify(assets)};
self.addEventListener('install', (event) => event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS.map((url) => new Request(url, { cache: 'reload' }))))));
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
self.addEventListener('message', (event) => {
  if (event.data === 'ACTIVATE_UPDATE') self.skipWaiting();
});
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin || url.pathname === '/sw.js') return;
  if (event.request.mode === 'navigate' && (url.pathname === '/' || url.pathname === '/index.html')) {
    event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (clients) => {
      if (clients.length <= 1) await Promise.all((await caches.keys()).filter((key) => key.startsWith('riftcasters-') && key !== CACHE).map((key) => caches.delete(key)));
    }));
    event.respondWith(caches.open(CACHE).then((cache) => cache.match('/')).then((response) => response ? new Response(response.body, { status: response.status, statusText: response.statusText, headers: response.headers }) : fetch(event.request)));
  } else {
    // Only public build files are cached. Preview/CDN Vary: Origin must not make
    // module scripts miss the precache when the browser adds its Origin header.
    event.respondWith(caches.open(CACHE).then((cache) => cache.match(event.request, { ignoreVary: true })).then(async (response) => response || await caches.match(event.request, { ignoreVary: true }) || fetch(event.request)));
  }
});
`,
      });
    },
  };
}
