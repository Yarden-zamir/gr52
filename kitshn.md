# KitSHn Recipe

This repository deploys the GR52 site to `gr52.yarden-zamir.com` with KitSHn.

- Pushes to `main` deploy `prod`. Pull requests deploy to `pr.<number>.gr52.yarden-zamir.com`.
- A Caddy container serves `site/` and listens on the KitSHn Unix socket (`container/Caddyfile`). The host Caddy routes the public hostname to that socket (`Caddyfile.j2`).
- The `uploader` container keeps the pictures, the videos and the page edits on the `logdata` volume.
- Editing needs a GitHub sign-in through oauth2-proxy. It uses the GitHub App https://github.com/apps/gr52-trip-log, with the callback `https://gr52.yarden-zamir.com/auth/callback`. The secrets are in the `prod` environment: `KITSHN_OAUTH2_PROXY_CLIENT_ID`, `KITSHN_OAUTH2_PROXY_CLIENT_SECRET` and `KITSHN_OAUTH2_PROXY_COOKIE_SECRET`.
- `src/build.py` writes `compose.override.yml` from `trek.json`: the editors, the time zone and the oauth2-proxy service. A `.env` file does nothing under KitSHn.
- Pull request previews cannot sign in, because the app knows only the production callback.

## Files

- `site/index.html`: the trail story, the front page. `site/plan/index.html`: the plan as it was.
- `site/map.js`, `site/log.js`, `site/trip.js`, `site/sw.js`, `site/vendor/`: the page scripts, the service worker and Leaflet.
- `site/maps/*.webp`: annotated section maps, loaded on demand.
- `site/GR52_all-in-one.gpx`: the route as walked, served as a download.
- `.kitshn.yaml`, `.github/workflows/kitshn.yml`, `compose.yml`, `compose.override.yml`, `Caddyfile.j2`, `Dockerfile`: the recipe.
