import { useState } from "react";
import { CodeExplorer } from "./CodeExplorer";

// Left pane for a selected repo: a "Code" tab (the file explorer) and an "Env"
// tab where you can paste .env-style vars that get written into the repo before
// the walkthrough agent runs. Both panes stay mounted so the code explorer keeps
// its state (and doesn't refetch) when you switch tabs.
export function RepoPanel({
  repo,
  env,
  onEnvChange,
}: {
  repo: string;
  env: string;
  onEnvChange: (v: string) => void;
}) {
  const [tab, setTab] = useState<"code" | "env">("code");
  return (
    <div className="repo-panel">
      <div className="repo-tabs">
        <button className={`repo-tab ${tab === "code" ? "active" : ""}`} onClick={() => setTab("code")}>
          Code
        </button>
        <button className={`repo-tab ${tab === "env" ? "active" : ""}`} onClick={() => setTab("env")}>
          Env{env.trim() ? <span className="repo-tab-dot" /> : null}
        </button>
      </div>
      <div className="repo-tab-body">
        <div className="repo-tab-pane" style={{ display: tab === "code" ? "flex" : "none" }}>
          <CodeExplorer repo={repo} />
        </div>
        <div className="repo-tab-pane" style={{ display: tab === "env" ? "flex" : "none" }}>
          <div className="env-editor">
            <p className="env-hint">
              Optional. One <code>KEY=VALUE</code> per line — written to <code>.env</code> in the repo before the
              walkthrough runs. Add these if the app needs secrets (database URL, API keys) to start. They live only
              in the throwaway job workspace and are never committed.
            </p>
            <textarea
              className="env-textarea"
              spellCheck={false}
              autoCapitalize="off"
              autoCorrect="off"
              placeholder={"DATABASE_URL=postgres://user:pass@host:5432/db\nAPI_KEY=sk-...\nNEXT_PUBLIC_FOO=bar"}
              value={env}
              onChange={(e) => onEnvChange(e.target.value)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
