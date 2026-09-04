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

## Update

Edit `src/body.html`, run `uv run src/build.py`, push to `main`. A pull request gets a preview at
`pr.<number>.gr52.yarden-zamir.com`.

## Credits

Route geometry from OpenStreetMap contributors (ODbL). Map tiles by OpenTopoMap (CC BY-SA).

## License

MIT
