const CACHE_NAME = 'fitness-v11';
const ASSETS = [
  './',
  './index.html',
  './css/style.css',
  './js/firebase-config.js',
  './js/app.js',
  './js/gps.js',
  './js/storage.js',
  './js/chart.js',
  './js/calories.js',
  './manifest.json'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Network First: 네트워크에서 최신 파일을 가져오고, 실패 시 캐시 사용
self.addEventListener('fetch', e => {
  e.respondWith(
    fetch(e.request)
      .then(res => {
        const clone = res.clone();
        caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
