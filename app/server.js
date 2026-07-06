// Minimal GitHub OAuth backend. The browser cannot complete GitHub's OAuth
// (the token endpoint has no CORS and needs the client secret), so this tiny
// proxy handles the code->token exchange, keeps the token in an httpOnly cookie,
// and exposes /api/me and /api/repos. No database, no session store.
import express from "express";
import cookieParser from "cookie-parser";
import crypto from "node:crypto";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { createJob, getJob, jobView, subscribe, unsubscribe, cancelJob, serveJobVideo, demoVideoReady, serveDemoVideo } from "./jobs.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEMO_DIR = path.resolve(__dirname, "../demo-repo");
const HIDE_FILES = new Set([".env", ".DS_Store"]); // never expose secrets
const SKIP_DIRS = new Set(["__pycache__", "node_modules", ".git", ".venv", "venv", ".idea", ".vscode"]);

// Flatten the demo repo into a list the editor's file tree can render.
function listFiles(dir, base = "") {
  const out = [];
  for (const name of fs.readdirSync(dir).sort()) {
    if (HIDE_FILES.has(name)) continue;
    const abs = path.join(dir, name);
    const rel = base ? `${base}/${name}` : name;
    const st = fs.statSync(abs);
    if (st.isDirectory()) {
      if (SKIP_DIRS.has(name)) continue;
      out.push({ path: rel, type: "dir" });
      out.push(...listFiles(abs, rel));
    } else {
      out.push({ path: rel, type: "file", size: st.size });
    }
  }
  return out;
}

const LANG_BY_EXT = { py: "python", md: "markdown", json: "json", txt: "text", js: "javascript", ts: "typescript", sh: "bash" };

const {
  GITHUB_CLIENT_ID,
  GITHUB_CLIENT_SECRET,
  OAUTH_SCOPE = "read:user repo",
  FRONTEND_URL = "http://localhost:5173",
  PORT = 3001,
} = process.env;

const REDIRECT_URI = `${FRONTEND_URL}/api/auth/github/callback`;
const COOKIE = { httpOnly: true, sameSite: "lax", path: "/" };

const app = express();
app.use(cookieParser());
app.use(express.json());

// Guard: fail loudly (not silently) if the app credentials are not configured.
const missingCreds = (res) => {
  if (GITHUB_CLIENT_ID && GITHUB_CLIENT_SECRET) return false;
  res.status(500).json({
    error:
      "Backend is missing GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET. Copy app/.env.example to app/.env, register an OAuth app, and fill them in.",
  });
  return true;
};

const gh = (token, path) =>
  fetch("https://api.github.com" + path, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "repo-to-demo-app",
    },
  });

// Step 1: send the user to GitHub's authorize screen (with a CSRF state).
app.get("/api/auth/github/login", (req, res) => {
  if (missingCreds(res)) return;
  const state = crypto.randomBytes(16).toString("hex");
  res.cookie("gh_state", state, { ...COOKIE, maxAge: 10 * 60 * 1000 });
  const u = new URL("https://github.com/login/oauth/authorize");
  u.searchParams.set("client_id", GITHUB_CLIENT_ID);
  u.searchParams.set("redirect_uri", REDIRECT_URI);
  u.searchParams.set("scope", OAUTH_SCOPE);
  u.searchParams.set("state", state);
  res.redirect(u.toString());
});

// Step 2: GitHub redirects back here with ?code; exchange it for a token.
app.get("/api/auth/github/callback", async (req, res) => {
  if (missingCreds(res)) return;
  const { code, state } = req.query;
  if (!code || !state || state !== req.cookies.gh_state) {
    return res.status(400).send("Invalid OAuth state. <a href='/'>Back</a>");
  }
  res.clearCookie("gh_state", COOKIE);
  const r = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      client_id: GITHUB_CLIENT_ID,
      client_secret: GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: REDIRECT_URI,
    }),
  });
  const data = await r.json();
  if (!data.access_token) {
    const msg = data.error_description || data.error || "no access_token returned";
    return res.status(401).send(`OAuth failed: ${msg}. <a href='/'>Back</a>`);
  }
  res.cookie("gh_token", data.access_token, { ...COOKIE, maxAge: 7 * 24 * 60 * 60 * 1000 });
  res.redirect(FRONTEND_URL + "/");
});

