# GR52 + a tent

The site of our GR52 walk across the Mercantour, from Saint-Dalmas-Valdeblore to Menton, 12 to 18 September 2026: seven days with a tent, about 109 km, 6,450 m up and 7,700 m down.

**[gr52.yarden-zamir.com](https://gr52.yarden-zamir.com)**

- **The front page is the trail story**, in Hebrew and English. It has pictures and videos on the map, a map that follows the reader, the weather each day had, tips for each day, and a "Before you go" section for anyone who wants to walk the same way.
- **[/plan/](https://gr52.yarden-zamir.com/plan/) keeps the plan as it was before we left.** It has the day cards, the forecast tools, the day simulator, and the GPX for any map app.

![The story on a desktop, with the whole route on the map beside it](https://raw.githubusercontent.com/Yarden-zamir/trek-site-template/main/docs/screenshots/story-desktop.jpg)

The site is built from [trek-site-template](https://github.com/Yarden-zamir/trek-site-template). Its README explains the features, the build and the configuration.

## This repo

- `trek.json`: the trek's config. It sets the route, the places, Hebrew as the default language, the story (`yarden-zamir`) and the editors.
- `content.yaml`: the plan's text, in English and Hebrew.
- `log/yarden-zamir/log.yaml`: the trail story, with its days, tips, reference sections and picture captions.
- `walked.json`: where the walk left the plan. `tools/walked.py` rebuilds the GPX as walked from it and from `research/plan.gpx`.
- `site/`: the built site. `site/GR52_all-in-one.gpx` is the route as walked.
- `src/`, `site/*.js`, `tools/`, `uploader/`, `container/`, `compose.yml`: these come from the template. Change them there, then copy them here.

The pictures, videos and page edits live on the server, not in git. The editors add and edit them on the page after signing in with GitHub. `uv run tools/log_pull.py` folds the page edits back into `log.yaml`.

## Update the site

```sh
uv run tools/log_pull.py   # first, so that the edits made on the page are not lost
uv run src/build.py        # rebuild site/ from the data files
uv run tools/links.py      # check the links and references
git push                   # main deploys with KitSHn
```

`kitshn.md` has the deploy notes.

## License

MIT for the code. The text and the pictures are ours.
