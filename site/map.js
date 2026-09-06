/* GR52 map app: draws the real GPX, elevation profile, live position, offline tiles. */
(function () {
  'use strict';
  var GPX = '/GR52_all-in-one.gpx';
  var TILES = 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png';
  var I18N = {
    en: {
      nights: 'Nights, refuges, finish', water: 'Water', passes: 'Passes and summits', side: 'Side-trip summits',
      ferrata: 'Via ferrata points', escape: 'Escapes, bus, emergency', other: 'Shelters, campsites, lakes',
      locate: 'Where am I', locating: 'Locating…', stopLocate: 'Stop following', save: 'Save this view offline', saveRoute: 'Save whole route offline',
      saving: 'Saving tiles', saved: 'Saved for offline: ', tilesTooMany: 'Too many tiles for one save (max 900). Zoom in.',
      noGeo: 'Location is not available in this browser.', offRoute: 'off route', toNext: 'to', ascent: 'ascent',
      descent: 'descent', total: 'Route', km: 'km', m: 'm', offline: 'Offline: page, GPX and saved tiles are available.',
      alt: 'alt', loading: 'Loading GPX…', ready: 'GPX loaded: ', tracks: 'tracks', wpts: 'waypoints'
    },
    he: {
      nights: 'לילות, בקתות, סיום', water: 'מים', passes: 'מעברים ופסגות', side: 'פסגות סטיות צד',
      ferrata: 'נקודות ויה פראטה', escape: 'יציאות, אוטובוס, חירום', other: 'מחסות, קמפינגים, אגמים',
      locate: 'איפה אני', locating: 'מאתר…', stopLocate: 'הפסק מעקב', save: 'שמור תצוגה זו לאופליין', saveRoute: 'שמור את כל המסלול לאופליין',
      saving: 'שומר אריחים', saved: 'נשמר לאופליין: ', tilesTooMany: 'יותר מדי אריחים לשמירה אחת (מקסימום 900). התקרבו.',
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

  /* Chain the ROUTE tracks into one walking line. Each track may hold short alternates or loops as
     extra segments; keep only segments that connect to the running end (gap under 500 m). */
  function buildRoute(tracks) {
    var pts = [], d = 0, prev = null;
    function append(seg) { seg.forEach(function (p) { if (prev) d += hav(prev, p); pts.push({ lat: p.lat, lon: p.lon, ele: p.ele, d: d }); prev = p; }); }
    tracks.filter(function (t) { return t.kind === 'route'; }).forEach(function (t) {
      var left = t.segs.slice();
      if (!prev) { left.sort(function (a, b) { return b.length - a.length; }); append(left.shift()); }
      while (left.length) {
        var best = null;
        left.forEach(function (s) {
          var g0 = hav(prev, s[0]), g1 = hav(prev, s[s.length - 1]);
          if (!best || Math.min(g0, g1) < best.gap) best = { seg: s, gap: Math.min(g0, g1), rev: g1 < g0 };
        });
        if (best.gap > 500) break;
        left.splice(left.indexOf(best.seg), 1);
        append(best.rev ? best.seg.slice().reverse() : best.seg);
      }
    });
    var asc = 0, desc = 0, last = null;
    pts.forEach(function (p) {
      if (p.ele == null) return;
      if (last == null) { last = p.ele; return; }
      var dz = p.ele - last;
      if (Math.abs(dz) >= 10) { if (dz > 0) asc += dz; else desc -= dz; last = p.ele; }
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

  var data = null, route = null, apps = {}, pending = null;
  function norm(s) { return (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(); }

  function build(container) {
    var lang = container.getAttribute('data-map');
    if (apps[lang]) return apps[lang];
    var T = I18N[lang];
    var mapEl = container.querySelector('.livemap');
    var status = container.querySelector('.mapstatus');
    var map = L.map(mapEl, { scrollWheelZoom: false, zoomSnap: 0.5 });
    L.tileLayer(TILES, { maxZoom: 17, crossOrigin: true, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>, SRTM &middot; &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (CC-BY-SA)' }).addTo(map);

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
    var nights = data.wpts.filter(function (w) { return (w.type === 'Night' || w.type === 'Flag') && !/FALLBACK|option/.test(w.name); })
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

    /* offline tiles: current view, or a corridor along the whole route */
    function tileXY(lat, lon, z) {
      var n = Math.pow(2, z), r = lat * Math.PI / 180;
      return [Math.floor((lon + 180) / 360 * n), Math.floor((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * n)];
    }
    function tileUrl(z, x, y) { return TILES.replace('{s}', 'abc'[(x + y) % 3]).replace('{z}', z).replace('{x}', x).replace('{y}', y); }
    function saveTiles(urls, btn) {
      if (urls.length > 900) { status.textContent = T.tilesTooMany + ' (' + urls.length + ')'; return; }
      if (navigator.storage && navigator.storage.persist) navigator.storage.persist();
      var done = 0, failed = 0; btn.disabled = true;
      (function next() {
        if (done >= urls.length) { status.textContent = T.saved + (urls.length - failed) + (failed ? ' (' + failed + ' failed)' : ''); btn.disabled = false; return; }
        fetch(urls[done], { mode: 'cors' }).then(function (r) { if (!r.ok) failed++; }).catch(function () { failed++; })
          .then(function () { done++; if (done % 10 === 0) status.textContent = T.saving + ' ' + done + '/' + urls.length; setTimeout(next, 40); });
      })();
    }
    var saveBtn = container.querySelector('[data-act="save"]');
    saveBtn.textContent = T.save;
    saveBtn.addEventListener('click', function () {
      var b = map.getBounds(), z0 = Math.max(11, Math.floor(map.getZoom())), z1 = Math.min(15, z0 + 2), urls = [];
      for (var z = z0; z <= z1; z++) {
        var a = tileXY(b.getNorth(), b.getWest(), z), c = tileXY(b.getSouth(), b.getEast(), z);
        for (var xx = a[0]; xx <= c[0]; xx++) for (var yy = a[1]; yy <= c[1]; yy++) urls.push(tileUrl(z, xx, yy));
      }
      saveTiles(urls, saveBtn);
    });
    var routeBtn = container.querySelector('[data-act="saveroute"]');
    routeBtn.textContent = T.saveRoute;
    routeBtn.addEventListener('click', function () {
      var seen = {}, urls = [];
      [12, 13, 14].forEach(function (z) {
        var pad = z === 14 ? 1 : 1;
        data.tracks.forEach(function (t) {
          if (t.kind === 'boundary') return;
          t.segs.forEach(function (seg) {
            seg.forEach(function (p, k) {
              if (k % 3) return;
              var xy = tileXY(p.lat, p.lon, z);
              for (var dx = -pad; dx <= pad; dx++) for (var dy = -pad; dy <= pad; dy++) {
                var key = z + '/' + (xy[0] + dx) + '/' + (xy[1] + dy);
                if (!seen[key]) { seen[key] = 1; urls.push(tileUrl(z, xy[0] + dx, xy[1] + dy)); }
              }
            });
          });
        });
      });
      saveTiles(urls, routeBtn);
    });

    var highlight = null;
    function clearHighlight() { if (highlight) { map.removeLayer(highlight); highlight = null; } }
    function focus(q) {
      clearHighlight();
      var mDay = /^day:(\d+)$/.exec(q);
      if (mDay) {
        var n = +mDay[1], from = n === 1 ? 0 : null, to = null;
        nights.forEach(function (x) { var k = x.w.name.split(' ')[1]; if (x.w.name.indexOf('NIGHT ' + (n - 1) + ' ') === 0 && from == null) from = x.d; if (x.w.name.indexOf('NIGHT ' + n + ' ') === 0 || (n === 7 && x.w.name.indexOf('FINISH') === 0)) to = x.d; });
        if (from == null) from = 0; if (to == null) to = route.length;
        var slice = route.pts.filter(function (p) { return p.d >= from && p.d <= to; }).map(function (p) { return [p.lat, p.lon]; });
        if (slice.length < 2) return false;
        highlight = L.polyline(slice, { color: '#1E6FD9', weight: 9, opacity: .45 }).addTo(map);
        map.fitBounds(highlight.getBounds(), { padding: [20, 20] });
        return true;
      }
      var nq = norm(q), w = null;
      data.wpts.forEach(function (x) { if (!w && norm(x.name).indexOf(nq) >= 0) w = x; });
      if (w) {
        var c = CAT[w.type] || 'other'; if (cats[c] && !map.hasLayer(cats[c])) cats[c].addTo(map);
        map.setView([w.lat, w.lon], Math.max(map.getZoom(), 14));
        cats[c].eachLayer(function (l) { if (l.getLatLng && l.getLatLng().lat === w.lat && l.getLatLng().lng === w.lon) l.openPopup(); });
        highlight = L.circleMarker([w.lat, w.lon], { radius: 16, color: '#1E6FD9', weight: 3, fill: false }).addTo(map);
        return true;
      }
      var t = null; data.tracks.forEach(function (x) { if (!t && norm(x.name).indexOf(nq) >= 0) t = x; });
      if (t) {
        var g = overlays[shortTrackName(t.name)]; if (g && !map.hasLayer(g)) g.addTo(map);
        var fg = L.featureGroup(); g.eachLayer(function (l) { fg.addLayer(l); });
        map.fitBounds(fg.getBounds(), { padding: [20, 20] });
        highlight = L.polyline(t.segs.map(function (s) { return s.map(function (p) { return [p.lat, p.lon]; }); }), { color: '#1E6FD9', weight: 9, opacity: .35 }).addTo(map);
        return true;
      }
      return false;
    }
    map.on('click', clearHighlight);
    apps[lang] = { map: map, focus: focus, redraw: function () { map.invalidateSize(); drawProfile(null); } };
    return apps[lang];
  }

  function visible() {
    document.querySelectorAll('.mapbox').forEach(function (c) { if (c.offsetParent !== null) build(c).redraw(); });
  }
  document.querySelectorAll('.mapstatus').forEach(function (s) { s.textContent = I18N[s.closest('.mapbox').getAttribute('data-map')].loading; });
  fetch(GPX).then(function (r) { return r.text(); }).then(function (t) {
    data = parseGpx(t); route = buildRoute(data.tracks); window.gr52Data = { data: data, route: route };
    document.querySelectorAll('.mapstatus').forEach(function (s) { var T = I18N[s.closest('.mapbox').getAttribute('data-map')]; s.textContent = T.ready + data.tracks.length + ' ' + T.tracks + ', ' + data.wpts.length + ' ' + T.wpts + (navigator.onLine ? '' : ' · ' + T.offline); });
    visible();
    if (pending) { var q = pending; pending = null; focusVisible(q); } else fromHash();
  });
  var btn = document.getElementById('langbtn'); if (btn) btn.addEventListener('click', function () { setTimeout(visible, 30); });
  function focusVisible(q) {
    var box = null; document.querySelectorAll('.mapbox').forEach(function (c) { if (c.offsetParent !== null) box = c; });
    if (!box) return;
    if (!data) { pending = q; return; }
    var app = build(box);
    box.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setTimeout(function () { app.redraw(); app.focus(q); }, 250);
  }
  window.gr52Focus = focusVisible;
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[data-focus]'); if (!a) return;
    e.preventDefault(); focusVisible(a.getAttribute('data-focus'));
  });
  function fromHash() { var h = decodeURIComponent(location.hash || ''); if (h.indexOf('#map=') === 0) focusVisible(h.slice(5)); }
  window.addEventListener('hashchange', fromHash);
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js');
})();

/* Live weather per day from Open-Meteo, at each day's night spot and high point, derived from the GPX. */
(function () {
  'use strict';
  var API = 'https://api.open-meteo.com/v1/forecast';
  var T = {
    en: { night: 'night spot', finish: 'finish', high: 'high point', rain: 'rain', prob: 'chance', gusts: 'gusts', fl: 'freezing level', uv: 'UV', sun: 'sun',
      feels: 'feels', issued: 'Open-Meteo forecast, fetched', stale: 'offline, last forecast from', range: 'Forecast not yet available for this date (16-day horizon). Reload closer to the day.',
      err: 'Weather unavailable right now.', hour: 'h',
      w: { storm: 'Thunderstorm risk: be off the passes by early afternoon', rain: 'Rain likely', snow: 'Snow or freezing on the high point',
        wind: 'Strong gusts on the ridge', frost: 'Frost at the bivouac', heat: 'Heat on the low ground: start early, 3 L water', fog: 'Fog: navigation care on boulder fields', uv: 'Very high UV', cold: 'Cold night' },
      codes: { 0: 'clear', 1: 'mostly clear', 2: 'partly cloudy', 3: 'overcast', 45: 'fog', 48: 'freezing fog', 51: 'light drizzle', 53: 'drizzle', 55: 'heavy drizzle', 56: 'freezing drizzle', 57: 'freezing drizzle', 61: 'light rain', 63: 'rain', 65: 'heavy rain', 66: 'freezing rain', 67: 'freezing rain', 71: 'light snow', 73: 'snow', 75: 'heavy snow', 77: 'snow grains', 80: 'showers', 81: 'showers', 82: 'heavy showers', 85: 'snow showers', 86: 'snow showers', 95: 'thunderstorm', 96: 'thunderstorm with hail', 99: 'thunderstorm with hail' } },
    he: { night: 'לינה', finish: 'סיום', high: 'נקודה גבוהה', rain: 'גשם', prob: 'סיכוי', gusts: 'משבים', fl: 'גובה קיפאון', uv: 'UV', sun: 'שמש',
      feels: 'מורגש', issued: 'תחזית Open-Meteo, נמשכה', stale: 'אופליין, תחזית אחרונה מ', range: 'עדיין אין תחזית לתאריך הזה (טווח של 16 יום). טענו שוב קרוב ליום.',
      err: 'מזג האוויר לא זמין כרגע.', hour: '',
      w: { storm: 'סיכון לסופות רעמים: לרדת מהמעברים עד תחילת אחר הצהריים', rain: 'גשם צפוי', snow: 'שלג או קיפאון בנקודה הגבוהה',
        wind: 'משבי רוח חזקים על הרכס', frost: 'כפור בלינה', heat: 'חום בגובה הנמוך: לצאת מוקדם, 3 ליטר מים', fog: 'ערפל: זהירות בניווט בשדות הבולדרים', uv: 'קרינה גבוהה מאוד', cold: 'לילה קר' },
      codes: { 0: 'בהיר', 1: 'בהיר ברובו', 2: 'מעונן חלקית', 3: 'מעונן', 45: 'ערפל', 48: 'ערפל קפוא', 51: 'טפטוף קל', 53: 'טפטוף', 55: 'טפטוף כבד', 56: 'טפטוף קפוא', 57: 'טפטוף קפוא', 61: 'גשם קל', 63: 'גשם', 65: 'גשם כבד', 66: 'גשם קפוא', 67: 'גשם קפוא', 71: 'שלג קל', 73: 'שלג', 75: 'שלג כבד', 77: 'גרגרי שלג', 80: 'ממטרים', 81: 'ממטרים', 82: 'ממטרים כבדים', 85: 'ממטרי שלג', 86: 'ממטרי שלג', 95: 'סופת רעמים', 96: 'סופת רעמים עם ברד', 99: 'סופת רעמים עם ברד' } }
  };
  function hav(a, b) { var R = 6371000, dLat = (b.lat - a.lat) * Math.PI / 180, dLon = (b.lon - a.lon) * Math.PI / 180, s = Math.sin(dLat / 2), t = Math.sin(dLon / 2); return 2 * R * Math.asin(Math.sqrt(s * s + Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * t * t)); }
  function shortName(w) { return w.name.replace(/^(NIGHT \d( option B)?|FINISH|FALLBACK night \d) · [^·]+· /, '').replace(/^(NIGHT \d|FINISH) · /, '').split(/[:,(]/)[0].trim(); }

  /* Day points from the GPX: night spot (end of day) and the highest route point of the day. */
  function dayPoints(data, route) {
    var nights = data.wpts.filter(function (w) { return (w.type === 'Night' || w.type === 'Flag') && !/FALLBACK|option/.test(w.name); });
    function at(prefix) { var w = null; nights.forEach(function (x) { if (!w && x.name.indexOf(prefix) === 0) w = x; }); return w; }
    function onRoute(w) { var best = null; route.pts.forEach(function (q) { var dd = hav(w, q); if (!best || dd < best.dist) best = { dist: dd, pt: q }; }); return best.pt; }
    function floorEle(w) { var e = null; route.pts.forEach(function (q) { if (q.ele != null && hav(w, q) < 400 && (e == null || q.ele < e)) e = q.ele; }); return e; }
    var passes = data.wpts.filter(function (w) { return w.type === 'Summit' && /^PASS/.test(w.name); });
    var days = {}, n0 = at('NIGHT 0');
    days[0] = { night: { lat: n0.lat, lon: n0.lon, ele: 1290, name: shortName(n0) }, high: null };
    for (var n = 1; n <= 7; n++) {
      var a = n === 1 ? n0 : at('NIGHT ' + (n - 1) + ' '), b = n === 7 ? at('FINISH') : at('NIGHT ' + n + ' ');
      if (!a || !b) continue;
      var da = onRoute(a).d, db = onRoute(b).d, hi = null, endPt = onRoute(b);
      route.pts.forEach(function (p) { if (p.d >= da && p.d <= db && p.ele != null && (!hi || p.ele > hi.ele)) hi = p; });
      var hiName = null; passes.forEach(function (w) { if (hav(w, hi) < 800) hiName = w.name.replace(/^PASS · /, '').split(' - ')[0].replace(/\s*\d{3,4} m$/, ''); });
      days[n] = { night: { lat: b.lat, lon: b.lon, ele: floorEle(b) != null ? floorEle(b) : endPt.ele, name: shortName(b), finish: n === 7 }, high: { lat: hi.lat, lon: hi.lon, ele: hi.ele, name: hiName } };
    }
    return days;
  }

  function fetchForecast(points, startDate, endDate) {
    var q = API + '?latitude=' + points.map(function (p) { return p.lat.toFixed(4); }).join(',') + '&longitude=' + points.map(function (p) { return p.lon.toFixed(4); }).join(',')
      + '&elevation=' + points.map(function (p) { return Math.round(p.ele); }).join(',')
      + '&daily=weather_code,temperature_2m_max,temperature_2m_min,apparent_temperature_min,precipitation_sum,precipitation_probability_max,snowfall_sum,wind_gusts_10m_max,uv_index_max,sunrise,sunset'
      + '&hourly=freezing_level_height,cape&timezone=Europe%2FParis&wind_speed_unit=kmh&start_date=' + startDate + '&end_date=' + endDate;
    return fetch(q).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); }).then(function (j) { return Array.isArray(j) ? j : [j]; });
  }
  function dayIndex(loc, date) { return loc.daily.time.indexOf(date); }
  function hourStats(loc, date) {
    var fl = null, cape = 0; loc.hourly.time.forEach(function (t, i) {
      if (t.indexOf(date) !== 0) return; var h = +t.slice(11, 13);
      if (h >= 6 && h <= 18) { var v = loc.hourly.freezing_level_height[i]; if (v != null && (fl == null || v < fl)) fl = v; }
      if (h >= 10 && h <= 20) { var c = loc.hourly.cape[i]; if (c != null && c > cape) cape = c; }
    }); return { fl: fl, cape: cape };
  }
  function warnings(L, day, N, Hh, iN, iH) {
    var w = [], dN = N.daily, dH = Hh && Hh.daily, hs = hourStats(Hh || N, dN.time[iN]);
    var codes = [dN.weather_code[iN], dH ? dH.weather_code[iH] : 0];
    if (codes.some(function (c) { return c >= 95; }) || hs.cape >= 400) w.push(['storm', 'bad']);
    var rain = Math.max(dN.precipitation_sum[iN], dH ? dH.precipitation_sum[iH] : 0), prob = Math.max(dN.precipitation_probability_max[iN] || 0, dH ? dH.precipitation_probability_max[iH] || 0 : 0);
    if (rain >= 8 || prob >= 60) w.push(['rain', rain >= 15 ? 'bad' : '']);
    if (dH && (dH.snowfall_sum[iH] > 0 || (hs.fl != null && hs.fl < day.high.ele + 300))) w.push(['snow', 'bad']);
    var gust = Math.max(dN.wind_gusts_10m_max[iN], dH ? dH.wind_gusts_10m_max[iH] : 0);
    if (gust >= 60) w.push(['wind', gust >= 80 ? 'bad' : '']);
    if (dN.apparent_temperature_min[iN] <= 0) w.push(['frost', '']); else if (dN.apparent_temperature_min[iN] <= 3) w.push(['cold', '']);
    if (dN.temperature_2m_max[iN] >= 28) w.push(['heat', '']);
    if (codes.some(function (c) { return c === 45 || c === 48; })) w.push(['fog', '']);
    if (Math.max(dN.uv_index_max[iN], dH ? dH.uv_index_max[iH] : 0) >= 8) w.push(['uv', '']);
    return w;
  }
  function render(el, lang, day, N, Hh, meta) {
    var L = T[lang], date = el.closest('[data-date]').getAttribute('data-date'), iN = dayIndex(N, date), iH = Hh ? dayIndex(Hh, date) : -1;
    if (iN < 0 || (Hh && iH < 0)) { el.innerHTML = '<span class="wxmeta">' + L.range + '</span>'; return; }
    var dN = N.daily, dH = Hh && Hh.daily, hs = hourStats(Hh || N, date), esc = function (s) { return String(s).replace(/</g, '&lt;'); };
    var rows = [];
    rows.push('<span><span class="wxk">' + (day.night.finish ? L.finish : L.night) + '</span> ' + esc(day.night.name) + ' ' + Math.round(day.night.ele) + ' m: <b>' + Math.round(dN.temperature_2m_min[iN]) + '–' + Math.round(dN.temperature_2m_max[iN]) + ' °C</b>, ' + (L.codes[dN.weather_code[iN]] || dN.weather_code[iN]) + ' (' + L.feels + ' ' + Math.round(dN.apparent_temperature_min[iN]) + ' °C)</span>');
    if (dH) rows.push('<span><span class="wxk">' + L.high + '</span> ' + (day.high.name ? esc(day.high.name) + ' ' : '') + Math.round(day.high.ele) + ' m: <b>' + Math.round(dH.temperature_2m_min[iH]) + '–' + Math.round(dH.temperature_2m_max[iH]) + ' °C</b>, ' + (L.codes[dH.weather_code[iH]] || dH.weather_code[iH]) + '</span>');
    var rain = Math.max(dN.precipitation_sum[iN], dH ? dH.precipitation_sum[iH] : 0), prob = Math.max(dN.precipitation_probability_max[iN] || 0, dH ? dH.precipitation_probability_max[iH] || 0 : 0);
    var gust = Math.max(dN.wind_gusts_10m_max[iN], dH ? dH.wind_gusts_10m_max[iH] : 0), uv = Math.max(dN.uv_index_max[iN], dH ? dH.uv_index_max[iH] : 0);
    rows.push('<span><span class="wxk">' + L.rain + '</span> ' + rain.toFixed(rain < 1 ? 1 : 0) + ' mm (' + prob + ' % ' + L.prob + ')</span>');
    rows.push('<span><span class="wxk">' + L.gusts + '</span> ' + Math.round(gust) + ' km/h</span>');
    if (hs.fl != null) rows.push('<span><span class="wxk">' + L.fl + '</span> ' + Math.round(hs.fl / 50) * 50 + ' m</span>');
    rows.push('<span><span class="wxk">' + L.uv + '</span> ' + Math.round(uv) + '</span>');
    rows.push('<span><span class="wxk">' + L.sun + '</span> ' + dN.sunrise[iN].slice(11) + '–' + dN.sunset[iN].slice(11) + '</span>');
    var html = '<div class="wxrow">' + rows.join('') + '</div>';
    var ws = warnings(L, day, N, Hh, iN, iH);
    if (ws.length) html += '<div>' + ws.map(function (x) { return '<span class="wxwarn ' + x[1] + '">' + L.w[x[0]] + '</span>'; }).join('') + '</div>';
    html += '<div class="wxmeta">' + (meta.stale ? L.stale + ' ' : L.issued + ' ') + meta.when + '</div>';
    el.innerHTML = html;
  }

  var tries = 0;
  function start() {
    var app = window.gr52Data; if (!app) { if (tries++ < 100) return setTimeout(start, 200); return; }
    var days = dayPoints(app.data, app.route), points = [], index = {};
    Object.keys(days).forEach(function (n) { var d = days[n]; index[n] = { night: points.length }; points.push(d.night); if (d.high) { index[n].high = points.length; points.push(d.high); } });
    var els = Array.prototype.slice.call(document.querySelectorAll('.wx'));
    var dates = els.map(function (e) { return e.closest('[data-date]').getAttribute('data-date'); }).sort();
    var today = new Date().toISOString().slice(0, 10), horizon = new Date(Date.now() + 15 * 864e5).toISOString().slice(0, 10);
    var startDate = dates[0] < today ? today : dates[0], endDate = dates[dates.length - 1] > horizon ? horizon : dates[dates.length - 1];
    function paint(locs, meta) {
      els.forEach(function (el) {
        var n = +el.closest('[data-day]').getAttribute('data-day'), lang = el.closest('[lang]').getAttribute('lang');
        if (!days[n]) return;
        render(el, lang, days[n], locs[index[n].night], index[n].high != null ? locs[index[n].high] : null, meta);
      });
    }
    var cached = null; try { cached = JSON.parse(localStorage.getItem('gr52-wx') || 'null'); } catch (e) { }
    if (startDate > endDate) { els.forEach(function (el) { el.innerHTML = '<span class="wxmeta">' + T[el.closest('[lang]').getAttribute('lang')].range + '</span>'; }); return; }
    fetchForecast(points, startDate, endDate).then(function (locs) {
      var when = new Date().toLocaleString('en-GB', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' });
      try { localStorage.setItem('gr52-wx', JSON.stringify({ when: when, locs: locs })); } catch (e) { }
      paint(locs, { when: when });
    }).catch(function () {
      if (cached) paint(cached.locs, { when: cached.when, stale: true });
      else els.forEach(function (el) { el.innerHTML = '<span class="wxmeta">' + T[el.closest('[lang]').getAttribute('lang')].err + '</span>'; });
    });
  }
  start();
})();