// Who is connected (used by the frontend to decide login vs. connected view).
app.get("/api/me", async (req, res) => {
  const token = req.cookies.gh_token;
  if (!token) return res.status(401).json({ error: "not connected" });
  const r = await gh(token, "/user");
  if (!r.ok) return res.status(401).json({ error: "token invalid or expired" });
  const u = await r.json();
  res.json({ login: u.login, name: u.name, avatar_url: u.avatar_url });
});

// The repos the user granted access to — for the dropdown.
app.get("/api/repos", async (req, res) => {
  const token = req.cookies.gh_token;
  if (!token) return res.status(401).json({ error: "not connected" });
  const repos = [];
  for (let page = 1; page <= 5; page++) {
    const r = await gh(
      token,
      `/user/repos?per_page=100&sort=updated&affiliation=owner,collaborator,organization_member&page=${page}`
    );
    if (!r.ok) return res.status(401).json({ error: "failed to list repos" });
    const batch = await r.json();
    for (const x of batch) repos.push({ full_name: x.full_name, name: x.name, private: x.private, url: x.html_url });
    if (batch.length < 100) break;
  }
  res.json({ repos });
});

app.post("/api/auth/github/logout", (req, res) => {
  res.clearCookie("gh_token", COOKIE);
  res.json({ ok: true });
});

// --- Jobs: one isolated container per generation, bounded queue --------------
// Create a job (returns immediately; it queues + runs in its own container).
app.post("/api/jobs", (req, res) => {
  const repo = (req.body && req.body.repo) || "demo";
  // Optional repo-level env vars (.env content) written into the repo before the
  // agent runs. Capped so it can't be abused as bulk storage.
  const env = (req.body && typeof req.body.env === "string" ? req.body.env : "").slice(0, 64_000);
  // Real repos need the user's token (to fetch the tarball server-side); the demo
  // uses the bundled repo and needs none.
  let token = null;
  if (repo !== "demo") {
    token = req.cookies.gh_token;
    if (!token) return res.status(401).json({ error: "not connected" });
  }
  const job = createJob({ repo, token, env });
  res.json(jobView(job));
});
// Poll a job's status (queued/running/done/error + queue position + videoReady).
app.get("/api/jobs/:id", (req, res) => {
  const job = getJob(req.params.id);
  if (!job) return res.status(404).json({ error: "no such job" });
  res.json(jobView(job));
});
// Live event stream for a job (replays from the start, then tails). The run is
// decoupled from this connection — disconnecting does NOT cancel the job.
app.get("/api/jobs/:id/events", (req, res) => {
  const job = getJob(req.params.id);
  if (!job) return res.status(404).json({ error: "no such job" });
  res.set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  res.flushHeaders?.();
  subscribe(job, res);
  req.on("close", () => unsubscribe(job, res));
});
// Serve the video that job produced (backend-aware: local file or GCS redirect).
app.get("/api/jobs/:id/video", (req, res) => {
  const job = getJob(req.params.id);
  if (!job) return res.status(404).json({ error: "no video" });
  return serveJobVideo(job, res);
});

// Demo only: the cached "first" walkthrough, shown instantly (the redo button
// kicks off a fresh job which refreshes this on success — see jobs.js). Backend-
// aware: local mode reads a file on disk, cloud mode the GCS demo-cache object.
app.get("/api/demo/has-video", async (req, res) => res.json({ ready: await demoVideoReady() }));
app.get("/api/demo/cached-video", (req, res) => serveDemoVideo(res));
// Explicit cancel (kills the container + dequeues).
app.post("/api/jobs/:id/cancel", (req, res) => {
  const job = getJob(req.params.id);
  if (job) cancelJob(job);
  res.json({ ok: true });
});

