# KitSHn Recipe

This repository deploys the GR52 trip dossier to `gr52.yarden-zamir.com` with KitSHn.

- Pushes to `main` deploy `prod`. Pull requests deploy to `pr.<number>.gr52.yarden-zamir.com`.
- The site is static. A Caddy container serves `site/` and listens on the KitSHn Unix socket
  (`container/Caddyfile`). The host Caddy routes the public hostname to that socket (`Caddyfile.j2`).
- No persistent data, no secrets beyond `KITSHN_VPS_HOST` and `KITSHN_SSH_KEY`.

## Files

- `site/index.html`: the dossier, English and Hebrew, maps embedded.
- `site/GR52_all-in-one.gpx`: the OsmAnd track and waypoint file, served as a download.
- `.kitshn.yaml`, `.github/workflows/kitshn.yml`, `compose.yml`, `Caddyfile.j2`, `Dockerfile`.
