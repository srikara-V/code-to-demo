# project-to-demo-video

Turn a repo into a narrated demo-video walkthrough: drive the running app with
**Playwright** (animated cursor + numbered step rail via **Remotion**), narrate
with **ElevenLabs**, and render an MP4.

## Layout

```
instructions/          ← the complete handoff (pipeline docs + runnable template + example
                          reference).  NOT in version control — see the note below.
out/                   ← final rendered walkthroughs land HERE (repo root)
```

> ⚠️ **`instructions/` is intentionally excluded from this repository** (it is
> gitignored and kept local-only). Beyond the pipeline docs and the runnable
> `video-project/` template, it contains reference material from the original
> example engagement that includes **sensitive, non-public information about
> specific named government officials, vendors, and deal strategy**. It is
> deliberately not published here.
>
> Consequence: a fresh clone will not have `instructions/`. The app mounts it at
> runtime from the repo root (see `app/jobs.js`), so to run the full generation
> pipeline you must supply your own `instructions/` — a pipeline template plus your
> own (non-sensitive) example content.

## Make a video

1. Read `instructions/README.md`, then `instructions/docs/04-extend-or-replicate.md`.
2. Work in `instructions/video-project/`:
   - `npm install`
   - put your ElevenLabs key in `.eleven_key`
   - author the tour in `record/tour.mjs`, generate narration (`node walk-tts.mjs`),
     record the app (`node _runtour.mjs`), then **`npm run render`**.
3. The final MP4 is written to the repo-root **`out/`**.

> Output goes to the repo-root `out/` (configured via the `render` script in
> `instructions/video-project/package.json`, which targets `../../out/`). The
> `.eleven_key` and rendered `*.mp4` are gitignored.
