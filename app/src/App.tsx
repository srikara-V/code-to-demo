import { useEffect, useState } from "react";
import { SplitView } from "./SplitView";
import { CodeExplorer } from "./CodeExplorer";
import { RepoPanel } from "./RepoPanel";
import { AgentTranscript, codexLine, type AgentLine } from "./AgentStream";

type User = { login: string; name: string | null; avatar_url: string };
type Repo = { full_name: string; name: string; private: boolean; url: string };

export default function App() {
  const [status, setStatus] = useState<"loading" | "anon" | "authed">("loading");
  const [user, setUser] = useState<User | null>(null);
  const [repos, setRepos] = useState<Repo[]>([]);
  const [selected, setSelected] = useState("");
  const [demo, setDemo] = useState(false);
  const [demoActive, setDemoActive] = useState(false);
  const [agentLines, setAgentLines] = useState<AgentLine[]>([]);
  const [agentRunning, setAgentRunning] = useState(false);
  const [videoReady, setVideoReady] = useState(false);
  const [agentDone, setAgentDone] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [queuePos, setQueuePos] = useState<number>(-1);
  const [cachedReady, setCachedReady] = useState(false);
  const [videoOpen, setVideoOpen] = useState(true);
  const [runRepo, setRunRepo] = useState<string | null>(null); // repo of the active/last run
  const [agentError, setAgentError] = useState<string | null>(null);
  const [env, setEnv] = useState(""); // .env vars for the selected repo (Env tab)

  // "or try demo": skip GitHub, show the cached walkthrough instantly (the redo
  // button can regenerate it from scratch).
  const startDemo = async () => {
    setDemo(true);
    setUser({ login: "demo", name: "demo", avatar_url: "" });
    setRepos([{ full_name: "fee-calculator", name: "fee-calculator", private: false, url: "" }]);
    setSelected("fee-calculator");
    setDemoActive(true);
    setStatus("authed");
    const r = await fetch("/api/demo/has-video").then((x) => x.json()).catch(() => ({ ready: false }));
    setCachedReady(!!r.ready);
  };

  const disconnect = async () => {
    if (demo) {
      setDemo(false);
      setDemoActive(false);
      setAgentLines([]);
      setAgentRunning(false);
      setVideoReady(false);
      setAgentDone(false);
      setJobId(null);
      setQueuePos(-1);
      setCachedReady(false);
      setVideoOpen(true);
      setUser(null);
      setRepos([]);
      setSelected("");
      setStatus("anon");
      return;
    }
    await fetch("/api/auth/github/logout", { method: "POST" });
    location.reload();
  };

  // Create a job for `repo` ("demo" or a real full_name), then stream its event
  // log. The job runs in its own container and survives disconnects; many can
  // run/queue at once across users.
  const runJob = async (repo: string) => {
    setRunRepo(repo);
    setDemoActive(true);
    setAgentLines([]);
    setVideoReady(false);
    setAgentDone(false);
    setAgentError(null);
    setQueuePos(-1);
    setVideoOpen(true);
    setAgentRunning(true);
    const created = await (await fetch("/api/jobs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ repo, env }) })).json();
    if (!created.id) {
      setAgentRunning(false);
      setAgentDone(true);
      setAgentError(created.error || "Could not start the job.");
      return;
    }
    setJobId(created.id);
    setQueuePos(created.position ?? -1);

    const es = new EventSource(`/api/jobs/${created.id}/events`);
    es.addEventListener("status", (e) => {
      const v = JSON.parse((e as MessageEvent).data);
      setQueuePos(v.status === "queued" ? v.position : -1);
    });
    es.addEventListener("notice", (e) => {
      // Host-side progress (e.g. fetching the repo from GitHub) before the agent starts.
      const v = JSON.parse((e as MessageEvent).data);
      if (v?.text) setAgentLines((prev) => [...prev, { kind: "meta", text: v.text }]);
    });
    es.addEventListener("codex", (e) => {
      setQueuePos(-1);
      const line = codexLine(JSON.parse((e as MessageEvent).data));
      if (line) setAgentLines((prev) => [...prev, line]);
    });
    es.addEventListener("end", async (e) => {
      const v = JSON.parse((e as MessageEvent).data);
      setAgentRunning(false);
      setAgentDone(true);
      if (v.error) setAgentError(v.error);
      es.close();
      if (v.status === "done" || v.videoReady) {
        const head = await fetch(`/api/jobs/${created.id}/video`, { method: "HEAD" }).catch(() => null);
        setVideoReady(!!head?.ok);
      }
    });
    es.onerror = () => {
      // transient; EventSource auto-reconnects and the log replays
    };
  };

  useEffect(() => {
    (async () => {
      const me = await fetch("/api/me");
      if (!me.ok) {
        setStatus("anon");
        return;
      }
      setUser(await me.json());
      const r = await fetch("/api/repos");
      if (r.ok) setRepos((await r.json()).repos as Repo[]);
      setStatus("authed");
    })();
  }, []);

  // Entry point for the next step (generate the walkthrough for the chosen repo).
  // Wired and disabled until a repo is selected; the pipeline hook lands here.
  const onSubmit = (repo: string) => {
    if (!repo) return;
    runJob(repo);
  };

  // Switching to a different repo clears the previous run so the right pane
  // shows a fresh placeholder for the newly selected repo.
  const onSelectRepo = (repo: string) => {
    setSelected(repo);
    setEnv("");
    setRunRepo(null);
    setJobId(null);
    setAgentLines([]);
    setVideoReady(false);
    setAgentDone(false);
    setAgentError(null);
    setQueuePos(-1);
  };

  const generating = agentRunning;

  // Right pane for a run: a running job shows the live agent; otherwise the
  // (new or cached) video with a redo button to regenerate the same repo.
  const renderRunRight = () => {
    const jobActive = agentRunning || queuePos >= 0;
    const regenerate = () => runJob(demo ? "demo" : runRepo || selected);
    if (jobActive) {
      return (
        <div className="right-inner agent-pane">
          {queuePos >= 0 ? (
            <p className="muted small">Queued — position {queuePos + 1}. Waiting for a free worker…</p>
          ) : (
            <AgentTranscript lines={agentLines} running={agentRunning} />
          )}
        </div>
      );
    }
    const src = videoReady && jobId ? `/api/jobs/${jobId}/video` : cachedReady ? "/api/demo/cached-video" : null;
    return (
      <div className="right-inner video-pane">
        <button className="redo-btn" onClick={regenerate} title="Regenerate from scratch" aria-label="Regenerate from scratch">
          <RedoIcon />
        </button>
        {src ? (
          <video className="demo-video" src={src} controls playsInline />
        ) : (
          <p className="muted small">
            {demo ? "No demo video yet — hit ↻ to generate one from scratch." : "Press ↑ to generate a walkthrough for this repo."}
          </p>
        )}
        {agentDone && !videoReady && (
          <p className="muted small agent-note">
            {agentError || "The last run produced no video — hit ↻ to try again."}
          </p>
        )}
      </div>
    );
  };

  if (status === "loading") {
    return (
      <main className="wrap center">
        <p className="muted">Loading…</p>
      </main>
    );
  }

  if (status === "anon") {
    return (
      <main className="wrap center">
        <div className="connect">
          <button className="gh-btn" onClick={() => (window.location.href = "/api/auth/github/login")}>
            <GitHubMark />
            Connect to GitHub
          </button>
          <button className="demo-link" onClick={startDemo}>
            or try demo
          </button>
        </div>
      </main>
    );
  }

  return (
    <>
      <header className="corners">
        <span className="brand">
          <GitHubMark />
          <span className="muted">{user?.login}</span>
        </span>

        <div className="picker">
          <select
            id="repo"
            className="select"
            value={selected}
            disabled={demo || generating}
            onChange={(e) => onSelectRepo(e.target.value)}
          >
            <option value="" disabled>
              {repos.length ? "Select a repository…" : "No repositories found"}
            </option>
            {repos.map((r) => (
              <option key={r.full_name} value={r.full_name}>
                {r.full_name}
                {r.private ? "  ·  private" : ""}
              </option>
            ))}
          </select>
          {!demo && (
            <button
              className="submit"
              disabled={!selected || generating}
              aria-label="Continue"
              title="Continue"
              onClick={() => onSubmit(selected)}
            >
              <ArrowUp />
            </button>
          )}
        </div>

        <button className="link" onClick={disconnect}>
          {demo ? "Exit demo" : "Disconnect"}
        </button>
      </header>

      {demo && demoActive && (
        <SplitView
          left={<CodeExplorer />}
          rightOpen={videoOpen}
          onReopen={() => setVideoOpen(true)}
          right={
            <div className="right-wrap">
              <button className="panel-close" onClick={() => setVideoOpen(false)} title="Close panel" aria-label="Close panel">
                <CloseIcon />
              </button>
              {renderRunRight()}
            </div>
          }
        />
      )}

      {/* Real repo: Code + Env tabs on the left; the ↑ button starts the agent. */}
      {!demo && selected && (
        <SplitView
          left={<RepoPanel repo={selected} env={env} onEnvChange={setEnv} />}
          rightOpen={videoOpen}
          onReopen={() => setVideoOpen(true)}
          right={
            <div className="right-wrap">
              <button className="panel-close" onClick={() => setVideoOpen(false)} title="Close panel" aria-label="Close panel">
                <CloseIcon />
              </button>
              {renderRunRight()}
            </div>
          }
        />
      )}
    </>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <line x1="6" y1="6" x2="18" y2="18" />
      <line x1="18" y1="6" x2="6" y2="18" />
    </svg>
  );
}

function RedoIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 4 23 10 17 10" />
      <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
    </svg>
  );
}

function ArrowUp() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="19" x2="12" y2="5" />
      <polyline points="6 11 12 5 18 11" />
    </svg>
  );
}

function GitHubMark() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" fill="currentColor">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}
