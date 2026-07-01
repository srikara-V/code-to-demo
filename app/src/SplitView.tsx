import { useRef, useState, type ReactNode } from "react";

// Two panes with a draggable vertical divider. leftPct is the left pane's width
// as a percentage of the container; dragging the divider adjusts it (clamped).
// When rightOpen is false the right pane collapses (left fills) and a reopen
// button appears — the left pane stays mounted so its state is preserved.
export function SplitView({
  left,
  right,
  rightOpen = true,
  onReopen,
}: {
  left: ReactNode;
  right: ReactNode;
  rightOpen?: boolean;
  onReopen?: () => void;
}) {
  const [leftPct, setLeftPct] = useState(45);
  const ref = useRef<HTMLDivElement>(null);

  const onDown = (e: React.MouseEvent) => {
    e.preventDefault();
    const onMove = (ev: MouseEvent) => {
      const r = ref.current?.getBoundingClientRect();
      if (!r) return;
      const pct = ((ev.clientX - r.left) / r.width) * 100;
      setLeftPct(Math.min(80, Math.max(20, pct)));
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  if (!rightOpen) {
    return (
      <div className="split" ref={ref}>
        <div className="pane" style={{ width: "100%" }}>
          {left}
        </div>
        {onReopen && (
          <button className="panel-reopen" onClick={onReopen} title="Show video panel" aria-label="Show video panel">
            <PanelIcon /> Video
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="split" ref={ref}>
      <div className="pane" style={{ width: `${leftPct}%` }}>
        {left}
      </div>
      <div className="divider" onMouseDown={onDown} title="Drag to resize" />
      <div className="pane right">{right}</div>
    </div>
  );
}

function PanelIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <line x1="14" y1="4" x2="14" y2="20" />
    </svg>
  );
}
