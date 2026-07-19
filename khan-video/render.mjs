// Frame-exact renderer: drives board.html in headless Chromium, captures PNG
// frames at fixed timestamps (deterministic seek, no realtime recording), pipes
// them straight into ffmpeg per scene, then concatenates and muxes narration.
//
//   node render.mjs stills            → build/stills/scene-N.png (end states, QA)
//   node render.mjs still <i> <t>     → build/stills/scene-<i>-t<t>.png
//   node render.mjs full              → build/final/code-to-demo-explained.mp4
import { spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { SCENES } from "./script.mjs";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const BUILD = path.join(ROOT, "build");
const FPS = 15;
const LEAD = 0.35; // silence before narration in each scene
const TAIL = 1.15; // linger on the finished board
const PAGE_WORKERS = 3;

// Chromium refuses ES-module imports from file:// — serve the board over HTTP.
const MIME = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".woff2": "font/woff2" };
const server = http.createServer((req, res) => {
  const rel = decodeURIComponent(new URL(req.url, "http://x").pathname).replace(/^\/+/, "") || "board.html";
  const abs = path.resolve(ROOT, rel);
  if (!abs.startsWith(ROOT) || !fs.existsSync(abs)) return res.writeHead(404).end();
  res.writeHead(200, { "Content-Type": MIME[path.extname(abs)] || "application/octet-stream" });
  fs.createReadStream(abs).pipe(res);
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const boardUrl = `http://127.0.0.1:${server.address().port}/board.html`;
const timingFor = (i) => {
  const p = path.join(BUILD, "timing", `scene-${i}.json`);
  if (fs.existsSync(p)) {
    const t = JSON.parse(fs.readFileSync(p, "utf8"));
    return { audioDur: t.audioDur, segStarts: t.segStarts, lead: LEAD, tail: TAIL };
  }
  // fallback (stills before TTS exists): uniform pacing
  return { audioDur: SCENES[i].segs.length * 4.5, segStarts: SCENES[i].segs.map((_, k) => k * 4.5), lead: LEAD, tail: TAIL };
};

// One browser PER worker: same-origin tabs share a single renderer process in
// Chromium, so pages in one browser rasterize serially — separate processes
// are what actually parallelize. Frames are captured as JPEG via raw CDP
// (Chromium's PNG encoder is ~5x slower and was the original bottleneck).
async function newWorker() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  await page.goto(boardUrl);
  await page.evaluate(() => window.boardReady);
  const cdp = await page.context().newCDPSession(page);
  return { browser, page, cdp };
}
const shoot = async (cdp) =>
  Buffer.from((await cdp.send("Page.captureScreenshot", { format: "jpeg", quality: 95 })).data, "base64");

async function stills(only) {
  fs.mkdirSync(path.join(BUILD, "stills"), { recursive: true });
  const { browser, page } = await newWorker();
  const idxs = only != null ? [only.i] : SCENES.map((_, i) => i);
  for (const i of idxs) {
    const t = timingFor(i);
    const { duration } = await page.evaluate(([i, t]) => window.loadScene(i, t), [i, t]);
    const at = only?.t != null ? only.t : duration;
    await page.evaluate((at) => window.seekTime(at), [at][0]);
    const name = only?.t != null ? `scene-${i}-t${only.t}.png` : `scene-${i}.png`;
    await page.screenshot({ path: path.join(BUILD, "stills", name), clip: { x: 0, y: 0, width: 1920, height: 1080 } });
    console.log(`still: ${name} (scene duration ${duration.toFixed(1)}s)`);
  }
  await browser.close();
}

// Static ffmpeg from the npm tarball (apt/GitHub downloads are blocked here).
const FFMPEG =
  process.env.FFMPEG_BIN ||
  path.join(ROOT, "node_modules", "@ffmpeg-installer", "linux-x64", "ffmpeg");

function ffmpeg(args, tag) {
  const p = spawn(FFMPEG, ["-hide_banner", "-loglevel", "error", ...args], { stdio: ["pipe", "inherit", "inherit"] });
  p.on("error", (e) => console.error(`${tag}: ffmpeg spawn error`, e));
  return p;
}
const waitExit = (p, tag) =>
  new Promise((res, rej) => p.on("close", (c) => (c === 0 ? res() : rej(new Error(`${tag} exited ${c}`)))));

async function renderScene(page, cdp, i) {
  const timing = timingFor(i);
  const { duration } = await page.evaluate(([i, t]) => window.loadScene(i, t), [
    i,
    { ...timing, fadeIn: i === 0 ? 0.5 : 0, fadeOut: i === SCENES.length - 1 ? 0.9 : 0 },
  ]);
  const frames = Math.round(duration * FPS);
  const out = path.join(BUILD, "scenes", `scene-${i}.mp4`);
  if (fs.existsSync(out)) {
    console.log(`scene ${i}: already rendered, skipping`);
    return { i, frames, dur: frames / FPS };
  }
  const tmp = out + ".tmp.mp4"; // atomic: only renamed to final name on success
  const enc = ffmpeg(
    ["-y", "-f", "image2pipe", "-c:v", "mjpeg", "-framerate", String(FPS), "-i", "-",
     "-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-pix_fmt", "yuv420p", tmp],
    `scene ${i}`
  );
  const t0 = Date.now();
  for (let f = 0; f < frames; f++) {
    await page.evaluate((t) => window.seekTime(t), f / FPS);
    const buf = await shoot(cdp);
    if (!enc.stdin.write(buf)) await new Promise((r) => enc.stdin.once("drain", r));
    if (f % 300 === 0)
      console.log(`scene ${i}: frame ${f}/${frames} (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
  }
  enc.stdin.end();
  await waitExit(enc, `scene ${i}`);
  fs.renameSync(tmp, out);
  console.log(`scene ${i}: done, ${frames} frames, ${(frames / FPS).toFixed(1)}s`);
  return { i, frames, dur: frames / FPS };
}

async function full() {
  fs.mkdirSync(path.join(BUILD, "scenes"), { recursive: true });
  fs.mkdirSync(path.join(BUILD, "final"), { recursive: true });
  for (const i of SCENES.map((_, i) => i)) {
    if (!fs.existsSync(path.join(BUILD, "audio", `scene-${i}.mp3`)))
      throw new Error(`missing audio for scene ${i} — run tts.mjs first`);
  }

  // Render scenes across a small pool of pages (each scene pipes into its own
  // ffmpeg, so wall-clock is dominated by screenshot throughput).
  const queue = SCENES.map((_, i) => i);
  const results = [];
  const workers = [];
  for (let w = 0; w < PAGE_WORKERS; w++) {
    workers.push(
      (async () => {
        const { browser, page, cdp } = await newWorker();
        while (queue.length) {
          const i = queue.shift();
          results.push(await renderScene(page, cdp, i));
        }
        await browser.close();
      })()
    );
  }
  await Promise.all(workers);
  results.sort((a, b) => a.i - b.i);
  await mux(results);
}

// Concat scene videos + build the narration track. Scene durations are fully
// determined by the timing files, so this can also run standalone ("mux" mode)
// against already-rendered scene mp4s.
async function mux(results) {
  // 1) video-only concat (identical codec params → stream copy, no re-encode)
  const listPath = path.join(BUILD, "concat.txt");
  fs.writeFileSync(listPath, results.map((r) => `file 'scenes/scene-${r.i}.mp4'`).join("\n") + "\n");
  const allVideo = path.join(BUILD, "video-all.mp4");
  await waitExit(ffmpeg(["-y", "-f", "concat", "-safe", "0", "-i", listPath, "-c", "copy", allVideo], "concat"), "concat");

  // 2) audio track: each scene's mp3 delayed by LEAD and padded to EXACTLY the
  //    scene's video duration, then concatenated → total lengths match.
  //    (input 0 is the video, so mp3 k lives at input index k+1)
  const inputs = [];
  const filters = [];
  results.forEach((r, k) => {
    inputs.push("-i", path.join(BUILD, "audio", `scene-${r.i}.mp3`));
    const d = Math.round(LEAD * 1000);
    filters.push(`[${k + 1}:a]adelay=${d}|${d},apad,atrim=0:${r.dur.toFixed(3)}[a${k}]`);
  });
  const concatIn = results.map((_, k) => `[a${k}]`).join("");
  const graph = `${filters.join(";")};${concatIn}concat=n=${results.length}:v=0:a=1[a]`;
  const final = path.join(BUILD, "final", "code-to-demo-explained.mp4");
  await waitExit(
    ffmpeg(["-y", "-i", allVideo, ...inputs, "-filter_complex", graph,
            "-map", "0:v", "-map", "[a]", "-c:v", "copy", "-c:a", "aac", "-b:a", "160k", final], "mux"),
    "mux"
  );
  const total = results.reduce((a, r) => a + r.dur, 0);
  console.log(`\nFINAL: ${final}`);
  console.log(`duration ${(total / 60).toFixed(1)} min, size ${(fs.statSync(final).size / 1e6).toFixed(1)} MB`);
}

// Recompute per-scene frame counts from the timing files (deterministic — the
// same arithmetic renderScene uses) without rendering anything.
function sceneMeta() {
  return SCENES.map((_, i) => {
    const t = timingFor(i);
    const duration = (t.lead ?? LEAD) + t.audioDur + (t.tail ?? TAIL);
    const frames = Math.round(duration * FPS);
    return { i, frames, dur: frames / FPS };
  });
}

const mode = process.argv[2] || "stills";
try {
  if (mode === "stills") await stills();
  else if (mode === "still") await stills({ i: Number(process.argv[3]), t: Number(process.argv[4]) });
  else if (mode === "full") await full();
  else if (mode === "mux") await mux(sceneMeta());
  else throw new Error(`unknown mode ${mode}`);
} finally {
  server.close();
}
