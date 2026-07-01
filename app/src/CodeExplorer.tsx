import { useEffect, useState } from "react";
import hljs from "highlight.js/lib/core";
import python from "highlight.js/lib/languages/python";
import markdown from "highlight.js/lib/languages/markdown";
import json from "highlight.js/lib/languages/json";
import javascript from "highlight.js/lib/languages/javascript";
import bash from "highlight.js/lib/languages/bash";
import "highlight.js/styles/github-dark.css";

hljs.registerLanguage("python", python);
hljs.registerLanguage("markdown", markdown);
hljs.registerLanguage("json", json);
hljs.registerLanguage("javascript", javascript);
hljs.registerLanguage("bash", bash);

type FileNode = { path: string; type: "file" | "dir"; size?: number };

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// Mini VS Code-like editor: file tree on the left, syntax-highlighted code on
// the right. With no `repo` it reads the bundled demo repo (/api/demo/*); with a
// `repo` ("owner/name") it reads that GitHub repo (/api/repo/*) using the token.
export function CodeExplorer({ repo }: { repo?: string } = {}) {
  const [files, setFiles] = useState<FileNode[]>([]);
  const [root, setRoot] = useState("");
  const [sel, setSel] = useState("");
  const [content, setContent] = useState("");
  const [lang, setLang] = useState("text");

  const filesUrl = repo ? `/api/repo/files?repo=${encodeURIComponent(repo)}` : "/api/demo/files";
  const fileUrl = (p: string) =>
    repo
      ? `/api/repo/file?repo=${encodeURIComponent(repo)}&path=${encodeURIComponent(p)}`
      : `/api/demo/file?path=${encodeURIComponent(p)}`;

  useEffect(() => {
    let cancelled = false;
    // Reset when switching repos so stale files/content never flash.
    setFiles([]);
    setRoot("");
    setSel("");
    setContent("");
    setLang("text");
    (async () => {
      const r = await fetch(filesUrl);
      if (!r.ok || cancelled) return;
      const d = await r.json();
      if (cancelled) return;
      setFiles(d.files);
      setRoot(d.root);
      const pick =
        d.files.find((f: FileNode) => f.type === "file" && /(^|\/)readme/i.test(f.path)) ||
        d.files.find((f: FileNode) => f.type === "file" && f.path.endsWith(".py")) ||
        d.files.find((f: FileNode) => f.type === "file");
      if (pick) open(pick.path);
    })();
    return () => {
      cancelled = true;
    };
  }, [filesUrl]);

  const open = async (p: string) => {
    setSel(p);
    const r = await fetch(fileUrl(p));
    if (!r.ok) {
      setContent("// could not load file");
      setLang("text");
      return;
    }
    const d = await r.json();
    setContent(d.content);
    setLang(d.language);
  };

  const html =
    content && lang !== "text" && hljs.getLanguage(lang)
      ? hljs.highlight(content, { language: lang }).value
      : escapeHtml(content);
  const lineCount = content ? content.split("\n").length : 0;

  return (
    <div className="editor">
      <div className="filetree">
        <div className="ft-root">{root || "files"}</div>
        {files.map((f) => (
          <div
            key={f.path}
            className={`ft-item ${f.type} ${sel === f.path ? "active" : ""}`}
            style={{ paddingLeft: 12 + (f.path.split("/").length - 1) * 12 }}
            onClick={() => f.type === "file" && open(f.path)}
          >
            {f.type === "dir" ? "▸ " : ""}
            {f.path.split("/").pop()}
          </div>
        ))}
      </div>
      <div className="codeview">
        <div className="tabbar">{sel || "—"}</div>
        <div className="code-scroll">
          <pre className="code">
            <span className="gutter">
              {Array.from({ length: lineCount }, (_, i) => (
                <span key={i}>{i + 1}</span>
              ))}
            </span>
            <code className="hljs" dangerouslySetInnerHTML={{ __html: html }} />
          </pre>
        </div>
      </div>
    </div>
  );
}
