import { defineApp } from "kitshn";

// kitshn 2 (https://kit.yarden-zamir.com): a static site from `site`, public like before. The build adds the frozen
// trip-log photos (tools/kitshn-build.sh); the uploader and its sign-in of KitSHn 1 are not part of it.
export default defineApp({
  static: { build: "sh tools/kitshn-build.sh", output: "site" },
  deploy: [
    { on: "push", branch: "main", name: "prod", startsIn: "Everyone" },
    { on: "pull_request", name: "pr-{pr}", ephemeral: true },
  ],
});
