import { useEffect, useRef } from "react";

export type AgentLine = { kind: "meta" | "reasoning" | "message" | "command" | "error"; text: string };

// Turn a codex `--json` JSONL event into a displayable transcript line (or null
// to skip). We render on item.completed to avoid duplicate started/completed pairs.
export function codexLine(ev: any): AgentLine | null {
  if (!ev || typeof ev !== "object") return null;
  if (ev.type === "thread.started") return { kind: "meta", text: "session started" };
  if (ev.type === "turn.completed") {
    const u = ev.usage;
    return u ? { kind: "meta", text: `turn complete · ${u.output_tokens ?? "?"} output tokens` } : null;
  }
  if (ev.type === "error") return { kind: "error", text: ev.message || "error" };
  if (ev.type === "item.completed") {
    const it = ev.item || {};
    if (it.type === "agent_message" && it.text) return { kind: "message", text: it.text };
    if (it.type === "reasoning" && (it.text || it.summary)) return { kind: "reasoning", text: it.text || it.summary };
    if (it.type === "command_execution" && it.command) return { kind: "command", text: it.command };
    if ((it.type === "local_shell_call" || it.type === "function_call") && (it.command || it.name))
      return { kind: "command", text: it.command || it.name };
    if (it.type === "file_change" || it.type === "patch") return { kind: "command", text: "edited files" };
  }
  return null;
}

export function AgentTranscript({ lines, running }: { lines: AgentLine[]; running: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.scrollTo({ top: ref.current.scrollHeight });
  }, [lines, running]);
  return (
    <div className="transcript" ref={ref}>
      <div className="t-head">
        codex · gpt-5.5 <span className="t-eff">high</span>
        {running && <span className="dot" />}
      </div>
      {lines.map((l, i) => (
        <div key={i} className={`tline ${l.kind}`}>
          {l.kind === "command" ? "$ " : ""}
          {l.text}
        </div>
      ))}
      {!lines.length && running && <div className="tline meta">starting agent…</div>}
    </div>
  );
}
