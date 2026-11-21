// Zouzous Club — Service Worker.
// Les pages, sessions et données privées ne sont jamais mises en cache.

const CACHE = 'zouzous-club-assets-v38';

const STATIC = [
    './icon.svg',
    './disco.svg',
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

// Notifications reçues même lorsque l’application n’est pas ouverte.
self.addEventListener('push', (event) => {
    let data = {};
    try {
        data = event.data ? event.data.json() : {};
    } catch (error) {
        data = { body: event.data?.text() || 'Un événement a été ajouté.' };
    }
    const title = String(data.title || 'Zouzous Club');
    const body = String(data.body || 'Un nouvel événement est disponible.');
    event.waitUntil(self.registration.showNotification(title, {
        body,
        icon: './icon-192.png',
        badge: './icon-192.png',
        tag: data.tag || 'zouzous-evenement',
        data: { url: './' }
    }));
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    event.waitUntil((async () => {
        const url = new URL(event.notification.data?.url || './', self.registration.scope).href;
        const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
        for (const windowClient of windows) {
            if (windowClient.url.startsWith(self.registration.scope)) {
                await windowClient.focus();
                return;
            }
        }
        await self.clients.openWindow(url);
    })());
});
