// Zouzous Club — Service Worker.
// Les pages, sessions et données privées ne sont jamais mises en cache.

const CACHE = 'zouzous-club-assets-v19';

const STATIC = [
    './icon.svg',
    './icon-180.png',
    './icon-192.png',
    './icon-512.png',
    './manifest.webmanifest'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE).then((cache) => {
            return cache.addAll(STATIC);
        })
    );

    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            const anciensCaches = keys.filter((key) => key !== CACHE);

            return Promise.all(
                anciensCaches.map((key) => caches.delete(key))
            );
        })
    );

    self.clients.claim();
});

self.addEventListener('fetch', (event) => {
    // Les pages HTML et les requêtes privées restent en mode réseau uniquement.
    if (event.request.mode === 'navigate') {
        return;
    }

    const ressourceStatique = STATIC.some((path) => {
        const url = new URL(path, self.registration.scope);
        return url.href === event.request.url;
    });

    if (!ressourceStatique) {
        return;
    }

    event.respondWith(
        caches.match(event.request).then((reponseCache) => {
            return reponseCache || fetch(event.request);
        })
    );
});
