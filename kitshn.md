# KitSHn Recipe

This repository deploys the GR52 trip dossier to `gr52.yarden-zamir.com` with KitSHn.

- Pushes to `main` deploy `prod`. Pull requests deploy to `pr.<number>.gr52.yarden-zamir.com`.
- The site is static. A Caddy container serves `site/` and listens on the KitSHn Unix socket
  (`container/Caddyfile`). The host Caddy routes the public hostname to that socket (`Caddyfile.j2`).
- Pictures and page edits live on the `logdata` volume (the uploader container).
- Editing needs a GitHub sign-in through oauth2-proxy, the same gate as collie-gate. Secrets in the `prod`
  environment: `KITSHN_OAUTH2_PROXY_CLIENT_ID`, `KITSHN_OAUTH2_PROXY_CLIENT_SECRET` and
  `KITSHN_OAUTH2_PROXY_COOKIE_SECRET`. The editors are `trek.json` `"editors"`; `src/build.py` writes
  `compose.override.yml` from `trek.json` (the editors, the zone, and oauth2-proxy when `"auth": true`).
  GitHub App: https://github.com/apps/gr52-trip-log, callback `https://gr52.yarden-zamir.com/auth/callback`.
  Pull request previews cannot sign in: the app knows only the production callback.

## Files

- `site/index.html`: the dossier, English and Hebrew, built from `src/` by `src/build.py`.
- `site/map.js`, `site/sw.js`, `site/vendor/`: the map app, service worker and Leaflet.
- `site/maps/*.webp`: annotated section maps loaded on demand.
- `site/GR52_all-in-one.gpx`: the track and waypoint file, served as a download.
- `.kitshn.yaml`, `.github/workflows/kitshn.yml`, `compose.yml`, `Caddyfile.j2`, `Dockerfile`.
