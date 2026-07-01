// Job engine: each "generate a walkthrough" request becomes a Job. Jobs run in
// their OWN throwaway container (docker run --rm) so they never collide on the
// app port, /opt/video-project, or the output file. A bounded pool limits how
// many run at once; the rest queue. Events are buffered per-job so an SSE client
// can disconnect/reconnect (or arrive late) and still see the full stream — the
// run is decoupled from the browser. In-memory only; no database.
import { spawn } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");
const JOBS_DIR = path.join(REPO_ROOT, "out", "jobs");
const DEMO_REPO = path.join(REPO_ROOT, "demo-repo");
const INSTRUCTIONS = path.join(REPO_ROOT, "instructions");
const CODEX_HOME = path.join(REPO_ROOT, ".codex");
const DEMO_CACHE = path.join(REPO_ROOT, "out", "walkthrough.mp4"); // refreshed on demo redo

const IMAGE = process.env.CODEX_IMAGE || "demo-video-codex:latest";
const MAX_CONCURRENT = Number(process.env.MAX_CONCURRENT_JOBS || 2);
const JOB_CPUS = process.env.JOB_CPUS || "2";
const JOB_MEMORY = process.env.JOB_MEMORY || "3g";

const jobs = new Map();
const queue = [];
let active = 0;

// Stack-agnostic task: the agent discovers how to run ANY app and walks it.
const agentTask = (repoDir) =>
  [
    `You are generating a narrated screen-walkthrough VIDEO of the web app whose source is in ${repoDir},`,
    "entirely from scratch, for a first-time user. Work autonomously and finish with the file",
    "/workspace/out/walkthrough.mp4. All tooling is installed; you have full permissions and network access.",
    "",
    "The app can be ANY stack (Node/Next/Vite, Python/Flask/Django, Go, Rails, a static site, etc.) —",
    "do NOT assume a language, command, framework, port, or any selectors. Figure it all out yourself.",
    "",
    "Reference: the reusable recording/render pipeline + how-to are in /workspace/instructions",
    "(read docs/04-extend-or-replicate.md and video-project/HANDOFF-onboarding-videos.md). A ready-to-run",
    "copy of that pipeline (npm deps + Remotion browser pre-installed) is at /opt/video-project — author and run it there.",
    "",
    "Do this end to end:",
    `1) Inspect ${repoDir}: read the README and whatever manifests exist (package.json, requirements.txt/`,
    "   pyproject, Gemfile, go.mod, Dockerfile/compose, Procfile/Makefile, .env(.example)) to learn what the",
    "   app is and how it is meant to be installed and started.",
    "2) Install its dependencies and START the app the way the project intends. Determine the host:port/URL it",
    "   serves on by reading its own startup output (do not assume a port). Wait until that URL returns 200",
    "   before recording (the first request may be slow).",
    "3) cp /workspace/instructions/video-project/.eleven_key /opt/video-project/.eleven_key",
    "4) In /opt/video-project author record/tour.mjs FROM SCRATCH for THIS app:",
    "   export META = { baseUrl: '<the URL you found>', startUrl: '<entry path>', viewport: { width: 1440, height: 900 } }",
    "   and STEPS = 6–9 objects { id, est, narration, run: async (drv) => {…} } using the drv helpers",
    "   (moveTo, click, scrollBy, scrollToTop, pause). Explore the RUNNING UI (curl pages / read the served",
    "   markup) to pick real selectors, then walk a new user through the app's core flow end to end.",
    "   Narration: warm, plain, instructional — say what the user can DO, not just what they see.",
    "5) cd /opt/video-project && node walk-tts.mjs   (ElevenLabs narration)",
    "6) node _runtour.mjs                            (records against the running app)",
    "7) mkdir -p /workspace/out && npx remotion render src/index.ts Walkthrough /workspace/out/walkthrough.mp4 --overwrite",
    "8) Verify /workspace/out/walkthrough.mp4 exists and is non-empty; print its size. If any step fails, debug and retry.",
    "Think out loud as you go.",
  ].join("\n");

