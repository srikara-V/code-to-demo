# khan-video — a Khan-Academy-style explainer of THIS repository

A self-contained generator that produces `code-to-demo-explained.mp4`: a ~14 min
narrated whiteboard walkthrough of this repo's architecture — the full stack,
the tradeoffs (no database, SSE vs WebSockets, agent-in-a-container,
local Docker vs Cloud Run Jobs), and what the design prioritized.

Fittingly, it is built from the same ingredients the repo itself uses to make
walkthroughs: a headless browser, ElevenLabs TTS, and ffmpeg.

## How it works

```
script.mjs   the single source of truth: 10 scenes, each a list of narration
             segments; each segment carries the draw-ops (boxes, arrows, icons,
             hand-written text) that appear while that sentence is spoken
tts.mjs      ElevenLabs text-to-speech WITH character timestamps → per-scene
             mp3 + the exact second each segment starts (drawings sync to speech)
board.html   the whiteboard page (dark board, hand-drawn look, bundled fonts)
board.js     deterministic renderer: loadScene(i, timing) + seekTime(t) set the
             exact visual state for any t — seeded wobble, stroke draw-on,
             per-character text reveal. No wall-clock, no CSS animation.
render.mjs   drives board.html in headless Chromium, captures PNG frames at
             15 fps by seeking (never realtime), pipes them into ffmpeg per
             scene, concatenates, and muxes the narration track
```

## Rebuild

```bash
npm install                      # playwright + a static ffmpeg (bundled in the npm tarball)
export ELEVEN_LABS_API=sk_...    # ElevenLabs key
node tts.mjs                     # narration + timings (cached; re-runs only changed scenes)
node render.mjs stills           # optional: per-scene end-state PNGs for layout QA
node render.mjs full             # → build/final/code-to-demo-explained.mp4
```

`render.mjs still <scene> <t>` renders a single frame at time `t` for debugging.
Narration text and board text are separate strings, so the audio can spell
things phonetically ("Veet") while the board shows the real name ("Vite").

Fonts: [Caveat](https://fonts.google.com/specimen/Caveat) and
[Patrick Hand](https://fonts.google.com/specimen/Patrick+Hand), both under the
SIL Open Font License, bundled in `assets/fonts/`.
