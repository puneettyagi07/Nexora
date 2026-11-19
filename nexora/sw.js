/* ==========================================================================
   NEXORA - PROGRESSIVE WEB APP SERVICE WORKER (sw.js)
   Provides offline support via Pre-Caching + Network-First / Cache-Fallback
   ========================================================================== */

const CACHE_NAME = 'nexora-pwa-cache-v1';

const CORE_ASSETS = [
  './',
  './index.html',
  './login.html',
  './signup.html',
  './manifest.json',
  './assets/icons/icon.svg',
  './css/variables.css',
  './css/style.css',
  './css/dashboard.css',
  './css/components.css',
  './css/forms.css',
  './css/kanban.css',
  './css/calendar.css',
  './css/analytics.css',
  './css/responsive.css',
  './js/app.js',
  './js/auth.js',
  './js/storage.js',
  './js/utils.js',
  './js/dashboard.js',
  './js/projects.js',
  './js/tasks.js',
  './js/kanban.js',
  './js/calendar.js',
  './js/team.js',
  './js/notifications.js',
  './js/analytics.js',
  './js/search.js',
  './js/settings.js',
  './js/tutorial.js',
  './js/shortcuts.js',
  './js/pwa.js'
];

// Install: Pre-cache core application shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS))
  );
  self.skipWaiting();
});

// Activate: Remove old caches when a new version deploys
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((oldKey) => caches.delete(oldKey))
      )
    )
  );
  self.clients.claim();
});

// Fetch: Network-First for navigations & local files, Cache-Fallback when offline
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  if (!url.protocol.startsWith('http')) return;

  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return networkResponse;
      })
      .catch(async () => {
        const cached = await caches.match(event.request);
        if (cached) return cached;
        if (event.request.mode === 'navigate') {
          return caches.match('./login.html');
        }
        return new Response('Offline', { status: 503, statusText: 'Offline' });
      })
  );
});