// Demo repo file tree + file contents for the mini editor.
app.get("/api/demo/files", (req, res) => {
  try {
    res.json({ root: "fee-calculator", files: listFiles(DEMO_DIR) });
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});
app.get("/api/demo/file", (req, res) => {
  const rel = String(req.query.path || "");
  if (!rel || rel.includes("..") || rel.startsWith("/") || HIDE_FILES.has(path.basename(rel))) {
    return res.status(400).json({ error: "invalid path" });
  }
  const abs = path.resolve(DEMO_DIR, rel);
  if (abs !== DEMO_DIR && !abs.startsWith(DEMO_DIR + path.sep)) return res.status(400).json({ error: "out of bounds" });
  if (!fs.existsSync(abs) || fs.statSync(abs).isDirectory()) return res.status(404).json({ error: "not found" });
  const ext = path.extname(rel).slice(1).toLowerCase();
  const language = LANG_BY_EXT[ext] || "text";
  if (fs.statSync(abs).size > 600_000) return res.json({ path: rel, content: "// file too large to preview", language: "text" });
  res.json({ path: rel, content: fs.readFileSync(abs, "utf8"), language });
});

// Real repo file tree + file contents (from GitHub, with the user's token) — the
// same shape the demo endpoints return, so CodeExplorer renders either one.
const isRepo = (s) => /^[^/\s]+\/[^/\s]+$/.test(s);

app.get("/api/repo/files", async (req, res) => {
  const token = req.cookies.gh_token;
  if (!token) return res.status(401).json({ error: "not connected" });
  const repo = String(req.query.repo || "");
  if (!isRepo(repo)) return res.status(400).json({ error: "invalid repo" });
  try {
    const info = await gh(token, `/repos/${repo}`);
    if (!info.ok) return res.status(info.status).json({ error: "repo not found" });
    const { default_branch, name } = await info.json();
    const tr = await gh(token, `/repos/${repo}/git/trees/${encodeURIComponent(default_branch)}?recursive=1`);
    if (!tr.ok) return res.status(tr.status).json({ error: "failed to list files" });
    const tree = await tr.json();
    const files = [];
    for (const e of tree.tree || []) {
      const parts = e.path.split("/");
      if (parts.some((seg) => SKIP_DIRS.has(seg))) continue;
      if (HIDE_FILES.has(parts[parts.length - 1])) continue;
      if (e.type === "tree") files.push({ path: e.path, type: "dir" });
      else if (e.type === "blob") files.push({ path: e.path, type: "file", size: e.size });
    }
    files.sort((a, b) => a.path.localeCompare(b.path));
    res.json({ root: name, files, truncated: !!tree.truncated });
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

app.get("/api/repo/file", async (req, res) => {
  const token = req.cookies.gh_token;
  if (!token) return res.status(401).json({ error: "not connected" });
  const repo = String(req.query.repo || "");
  const rel = String(req.query.path || "");
  if (!isRepo(repo)) return res.status(400).json({ error: "invalid repo" });
  if (!rel || rel.includes("..") || rel.startsWith("/") || HIDE_FILES.has(path.basename(rel))) {
    return res.status(400).json({ error: "invalid path" });
  }
  try {
    const encoded = rel.split("/").map(encodeURIComponent).join("/");
    const r = await gh(token, `/repos/${repo}/contents/${encoded}`);
    if (!r.ok) return res.status(r.status).json({ error: "not found" });
    const d = await r.json();
    if (Array.isArray(d) || d.type !== "file") return res.status(400).json({ error: "not a file" });
    const ext = path.extname(rel).slice(1).toLowerCase();
    const language = LANG_BY_EXT[ext] || "text";
    if ((d.size || 0) > 600_000) return res.json({ path: rel, content: "// file too large to preview", language: "text" });
    const content = d.encoding === "base64" ? Buffer.from(d.content, "base64").toString("utf8") : d.content || "";
    res.json({ path: rel, content, language });
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

// In production, serve the built frontend (app/dist) from THIS origin so the
// browser hits one host for both the SPA and /api — keeps the httpOnly auth
// cookie same-site (no CORS, no proxy). Enabled automatically when a build exists.
const DIST = path.resolve(__dirname, "dist");
if (fs.existsSync(DIST)) {
  app.use(express.static(DIST));
  // SPA fallback: any non-/api route serves index.html.
  app.get(/^\/(?!api\/).*/, (req, res) => res.sendFile(path.join(DIST, "index.html")));
  console.log(`serving frontend from ${DIST}`);
}

app.listen(PORT, () => console.log(`auth server on http://localhost:${PORT}  (redirect_uri = ${REDIRECT_URI})`));
