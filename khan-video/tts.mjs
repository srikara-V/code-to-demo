// ElevenLabs narration per scene, WITH character timestamps so the board can
// start each segment's drawings exactly when that sentence begins.
// Usage: ELEVEN_LABS_API=... node tts.mjs
// Writes build/audio/scene-N.mp3 and build/timing/scene-N.json (idempotent:
// unchanged narration is skipped on re-runs).
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { SCENES, VOICE } from "./script.mjs";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const AUDIO = path.join(ROOT, "build", "audio");
const TIMING = path.join(ROOT, "build", "timing");
fs.mkdirSync(AUDIO, { recursive: true });
fs.mkdirSync(TIMING, { recursive: true });

const KEY = process.env.ELEVEN_LABS_API || process.env.ELEVENLABS_API_KEY;
if (!KEY) {
  console.error("Set ELEVEN_LABS_API");
  process.exit(1);
}

const sha = (s) => crypto.createHash("sha256").update(s).digest("hex").slice(0, 16);

async function ttsScene(i) {
  const scene = SCENES[i];
  const joined = scene.segs.map((s) => s.say.trim()).join(" ");
  const hash = sha(joined + VOICE.id + VOICE.model);
  const mp3Path = path.join(AUDIO, `scene-${i}.mp3`);
  const timingPath = path.join(TIMING, `scene-${i}.json`);
  if (fs.existsSync(mp3Path) && fs.existsSync(timingPath)) {
    const t = JSON.parse(fs.readFileSync(timingPath, "utf8"));
    if (t.hash === hash) {
      console.log(`scene ${i}: cached (${t.audioDur.toFixed(1)}s)`);
      return;
    }
  }

  // char offset where each segment starts in `joined`
  const offsets = [];
  let pos = 0;
  for (const s of scene.segs) {
    offsets.push(pos);
    pos += s.say.trim().length + 1; // the " " joiner
  }

  const url = `https://api.elevenlabs.io/v1/text-to-speech/${VOICE.id}/with-timestamps?output_format=mp3_44100_128`;
  let res, body;
  for (let attempt = 1; attempt <= 4; attempt++) {
    res = await fetch(url, {
      method: "POST",
      headers: { "xi-api-key": KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ text: joined, model_id: VOICE.model, voice_settings: VOICE.settings }),
    });
    if (res.ok) {
      body = await res.json();
      break;
    }
    const errText = await res.text();
    console.error(`scene ${i}: attempt ${attempt} failed (${res.status}): ${errText.slice(0, 300)}`);
    if (attempt === 4) throw new Error(`TTS failed for scene ${i}`);
    await new Promise((r) => setTimeout(r, attempt * 3000));
  }

  fs.writeFileSync(mp3Path, Buffer.from(body.audio_base64, "base64"));
  const al = body.alignment || body.normalized_alignment;
  const chars = al.characters;
  const starts = al.character_start_times_seconds;
  const ends = al.character_end_times_seconds;
  const audioDur = ends[ends.length - 1];

  // Map each segment's first non-space character to its spoken start time.
  // The alignment characters should mirror the input text 1:1; guard anyway.
  const segStarts = offsets.map((off) => {
    let k = Math.min(off, chars.length - 1);
    while (k < chars.length && chars[k] === " ") k++;
    return starts[Math.min(k, starts.length - 1)];
  });
  segStarts[0] = 0;

  fs.writeFileSync(timingPath, JSON.stringify({ hash, audioDur, segStarts }, null, 2));
  console.log(`scene ${i}: ${audioDur.toFixed(1)}s, seg starts ${segStarts.map((s) => s.toFixed(1)).join(" ")}`);
}

const only = process.argv[2] != null ? [Number(process.argv[2])] : SCENES.map((_, i) => i);
for (const i of only) await ttsScene(i);
const total = only
  .map((i) => JSON.parse(fs.readFileSync(path.join(TIMING, `scene-${i}.json`), "utf8")).audioDur)
  .reduce((a, b) => a + b, 0);
console.log(`total narration: ${(total / 60).toFixed(1)} min`);
