/* Offline: precache the page and its data; cache map tiles as they are viewed or saved. */
var VERSION = 'gr52-v1';
var PRECACHE = ['/', '/index.html', '/GR52_all-in-one.gpx', '/map.js', '/vendor/leaflet.min.js', '/vendor/leaflet.min.css',
  '/vendor/images/layers.png', '/vendor/images/layers-2x.png', '/manifest.webmanifest', '/icon.svg'];
self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(VERSION).then(function (c) { return c.addAll(PRECACHE); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== VERSION && k !== 'tiles'; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  var url = new URL(e.request.url);
  if (url.hostname.endsWith('tile.opentopomap.org')) {
    e.respondWith(caches.open('tiles').then(function (c) {
      return c.match(e.request, { ignoreVary: true }).then(function (hit) {
        if (hit) return hit;
        return fetch(e.request).then(function (res) { if (res && (res.ok || res.type === 'opaque')) c.put(e.request, res.clone()); return res; });
      });
    }));
    return;
  }
  if (url.origin === location.origin && e.request.method === 'GET') {
    e.respondWith(caches.open(VERSION).then(function (c) {
      return c.match(e.request).then(function (hit) {
        var net = fetch(e.request).then(function (res) { if (res && res.ok && url.pathname.indexOf('/maps/') !== 0) c.put(e.request, res.clone()); return res; }).catch(function () { return hit; });
        return hit || net;
      });
    }));
  }
});
