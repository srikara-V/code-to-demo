// Job engine: each "generate a walkthrough" request becomes a Job. The engine
// (queue, state machine, per-job event buffer + SSE, cancel) is environment-
// agnostic. WHERE a job's container actually runs is pluggable via a "runner":
//   - localDockerRunner  → `docker run --rm` on this host (dev / self-hosted).
//   - cloudRunJobsRunner → a Cloud Run Job execution (pay-per-use, scales to
//                           zero when idle) with inputs/outputs on GCS.
// The runner is picked from the environment (see `runner` at the bottom): local
// by default, cloudrun when running on Cloud Run (K_SERVICE set) or when
// JOB_BACKEND=cloudrun. In-memory job state only; no database.
import { spawn } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
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
    proc: null, // local: the docker child process
    cloud: null, // cloudrun: { execution, videoReady, videoUri } bookkeeping
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
    videoReady: runner.videoReady(job),
    error: job.error,
  };
}

// Serve a finished job's video (backend-aware: local file vs. GCS). Exported so
// the HTTP layer stays agnostic to where the video actually lives.
export function serveJobVideo(job, res) {
  return runner.serveVideo(job, res);
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
    writeSse(res, "end", { status: job.status, videoReady: runner.videoReady(job), error: job.error });
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
  try {
    runner.cancel(job);
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

// Orchestrator: environment-agnostic. Drives status transitions + the event
// stream and delegates the actual container execution to the selected runner.
async function runJob(job) {
  if (job.status === "canceled") return;
  try {
    job.status = "running";
    job.startedAt = Date.now();
    emit(job, "status", jobView(job));

    const { ok, error } = await runner.run(job);

    if (job.status === "canceled") return;
    job.status = ok ? "done" : "error";
    if (!ok && !job.error) job.error = error || "job failed";
    // Demo redo: refresh the cached "first" video so the next visitor sees the latest.
    if (ok && job.repo === "demo") {
      try {
        runner.refreshDemoCache(job);
      } catch {}
    }
    job.endedAt = Date.now();
    emit(job, "end", { status: job.status, videoReady: runner.videoReady(job), error: job.error });
  } catch (e) {
    job.status = "error";
    job.error = String(e?.message || e);
    emit(job, "end", { status: "error", error: job.error });
  } finally {
    for (const res of job.subscribers) {
      try {
        res.end();
      } catch {}
    }
    job.subscribers.clear();
  }
}

// ---------------------------------------------------------------------------
// Shared input helper: download a GitHub repo tarball to a local file. The
// user's OAuth token stays server-side; the container only ever sees source.
// ---------------------------------------------------------------------------
async function fetchTarball(job, tarPath) {
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
  await new Promise((resolve, reject) => {
    const out = fs.createWriteStream(tarPath);
    Readable.fromWeb(r.body).pipe(out).on("finish", resolve).on("error", reject);
  });
}

// ===========================================================================
// LOCAL runner — `docker run --rm` on this host, with host bind-mounts. This is
// exactly the original behavior (dev / self-hosted).
// ===========================================================================
async function prepareWorkspace(job) {
  fs.mkdirSync(path.join(job.dir, "result"), { recursive: true });
  // throwaway checkout of the target repo (deleted when the job ends)
  const repoDst = path.join(job.dir, "repo");
  if (job.repo === "demo") {
    fs.cpSync(DEMO_REPO, repoDst, { recursive: true });
  } else {
    const tarPath = path.join(job.dir, "repo.tar.gz");
    await fetchTarball(job, tarPath);
    fs.mkdirSync(repoDst, { recursive: true });
    // GitHub tarballs nest everything under one "<owner>-<repo>-<sha>/" dir.
    await new Promise((resolve, reject) => {
      const p = spawn("tar", ["xzf", tarPath, "-C", repoDst, "--strip-components=1"]);
      p.on("close", (c) => (c === 0 ? resolve() : reject(new Error(`tar extract failed (exit ${c})`))));
      p.on("error", reject);
    });
    fs.rmSync(tarPath, { force: true });
  }
  // per-job CODEX_HOME so concurrent runs don't share sessions/auth state
  const home = path.join(job.dir, "codex-home");
  fs.mkdirSync(home, { recursive: true });
  fs.copyFileSync(path.join(CODEX_HOME, "config.toml"), path.join(home, "config.toml"));
  fs.copyFileSync(path.join(CODEX_HOME, "auth.json"), path.join(home, "auth.json"));
  return { repoDst, home };
}

const localDockerRunner = {
  async run(job) {
    let repoDst, home;
    try {
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

      if (job.status === "canceled") return { ok: false };
      const ok = fs.existsSync(job.videoPath);
      return { ok, error: ok ? null : job.error || "agent finished without producing /workspace/out/walkthrough.mp4" };
    } catch (e) {
      return { ok: false, error: String(e?.message || e) };
    } finally {
      job.proc = null;
      // keep result/ (the video); drop the bulky throwaway inputs
      for (const p of [repoDst, home]) {
        if (p) {
          try {
            fs.rmSync(p, { recursive: true, force: true });
          } catch {}
        }
      }
    }
  },
  cancel(job) {
    if (job.proc) {
      try {
        job.proc.kill("SIGKILL");
      } catch {}
    }
    try {
      spawn("docker", ["kill", job.container]);
    } catch {}
  },
  videoReady(job) {
    return fs.existsSync(job.videoPath);
  },
  serveVideo(job, res) {
    if (!fs.existsSync(job.videoPath)) return res.status(404).json({ error: "no video" });
    res.sendFile(job.videoPath);
  },
  refreshDemoCache(job) {
    try {
      fs.copyFileSync(job.videoPath, DEMO_CACHE);
    } catch {}
  },
};

// ===========================================================================
// CLOUD RUN runner — each job is a Cloud Run Job execution: pay-per-use, scales
// to zero when idle. Inputs/outputs go through GCS; the token never enters the
// job container. Requires (deploy-time): the codex image deployed as a Cloud Run
// Job, a GCS bucket, Secret Manager for codex/ElevenLabs creds baked into the
// job, and these deps: @google-cloud/run, @google-cloud/storage, @google-cloud/logging.
//
// NOTE: This path is wired but only runs in a configured GCP environment; it is
// dynamic-imported so local dev needs none of the above installed.
// ===========================================================================
const GCP = {
  project: process.env.GCP_PROJECT || process.env.GOOGLE_CLOUD_PROJECT,
  region: process.env.GCP_REGION || "us-central1",
  jobName: process.env.CODEX_JOB_NAME, // the deployed Cloud Run Job resource name
  bucket: process.env.GCS_BUCKET, // gs bucket for per-job inputs/outputs
};
const gcsKey = (job, name) => `jobs/${job.id}/${name}`;

const cloudRunJobsRunner = {
  async run(job) {
    for (const [k, v] of Object.entries(GCP)) {
      if (!v) return { ok: false, error: `Cloud Run backend not configured: missing ${k} (set env vars + deploy the job)` };
    }
    let Storage, JobsClient;
    try {
      ({ Storage } = await import("@google-cloud/storage"));
      ({ JobsClient } = await import("@google-cloud/run").then((m) => m.v2));
    } catch {
      return { ok: false, error: "Cloud Run backend deps missing: npm i @google-cloud/run @google-cloud/storage @google-cloud/logging" };
    }
    const storage = new Storage({ projectId: GCP.project });
    const bucket = storage.bucket(GCP.bucket);
    const outKey = gcsKey(job, "walkthrough.mp4");
    job.cloud = { videoReady: false, videoUri: `gs://${GCP.bucket}/${outKey}` };

    // 1) Stage the repo tarball in GCS (demo: bundle demo-repo; real: GitHub).
    emit(job, "notice", { text: "Staging repo for the cloud job…" });
    const tmp = path.join(os.tmpdir(), `job-${job.id}.tar.gz`);
    try {
      if (job.repo === "demo") {
        await new Promise((resolve, reject) => {
          const p = spawn("tar", ["czf", tmp, "-C", DEMO_REPO, "."]);
          p.on("close", (c) => (c === 0 ? resolve() : reject(new Error("tar failed"))));
          p.on("error", reject);
        });
      } else {
        await fetchTarball(job, tmp);
      }
      await bucket.upload(tmp, { destination: gcsKey(job, "repo.tar.gz") });
    } finally {
      fs.rmSync(tmp, { force: true });
    }

    // 2) Trigger the Cloud Run Job execution with per-run overrides. The image's
    //    entrypoint pulls repo.tar.gz from GCS, runs the agent, uploads the mp4.
    emit(job, "notice", { text: "Launching Cloud Run job…" });
    const runClient = new JobsClient();
    const name = `projects/${GCP.project}/locations/${GCP.region}/jobs/${GCP.jobName}`;
    const [op] = await runClient.runJob({
      name,
      overrides: {
        containerOverrides: [
          {
            env: [
              { name: "JOB_ID", value: job.id },
              { name: "REPO_TARBALL_GCS", value: `gs://${GCP.bucket}/${gcsKey(job, "repo.tar.gz")}` },
              { name: "OUTPUT_GCS", value: job.cloud.videoUri },
            ],
          },
        ],
      },
    });
    const executionName = op.metadata?.name;
    job.cloud.execution = executionName;

    // 3) Stream the execution's stdout (codex --json) from Cloud Logging while
    //    we wait for it to finish, re-emitting the same SSE events the UI expects.
    const stopLogs = tailExecutionLogs(job, executionName);
    try {
      await op.promise();
    } finally {
      await stopLogs();
    }

    // 4) Success == the output object exists in GCS.
    const [exists] = await bucket.file(outKey).exists();
    job.cloud.videoReady = exists;
    return { ok: exists, error: exists ? null : "cloud job finished without producing the video" };
  },
  cancel(job) {
    if (!job.cloud?.execution) return;
    import("@google-cloud/run")
      .then((m) => new m.v2.ExecutionsClient().cancelExecution({ name: job.cloud.execution }))
      .catch(() => {});
  },
  videoReady(job) {
    return !!job.cloud?.videoReady;
  },
  async serveVideo(job, res) {
    if (!job.cloud?.videoReady) return res.status(404).json({ error: "no video" });
    try {
      const { Storage } = await import("@google-cloud/storage");
      const [url] = await new Storage({ projectId: GCP.project })
        .bucket(GCP.bucket)
        .file(gcsKey(job, "walkthrough.mp4"))
        .getSignedUrl({ action: "read", expires: Date.now() + 60 * 60 * 1000 });
      res.redirect(url);
    } catch (e) {
      res.status(500).json({ error: String(e?.message || e) });
    }
  },
  refreshDemoCache(job) {
    // Copy the produced object to the cloud demo-cache key (best-effort).
    import("@google-cloud/storage")
      .then(({ Storage }) => {
        const bucket = new Storage({ projectId: GCP.project }).bucket(GCP.bucket);
        return bucket.file(gcsKey(job, "walkthrough.mp4")).copy(bucket.file("demo/walkthrough.mp4"));
      })
      .catch(() => {});
  },
};

// Tail a Cloud Run Job execution's stdout via Cloud Logging, re-emitting each
// codex `--json` line as a "codex" SSE event (falling back to "log"). Returns a
// stop() that drains once more and detaches. Polling keeps deps/quotas simple.
function tailExecutionLogs(job, executionName) {
  let stopped = false;
  let cursor = new Date(Date.now() - 5000).toISOString();
  const execId = executionName?.split("/").pop();
  const filter = () =>
    `resource.type="cloud_run_job" labels."run.googleapis.com/execution_name"="${execId}" timestamp>"${cursor}"`;
  const drain = async () => {
    try {
      const { Logging } = await import("@google-cloud/logging");
      const logging = new Logging({ projectId: GCP.project });
      const [entries] = await logging.getEntries({ filter: filter(), orderBy: "timestamp asc", pageSize: 200 });
      for (const e of entries) {
        if (e.metadata?.timestamp) cursor = new Date(e.metadata.timestamp).toISOString();
        const d = e.data;
        if (d && typeof d === "object") {
          // jsonPayload: codex `--json` emits its events as structured logs, so
          // `d` IS the event object the UI's codexLine() expects.
          emit(job, "codex", d);
        } else {
          const text = String(d ?? "").trim();
          if (!text) continue;
          try {
            emit(job, "codex", JSON.parse(text));
          } catch {
            emit(job, "log", { text });
          }
        }
      }
    } catch {
      /* transient logging error; try again next tick */
    }
  };
  const timer = setInterval(() => {
    if (!stopped) drain();
  }, 2500);
  return async () => {
    stopped = true;
    clearInterval(timer);
    await drain();
  };
}

// ---------------------------------------------------------------------------
// Runner selection: local by default; cloudrun on Cloud Run (K_SERVICE is set
// by the platform) or when explicitly forced with JOB_BACKEND=cloudrun.
// ---------------------------------------------------------------------------
const BACKEND = (process.env.JOB_BACKEND || (process.env.K_SERVICE ? "cloudrun" : "local")).toLowerCase();
const runner = BACKEND === "cloudrun" ? cloudRunJobsRunner : localDockerRunner;
console.log(`[jobs] execution backend: ${BACKEND}`);