export function createJob({ repo = "demo", token = null } = {}) {
  const id = crypto.randomBytes(6).toString("hex");
  const dir = path.join(JOBS_DIR, id);
  const job = {
    id,
    repo,
    token, // GitHub OAuth token for a real repo; stays server-side, never in jobView
    status: "queued", // queued | running | done | error | canceled
    createdAt: Date.now(),
    startedAt: null,
    endedAt: null,
    dir,
    videoPath: path.join(dir, "result", "walkthrough.mp4"),
    container: `codex-job-${id}`,
    proc: null,
    error: null,
    events: [],
    subscribers: new Set(),
  };
  jobs.set(id, job);
  queue.push(id);
  pump();
  return job;
}

export function getJob(id) {
  return jobs.get(id);
}

export function jobView(job) {
  if (!job) return null;
  return {
    id: job.id,
    status: job.status,
    position: job.status === "queued" ? Math.max(0, queue.indexOf(job.id)) : -1,
    videoReady: fs.existsSync(job.videoPath),
    error: job.error,
  };
}

function writeSse(res, event, data) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

function emit(job, event, data) {
  job.events.push({ event, data });
  for (const res of job.subscribers) writeSse(res, event, data);
}

// Replay everything so far, then (if still live) attach for new events.
export function subscribe(job, res) {
  for (const e of job.events) writeSse(res, e.event, e.data);
  if (job.status === "done" || job.status === "error" || job.status === "canceled") {
    writeSse(res, "end", { status: job.status, videoReady: fs.existsSync(job.videoPath), error: job.error });
    res.end();
    return;
  }
  job.subscribers.add(res);
}
export function unsubscribe(job, res) {
  job.subscribers.delete(res);
}

export function cancelJob(job) {
  if (!job || job.status === "done" || job.status === "error") return;
  if (job.status === "queued") {
    const i = queue.indexOf(job.id);
    if (i >= 0) queue.splice(i, 1);
  }
  job.status = "canceled";
  if (job.proc) {
    try {
      job.proc.kill("SIGKILL");
    } catch {}
  }
  try {
    spawn("docker", ["kill", job.container]);
  } catch {}
  emit(job, "end", { status: "canceled" });
}

function pump() {
  while (active < MAX_CONCURRENT && queue.length) {
    const id = queue.shift();
    const job = jobs.get(id);
    if (!job || job.status === "canceled") continue;
    active++;
    runJob(job).finally(() => {
      active--;
      pump();
    });
  }
  // refresh queue positions for everyone still waiting
  for (const id of queue) {
    const j = jobs.get(id);
    if (j) emit(j, "status", jobView(j));
  }
}

