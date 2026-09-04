/* GR52 map app: draws the real GPX, elevation profile, live position, offline tiles. */
(function () {
  'use strict';
  var GPX = '/GR52_all-in-one.gpx';
  var TILES = 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png';
  var I18N = {
    en: {
      nights: 'Nights, refuges, finish', water: 'Water', passes: 'Passes and summits', side: 'Side-trip summits',
      ferrata: 'Via ferrata points', escape: 'Escapes, bus, emergency', other: 'Shelters, campsites, lakes',
      locate: 'Where am I', locating: 'Locating…', stopLocate: 'Stop following', save: 'Save this area offline',
      saving: 'Saving tiles', saved: 'Saved for offline: ', tilesTooMany: 'Zoom in: too many tiles for one save (max 600).',
      noGeo: 'Location is not available in this browser.', offRoute: 'off route', toNext: 'to', ascent: 'ascent',
      descent: 'descent', total: 'Route', km: 'km', m: 'm', offline: 'Offline: page, GPX and saved tiles are available.',
      alt: 'alt', loading: 'Loading GPX…', ready: 'GPX loaded: ', tracks: 'tracks', wpts: 'waypoints'
    },
    he: {
      nights: 'לילות, בקתות, סיום', water: 'מים', passes: 'מעברים ופסגות', side: 'פסגות סטיות צד',
      ferrata: 'נקודות ויה פראטה', escape: 'יציאות, אוטובוס, חירום', other: 'מחסות, קמפינגים, אגמים',
      locate: 'איפה אני', locating: 'מאתר…', stopLocate: 'הפסק מעקב', save: 'שמור אזור זה לאופליין',
      saving: 'שומר אריחים', saved: 'נשמר לאופליין: ', tilesTooMany: 'התקרבו: יותר מדי אריחים לשמירה אחת (מקסימום 600).',
      noGeo: 'מיקום לא זמין בדפדפן הזה.', offRoute: 'מחוץ למסלול', toNext: 'עד', ascent: 'עלייה',
      descent: 'ירידה', total: 'המסלול', km: 'ק"מ', m: 'מ\'', offline: 'אופליין: הדף, ה-GPX והאריחים השמורים זמינים.',
      alt: 'גובה', loading: 'טוען GPX…', ready: 'GPX נטען: ', tracks: 'מסלולים', wpts: 'נקודות'
    }
  };
  var CAT = { Night: 'nights', Flag: 'nights', Lodging: 'nights', Restaurant: 'nights', Water: 'water', Summit: 'passes',
    SideTrip: 'side', ViaFerrata: 'ferrata', Escape: 'escape', Transport: 'escape', Info: 'escape', Campsite: 'other', Shelter: 'other' };
  var DEFAULT_ON = { nights: true, water: true };

  function hav(a, b) {
    var R = 6371000, dLat = (b.lat - a.lat) * Math.PI / 180, dLon = (b.lon - a.lon) * Math.PI / 180;
    var s = Math.sin(dLat / 2), t = Math.sin(dLon / 2);
    var h = s * s + Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * t * t;
    return 2 * R * Math.asin(Math.sqrt(h));
  }
  function text(el, tag) { var n = el.getElementsByTagName(tag)[0]; return n ? n.textContent : ''; }

  function parseGpx(xmlText) {
    var x = new DOMParser().parseFromString(xmlText, 'application/xml');
    var tracks = Array.prototype.map.call(x.getElementsByTagName('trk'), function (trk) {
      var name = text(trk, 'name');
      return {
        name: name, color: text(trk, 'osmand:color') || '#C8322B',
        kind: name.indexOf('ROUTE') === 0 ? 'route' : name.indexOf('PARK') === 0 ? 'boundary' : name.indexOf('SIDE') === 0 ? 'side' : 'ferrata',
        segs: Array.prototype.map.call(trk.getElementsByTagName('trkseg'), function (s) {
          return Array.prototype.map.call(s.getElementsByTagName('trkpt'), function (p) {
            var e = p.getElementsByTagName('ele')[0];
            return { lat: +p.getAttribute('lat'), lon: +p.getAttribute('lon'), ele: e ? +e.textContent : null };
          });
        })
      };
    });
    var wpts = Array.prototype.map.call(x.getElementsByTagName('wpt'), function (w) {
      return { lat: +w.getAttribute('lat'), lon: +w.getAttribute('lon'), name: text(w, 'name'), type: text(w, 'type'), color: text(w, 'osmand:color') || '#6B7775' };
    });
    return { tracks: tracks, wpts: wpts };
  }

  /* Concatenate the ROUTE tracks in order into one line with cumulative distance. */
  function buildRoute(tracks) {
    var pts = [], d = 0, prev = null;
    tracks.filter(function (t) { return t.kind === 'route'; }).forEach(function (t) {
      t.segs.forEach(function (seg) {
        seg.forEach(function (p) {
          if (prev) d += hav(prev, p);
          pts.push({ lat: p.lat, lon: p.lon, ele: p.ele, d: d });
          prev = p;
        });
      });
    });
    var asc = 0, desc = 0, last = null;
    pts.forEach(function (p) {
      if (p.ele == null) return;
      if (last != null) { var dz = p.ele - last; if (Math.abs(dz) >= 5) { if (dz > 0) asc += dz; else desc -= dz; last = p.ele; } }
      else last = p.ele;
    });
    return { pts: pts, length: d, ascent: asc, descent: desc };
  }
  function nearestOnRoute(route, p) {
    var best = null;
    route.pts.forEach(function (q, i) { var dd = hav(p, q); if (!best || dd < best.dist) best = { dist: dd, i: i, pt: q }; });
    return best;
  }

  function shortTrackName(name) {
    var parts = name.split(' · ');
    return parts.length > 2 ? parts[0] + ' · ' + parts[1] : name;
  }

  var data = null, route = null, apps = {};

  function build(container) {
    var lang = container.getAttribute('data-map');
    if (apps[lang]) return apps[lang];
    var T = I18N[lang];
    var mapEl = container.querySelector('.livemap');
    var status = container.querySelector('.mapstatus');
    var map = L.map(mapEl, { scrollWheelZoom: false, zoomSnap: 0.5 });
    L.tileLayer(TILES, { maxZoom: 17, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>, SRTM &middot; &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (CC-BY-SA)' }).addTo(map);

    var overlays = {}, routeGroup = L.featureGroup();
    data.tracks.forEach(function (t) {
      var g = L.layerGroup();
      t.segs.forEach(function (seg) {
        L.polyline(seg.map(function (p) { return [p.lat, p.lon]; }), {
          color: t.color, weight: t.kind === 'route' ? 4 : 3, opacity: t.kind === 'boundary' ? .75 : .95, dashArray: t.kind === 'boundary' ? '6 6' : null
        }).bindPopup(t.name).addTo(g);
      });
      overlays[shortTrackName(t.name)] = g;
      if (t.kind === 'route') { g.addTo(map); g.eachLayer(function (l) { routeGroup.addLayer(l); }); }
    });
    var cats = {};
    data.wpts.forEach(function (w) {
      var c = CAT[w.type] || 'other';
      cats[c] = cats[c] || L.layerGroup();
      L.circleMarker([w.lat, w.lon], { radius: c === 'nights' ? 7 : 5, color: '#fff', weight: 1.5, fillColor: w.color, fillOpacity: 1 }).bindPopup(w.name).addTo(cats[c]);
    });
    ['nights', 'water', 'passes', 'side', 'ferrata', 'escape', 'other'].forEach(function (c) {
      if (!cats[c]) return; overlays[T[c]] = cats[c]; if (DEFAULT_ON[c]) cats[c].addTo(map);
    });
    L.control.layers(null, overlays, { collapsed: true }).addTo(map);
    map.fitBounds(routeGroup.getBounds(), { padding: [12, 12] });

    /* elevation profile */
    var canvas = container.querySelector('canvas.profile'), hoverMarker = null;
    var nights = data.wpts.filter(function (w) { return w.type === 'Night' || w.type === 'Flag'; })
      .map(function (w) { var n = nearestOnRoute(route, w); return { w: w, d: n.pt.d, ele: n.pt.ele }; }).sort(function (a, b) { return a.d - b.d; });
    function drawProfile(hoverX) {
      var dpr = window.devicePixelRatio || 1, W = canvas.clientWidth, H = canvas.clientHeight;
      canvas.width = W * dpr; canvas.height = H * dpr;
      var ctx = canvas.getContext('2d'); ctx.scale(dpr, dpr);
      var cs = getComputedStyle(document.documentElement);
      var ink = cs.getPropertyValue('--ink').trim(), muted = cs.getPropertyValue('--muted').trim(), line = cs.getPropertyValue('--line').trim(),
        mark = cs.getPropertyValue('--mark').trim(), lake = cs.getPropertyValue('--lake').trim(), soft = cs.getPropertyValue('--lake-soft').trim();
      var L0 = 44, R0 = 10, T0 = 12, B0 = 24, maxD = route.length, maxE = 3000;
      var x = function (d) { return L0 + d / maxD * (W - L0 - R0); }, y = function (e) { return T0 + (1 - e / maxE) * (H - T0 - B0); };
      ctx.clearRect(0, 0, W, H);
      ctx.font = '11px IBM Plex Mono, monospace'; ctx.fillStyle = muted; ctx.strokeStyle = line; ctx.lineWidth = 1;
      [0, 1000, 2000, 3000].forEach(function (e) { ctx.beginPath(); ctx.moveTo(L0, y(e)); ctx.lineTo(W - R0, y(e)); ctx.stroke(); ctx.textAlign = 'right'; ctx.fillText(e + ' ' + T.m, L0 - 6, y(e) + 4); });
      for (var k = 0; k <= maxD / 1000; k += 20) { ctx.textAlign = 'center'; ctx.fillText(k + ' ' + T.km, x(k * 1000), H - 8); }
      ctx.beginPath(); var started = false;
      route.pts.forEach(function (p) { if (p.ele == null) return; var px = x(p.d), py = y(p.ele); if (!started) { ctx.moveTo(px, py); started = true; } else ctx.lineTo(px, py); });
      var pathEnd = ctx; ctx.lineTo(x(maxD), y(0)); ctx.lineTo(x(0), y(0)); ctx.closePath(); ctx.fillStyle = soft; ctx.fill();
      ctx.beginPath(); started = false;
      route.pts.forEach(function (p) { if (p.ele == null) return; var px = x(p.d), py = y(p.ele); if (!started) { ctx.moveTo(px, py); started = true; } else ctx.lineTo(px, py); });
      ctx.strokeStyle = lake; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.font = '500 11px IBM Plex Sans, sans-serif';
      nights.forEach(function (n, i) {
        var px = x(n.d), py = y(n.ele || 0);
        ctx.beginPath(); ctx.arc(px, py, 4.5, 0, 7); ctx.fillStyle = mark; ctx.fill();
        ctx.fillStyle = ink; ctx.textAlign = i === nights.length - 1 ? 'right' : 'center';
        ctx.fillText(n.w.name.split(' · ')[0].replace('NIGHT ', 'N'), px, py - 9);
      });
      if (hoverX != null) {
        var d = Math.max(0, Math.min(maxD, (hoverX - L0) / (W - L0 - R0) * maxD)), lo = 0, hi = route.pts.length - 1;
        while (lo < hi) { var mid = (lo + hi) >> 1; if (route.pts[mid].d < d) lo = mid + 1; else hi = mid; }
        var p = route.pts[lo];
        ctx.strokeStyle = mark; ctx.beginPath(); ctx.moveTo(x(d), T0); ctx.lineTo(x(d), H - B0); ctx.stroke();
        ctx.fillStyle = ink; ctx.textAlign = x(d) > W / 2 ? 'right' : 'left';
        ctx.fillText((d / 1000).toFixed(1) + ' ' + T.km + ' · ' + (p.ele == null ? '' : p.ele + ' ' + T.m), x(d) + (x(d) > W / 2 ? -6 : 6), T0 + 12);
        if (!hoverMarker) hoverMarker = L.circleMarker([p.lat, p.lon], { radius: 7, color: mark, weight: 3, fillColor: '#fff', fillOpacity: 1 }).addTo(map);
        else hoverMarker.setLatLng([p.lat, p.lon]);
      }
    }
    function hover(ev) { var r = canvas.getBoundingClientRect(); var cx = (ev.touches ? ev.touches[0].clientX : ev.clientX) - r.left; drawProfile(cx); if (ev.touches) ev.preventDefault(); }
    canvas.addEventListener('mousemove', hover); canvas.addEventListener('touchstart', hover, { passive: false }); canvas.addEventListener('touchmove', hover, { passive: false });
    canvas.addEventListener('mouseleave', function () { drawProfile(null); if (hoverMarker) { map.removeLayer(hoverMarker); hoverMarker = null; } });
    var stats = container.querySelector('.profstats');
    stats.textContent = T.total + ' ' + (route.length / 1000).toFixed(1) + ' ' + T.km + ' · ' + T.ascent + ' ' + Math.round(route.ascent) + ' ' + T.m + ' · ' + T.descent + ' ' + Math.round(route.descent) + ' ' + T.m + ' · EU-DEM 25 m';
    drawProfile(null);
    window.addEventListener('resize', function () { drawProfile(null); });

    /* live position */
    var locBtn = container.querySelector('[data-act="locate"]'), meMarker = null, meCircle = null, watching = false;
    locBtn.textContent = T.locate;
    locBtn.addEventListener('click', function () {
      if (!navigator.geolocation) { status.textContent = T.noGeo; return; }
      if (watching) { map.stopLocate(); watching = false; locBtn.textContent = T.locate; return; }
      watching = true; locBtn.textContent = T.stopLocate; status.textContent = T.locating;
      map.locate({ watch: true, enableHighAccuracy: true, setView: false });
    });
    map.on('locationfound', function (e) {
      var me = { lat: e.latlng.lat, lon: e.latlng.lng };
      if (!meMarker) { meMarker = L.circleMarker(e.latlng, { radius: 8, color: '#fff', weight: 2, fillColor: '#1E6FD9', fillOpacity: 1 }).addTo(map); meCircle = L.circle(e.latlng, { radius: e.accuracy, weight: 1, color: '#1E6FD9', fillOpacity: .08 }).addTo(map); map.setView(e.latlng, Math.max(map.getZoom(), 14)); }
      else { meMarker.setLatLng(e.latlng); meCircle.setLatLng(e.latlng).setRadius(e.accuracy); }
      var n = nearestOnRoute(route, me), next = null;
      for (var i = 0; i < nights.length; i++) if (nights[i].d > n.pt.d + 200) { next = nights[i]; break; }
      var s = (n.dist > 150 ? Math.round(n.dist) + ' ' + T.m + ' ' + T.offRoute + ' · ' : '') + (n.pt.d / 1000).toFixed(1) + ' ' + T.km;
      if (next) s += ' · ' + ((next.d - n.pt.d) / 1000).toFixed(1) + ' ' + T.km + ' ' + T.toNext + ' ' + next.w.name.split(' · ')[0];
      if (e.altitude != null) s += ' · ' + T.alt + ' ' + Math.round(e.altitude) + ' ' + T.m;
      status.textContent = s;
    });
    map.on('locationerror', function (e) { status.textContent = e.message; watching = false; locBtn.textContent = T.locate; });

    /* offline tiles for the current view */
    var saveBtn = container.querySelector('[data-act="save"]');
    saveBtn.textContent = T.save;
    saveBtn.addEventListener('click', function () {
      var b = map.getBounds(), z0 = Math.max(11, Math.floor(map.getZoom())), z1 = Math.min(15, z0 + 2), urls = [];
      for (var z = z0; z <= z1; z++) {
        var n = Math.pow(2, z);
        var tx = function (lon) { return Math.floor((lon + 180) / 360 * n); };
        var ty = function (lat) { var r = lat * Math.PI / 180; return Math.floor((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * n); };
        for (var xx = tx(b.getWest()); xx <= tx(b.getEast()); xx++) for (var yy = ty(b.getNorth()); yy <= ty(b.getSouth()); yy++)
          urls.push(TILES.replace('{s}', 'abc'[(xx + yy) % 3]).replace('{z}', z).replace('{x}', xx).replace('{y}', yy));
      }
      if (urls.length > 600) { status.textContent = T.tilesTooMany + ' (' + urls.length + ')'; return; }
      if (navigator.storage && navigator.storage.persist) navigator.storage.persist();
      var done = 0; saveBtn.disabled = true;
      (function next() {
        if (done >= urls.length) { status.textContent = T.saved + urls.length; saveBtn.disabled = false; return; }
        fetch(urls[done], { mode: 'no-cors' }).catch(function () { }).then(function () { done++; if (done % 10 === 0) status.textContent = T.saving + ' ' + done + '/' + urls.length; setTimeout(next, 60); });
      })();
    });

    apps[lang] = { map: map, redraw: function () { map.invalidateSize(); drawProfile(null); } };
    return apps[lang];
  }

  function visible() {
    document.querySelectorAll('.mapbox').forEach(function (c) { if (c.offsetParent !== null) build(c).redraw(); });
  }
  document.querySelectorAll('.mapstatus').forEach(function (s) { s.textContent = I18N[s.closest('.mapbox').getAttribute('data-map')].loading; });
  fetch(GPX).then(function (r) { return r.text(); }).then(function (t) {
    data = parseGpx(t); route = buildRoute(data.tracks);
    document.querySelectorAll('.mapstatus').forEach(function (s) { var T = I18N[s.closest('.mapbox').getAttribute('data-map')]; s.textContent = T.ready + data.tracks.length + ' ' + T.tracks + ', ' + data.wpts.length + ' ' + T.wpts + (navigator.onLine ? '' : ' · ' + T.offline); });
    visible();
  });
  var btn = document.getElementById('langbtn'); if (btn) btn.addEventListener('click', function () { setTimeout(visible, 30); });
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js');
})();
