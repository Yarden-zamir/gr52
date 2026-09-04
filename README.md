# GR52 Bivouac Dossier

Yarden and Ayelet's seven-day tent crossing of the GR52 from Saint-Dalmas-Valdeblore to Menton,
12 to 18 September 2026. Day plan, interactive map, park rules, water, refuges, technical options
and transport, in English and Hebrew.

Live at [gr52.yarden-zamir.com](https://gr52.yarden-zamir.com). The GPX for OsmAnd is at
[/GR52_all-in-one.gpx](https://gr52.yarden-zamir.com/GR52_all-in-one.gpx).

## Layout

- `src/`: page sources. `head.html` (styles), `body.html` (content, both languages),
  `scripts.html` (language toggle, elevation profile, Leaflet map). `build.py` assembles them.
- `site/`: the built page, `route.geojson` (route and waypoints for the map), `maps/` (annotated
  section maps as WebP) and the GPX file.
- `src/maps.py` renders the section maps from OpenTopoMap tiles; `src/gpx.py` builds the route
  GPX from the OpenStreetMap relation.
- `container/Caddyfile`: the file server inside the container.
- Deployment: see `kitshn.md`.

## Maps

The page loads in about 50 KB. The interactive map pulls OpenTopoMap tiles on demand and draws the
route from `route.geojson` (about 100 KB). The annotated section maps are behind a disclosure and
load lazily as WebP.

## Update

Edit `src/body.html`, run `uv run src/build.py`, push to `main`. A pull request gets a preview at
`pr.<number>.gr52.yarden-zamir.com`.

## Credits

Route geometry from OpenStreetMap contributors (ODbL). Map tiles by OpenTopoMap (CC BY-SA).

## License

MIT
