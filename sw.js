// Ne met jamais en cache les réponses Supabase, les sessions ou les pages HTML authentifiées.
const CACHE = 'zouzous-club-assets-v5';
const STATIC = ['./icon.svg', './icon-180.png', './icon-192.png', './icon-512.png', './manifest.webmanifest'];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(STATIC)));
  self.skipWaiting();
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))));
  self.clients.claim();
});
self.addEventListener('fetch', event => {
  // Mode réseau uniquement : pas de copie hors ligne des pages ou données privées.
  if (event.request.mode === 'navigate') return;
  if (!STATIC.some(path => new URL(path, self.registration.scope).href === event.request.url)) return;
  event.respondWith(caches.match(event.request).then(hit => hit || fetch(event.request)));
});