// Download the selected GitHub repo as a tarball (server-side, with the user's
// OAuth token) and extract it into the per-job scratch dir. The token stays on
// the host and never enters the agent container — the container only ever sees
// plain source files. This is the same throwaway checkout the demo uses, just
// sourced from GitHub instead of the bundled demo-repo/.
async function fetchRepoTarball(job, dst) {
  if (!job.token) throw new Error("no GitHub token for this job");
  emit(job, "notice", { text: `Fetching ${job.repo} from GitHub…` });
  const r = await fetch(`https://api.github.com/repos/${job.repo}/tarball`, {
    headers: {
      Authorization: `Bearer ${job.token}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "repo-to-demo-app",
    },
    redirect: "follow",
  });
  if (!r.ok || !r.body) throw new Error(`GitHub tarball download failed (${r.status} ${r.statusText})`);
  const tarPath = path.join(job.dir, "repo.tar.gz");
  await new Promise((resolve, reject) => {
    const out = fs.createWriteStream(tarPath);
    Readable.fromWeb(r.body).pipe(out).on("finish", resolve).on("error", reject);
  });
  fs.mkdirSync(dst, { recursive: true });
  // GitHub tarballs nest everything under one "<owner>-<repo>-<sha>/" dir.
  await new Promise((resolve, reject) => {
    const p = spawn("tar", ["xzf", tarPath, "-C", dst, "--strip-components=1"]);
    p.on("close", (c) => (c === 0 ? resolve() : reject(new Error(`tar extract failed (exit ${c})`))));
    p.on("error", reject);
  });
  fs.rmSync(tarPath, { force: true });
}

async function prepareWorkspace(job) {
  fs.mkdirSync(path.join(job.dir, "result"), { recursive: true });
  // throwaway checkout of the target repo (deleted when the job ends)
  const repoDst = path.join(job.dir, "repo");
  if (job.repo === "demo") {
    fs.cpSync(DEMO_REPO, repoDst, { recursive: true });
  } else {
    await fetchRepoTarball(job, repoDst);
  }
  // per-job CODEX_HOME so concurrent runs don't share sessions/auth state
  const home = path.join(job.dir, "codex-home");
  fs.mkdirSync(home, { recursive: true });
  fs.copyFileSync(path.join(CODEX_HOME, "config.toml"), path.join(home, "config.toml"));
  fs.copyFileSync(path.join(CODEX_HOME, "auth.json"), path.join(home, "auth.json"));
  return { repoDst, home };
}

async function runJob(job) {
  if (job.status === "canceled") return;
  let repoDst, home;
  try {
    job.status = "running";
    job.startedAt = Date.now();
    emit(job, "status", jobView(job));
    ({ repoDst, home } = await prepareWorkspace(job));

    const args = [
      "run", "--rm", "--name", job.container,
      "--cpus", JOB_CPUS, "--memory", JOB_MEMORY,
      "-v", `${repoDst}:/workspace/repo`,
      "-v", `${INSTRUCTIONS}:/workspace/instructions:ro`,
      "-v", `${path.join(job.dir, "result")}:/workspace/out`,
      "-v", `${home}:/codex-home`,
      "-e", "CODEX_HOME=/codex-home",
      IMAGE,
      "codex", "exec", "--json", "--skip-git-repo-check", "--cd", "/workspace", agentTask("/workspace/repo"),
    ];

    const child = spawn("docker", args, { stdio: ["ignore", "pipe", "pipe"] });
    job.proc = child;
    let buf = "";
    child.stdout.on("data", (d) => {
      buf += d.toString();
      let nl;
      while ((nl = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, nl).trim();
        buf = buf.slice(nl + 1);
        if (!line) continue;
        try {
          emit(job, "codex", JSON.parse(line));
        } catch {
          emit(job, "log", { text: line });
        }
      }
    });
    child.stderr.on("data", (d) => emit(job, "log", { text: d.toString() }));

    await new Promise((resolve) => {
      child.on("close", () => resolve());
      child.on("error", (e) => {
        job.error = `Could not start container: ${e.message}`;
        resolve();
      });
    });

    if (job.status !== "canceled") {
      const ok = fs.existsSync(job.videoPath);
      job.status = ok ? "done" : "error";
      if (!ok && !job.error) job.error = "agent finished without producing /workspace/out/walkthrough.mp4";
      // Demo redo: refresh the cached "first" video so the next visitor sees the latest.
      if (ok && job.repo === "demo") {
        try {
          fs.copyFileSync(job.videoPath, DEMO_CACHE);
        } catch {}
      }
      job.endedAt = Date.now();
      emit(job, "end", { status: job.status, videoReady: ok, error: job.error });
    }
  } catch (e) {
    job.status = "error";
    job.error = String(e?.message || e);
    emit(job, "end", { status: "error", error: job.error });
  } finally {
    job.proc = null;
    for (const res of job.subscribers) {
      try {
        res.end();
      } catch {}
    }
    job.subscribers.clear();
    // keep result/ (the video); drop the bulky throwaway inputs
    for (const p of [repoDst, home]) {
      if (p) {
        try {
          fs.rmSync(p, { recursive: true, force: true });
        } catch {}
      }
    }
  }
}
