# kitshn

This repository deploys with [kitshn 2](https://kit.yarden-zamir.com).

- `kitshn.config.ts` names the app and its deploys: a static site from `site/`, built by `sh tools/kitshn-build.sh`, which adds the frozen trip-log photos.
- `.github/workflows/kitshn.yml` calls `kitshn2-deploy.yml`. It signs in to kitshn with GitHub OIDC, so the repo needs no deploy secrets.
- A push to `main` deploys `prod` at `gr52.yarden-zamir.com`. Each pull request deploys a `pr-<number>` preview at `gr52-pr-<number>.yarden-zamir.com`, and kitshn removes it when the pull request closes.

## This app

- Run `src/build.py` after you change `trek.json`, and commit `site/`.
- The uploader, its GitHub sign-in and `compose.yml` do not run on kitshn 2, so the page takes no uploads or edits.
