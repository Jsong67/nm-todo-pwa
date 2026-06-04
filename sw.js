const CACHE = 'nm-todo-v2';
const ASSETS = ['./index.html', './app.css', './app.js', './gist.js', './icon128.png', './icon48.png'];

self.addEventListener('install', e => { self.skipWaiting(); e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS))); });
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))));
self.addEventListener('fetch', e => {
  if (e.request.url.includes('api.github.com')) return; // don't cache API calls
  e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
});
