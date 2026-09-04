/* Offline: precache the page and its data; cache map tiles and fonts as they are used or saved. */
var VERSION = 'gr52-09e4eca023fe';
var PRECACHE = ['/', '/GR52_all-in-one.gpx', '/map.js', '/vendor/leaflet.min.js', '/vendor/leaflet.min.css',
  '/vendor/images/layers.png', '/vendor/images/layers-2x.png', '/manifest.webmanifest', '/icon.svg',
  '/maps/overview.webp', '/maps/north.webp', '/maps/merv.webp', '/maps/authion.webp', '/maps/menton.webp'];
self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(VERSION).then(function (c) { return c.addAll(PRECACHE); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== VERSION && k !== 'tiles' && k !== 'fonts'; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
function cacheFirst(cacheName, req) {
  return caches.open(cacheName).then(function (c) {
    return c.match(req, { ignoreVary: true }).then(function (hit) {
      if (hit) return hit;
      return fetch(req).then(function (res) { if (res && res.ok) c.put(req, res.clone()); return res; });
    });
  });
}
self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  var url = new URL(e.request.url);
  if (url.hostname.endsWith('tile.opentopomap.org')) { e.respondWith(cacheFirst('tiles', e.request)); return; }
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') { e.respondWith(cacheFirst('fonts', e.request).catch(function () { return Response.error(); })); return; }
  if (url.origin === location.origin) {
    e.respondWith(caches.open(VERSION).then(function (c) {
      return c.match(e.request, { ignoreSearch: true }).then(function (hit) {
        var net = fetch(e.request).then(function (res) { if (res && res.ok) c.put(e.request, res.clone()); return res; }).catch(function () { return hit; });
        return hit || net;
      });
    }));
  }
});
