# GR52 Bivouac Dossier

Yarden and Ayelet's seven-day tent crossing of the GR52 from Saint-Dalmas-Valdeblore to Menton,
12 to 18 September 2026. Day plan, interactive map, park rules, water, refuges, technical options
and transport, in English and Hebrew.

Live at [gr52.yarden-zamir.com](https://gr52.yarden-zamir.com). The GPX for OsmAnd is at
[/GR52_all-in-one.gpx](https://gr52.yarden-zamir.com/GR52_all-in-one.gpx).

## Layout

- `src/`: page sources. `head.html` (styles), `body.html` (content, both languages),
  `scripts.html` (language toggle, elevation profile, Leaflet map). `build.py` assembles them.
- `site/`: the built page, `map.js`, the generated `sw.js`, the GPX file, `maps/` (annotated section maps as
  WebP) and `vendor/` (Leaflet).
- `src/maps.py` renders the section maps from OpenTopoMap tiles; `src/gpx.py` builds the route
  GPX from the OpenStreetMap relation.
- `container/Caddyfile`: the file server inside the container.
- Deployment: see `kitshn.md`.

## Map

`site/map.js` fetches the real GPX, parses it in the browser and draws every track and waypoint,
so the map and the download are the same file. Features: per-track and per-category layer toggles
(the OsmAnd list), an elevation profile from EU-DEM 25 m heights with hover linked to the map,
"Where am I" with kilometre on route and distance to the next night, "Save this view offline" and
"Save whole route offline", which store OpenTopoMap tiles (a corridor at zoom 12 to 14 for the route). `src/sw.js` (stamped with a build id by `build.py`) precaches the page, GPX, Leaflet and the
section maps, and caches fonts and tiles as they are used, so the site works without signal; `manifest.webmanifest` lets it install to a home screen. Leaflet is
vendored under `site/vendor/`. The annotated section maps stay behind a disclosure as lazy WebP.

`src/elevation.py` adds `<ele>` to the GPX from OpenTopoData; run it after regenerating the GPX.

## Weather

Each day card shows a live forecast from [Open-Meteo](https://open-meteo.com/) for that day's
night spot and highest route point, both derived from the GPX at runtime (nothing is hardcoded).
One request covers all points and the trek dates; the page derives warnings for thunderstorms
(WMO code or CAPE), rain, snow and freezing level against the high point, ridge gusts, frost at
the bivouac, heat on the low days, fog, UV, and a planned arrival after sunset. Each card shows
the fetch time and age (stale after 6 h) with a refresh button, and an "Hour by hour" chart:
temperature at the high point and the night spot, rain bars, storm hours in red, freezing hours
in blue, sunrise and sunset, and the planned walking window. The last forecast is cached in
localStorage and by the service worker so it still shows offline.

## On the trail

"Where am I" takes one position fix (no GPS watch, to save battery), shows it on the map, marks
the days already walked as done and folds them, and adds to today's card the kilometre on the
route, distance walked and left, ascent left, an arrival estimate (measured pace after two fixes
at least 20 minutes apart, else the planned pace) and sunset. Day titles and every place name
link to the map. Leaflet is pinned at 1.9.4 under `site/vendor/`.

## Update

Edit `src/body.html`, run `uv run src/build.py`, push to `main`. A pull request gets a preview at
`pr.<number>.gr52.yarden-zamir.com`.

## Credits

Route geometry from OpenStreetMap contributors (ODbL). Map tiles by OpenTopoMap (CC BY-SA).

## License

MIT
