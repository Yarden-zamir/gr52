#!/bin/sh
# kitshn 2 build (kitshn.config.ts): the trip log is frozen. The uploader of KitSHn 1 ended on 2026-10-28, and its
# photos live as release assets of this repo. This script puts them into site/log/yarden-zamir/, after a check of
# their SHA256 sums, so the static site keeps showing the log. Nobody can add photos any more.
set -eu
base=https://github.com/Yarden-zamir/gr52/releases/download/trip-log-2026-10-28
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
curl -fsSL "$base/SHA256SUMS" -o "$work/SHA256SUMS"
for part in photos orig; do curl -fsSL "$base/gr52-log-$part.tar" -o "$work/gr52-log-$part.tar"; done
(cd "$work" && sha256sum -c SHA256SUMS)
mkdir -p site/log/yarden-zamir
for part in photos orig; do tar -xf "$work/gr52-log-$part.tar" -C site/log/yarden-zamir; done
echo "trip log: $(find site/log/yarden-zamir/photos site/log/yarden-zamir/orig -type f | wc -l) files"
