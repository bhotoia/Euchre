// Service worker — precache app shell, network-first so updates flow when online,
// cache fallback for full offline play.
const CACHE = 'euchre-v54';
const SHELL = [
  './',
  'index.html',
  'css/style.css',
  'js/main.js',
  'js/ui.js',
  'js/engine.js',
  'js/ai.js',
  'js/cards.js',
  'js/coach.js',
  'js/coach.worker.js',
  'js/coach-client.js',
  'js/stats.js',
  'js/profile.js',
  'js/cosmetics.js',
  'js/tournaments.js',
  'js/daily.js',
  'js/events.js',
  'js/juice.js',
  'js/personalities.js',
  'js/portraits.js',
  'js/rivals.js',
  'js/career.js',
  'js/allies.js',
  'manifest.json',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/apple-touch-icon.png',
  'icons/ios-launch/iphone-se-750x1334.png',
  'icons/ios-launch/iphone-x-1125x2436.png',
  'icons/ios-launch/iphone-11-828x1792.png',
  'icons/ios-launch/iphone-12-1170x2532.png',
  'icons/ios-launch/iphone-15-1179x2556.png',
  'icons/ios-launch/iphone-16-pro-1206x2622.png',
  'icons/ios-launch/iphone-plus-1284x2778.png',
  'icons/ios-launch/iphone-plus-1290x2796.png',
  'icons/ios-launch/iphone-16-pro-max-1320x2868.png',
];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).catch(() => {}));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(e.request).then((r) => r || caches.match('index.html')))
  );
});
