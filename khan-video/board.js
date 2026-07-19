// Deterministic Khan-style whiteboard renderer.
// loadScene(i, timing) compiles a scene's draw-ops into timed strokes/glyphs;
// seekTime(t) then sets the exact visual state for time t (no rAF, no CSS
// animation) so a headless browser can capture arbitrary frames in any order.
import { SCENES } from "./script.mjs";

const SVGNS = "http://www.w3.org/2000/svg";
const stage = document.getElementById("els");
const fader = document.getElementById("fader");

const COLORS = {
  chalk: "#f2f5f7",
  yellow: "#ffd75e",
  teal: "#4fd8cf",
  blue: "#7cb7ff",
  green: "#8fe388",
  pink: "#ff7ea8",
  orange: "#ffa85c",
  purple: "#c39bff",
  muted: "#9aa6b2",
  red: "#ff6b6b",
};
const FONTS = { hand: '"Patrick Hand"', head: '"Caveat"' };
const WEIGHT = { hand: "400", head: "700" };

// ── seeded randomness ───────────────────────────────────────────────────────
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const mkRng = (seed) => {
  const r = mulberry32(seed * 2654435761 + 1013904223);
  return () => r() * 2 - 1; // [-1, 1)
};

// ── wobble path helpers ─────────────────────────────────────────────────────
// Subdivide a polyline and jitter interior points perpendicular to the local
// direction; render as a smooth quadratic path. This is the whole "hand-drawn"
// trick.
function wobble(pts, rng, amp = 2.4) {
  const out = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const [x1, y1] = pts[i], [x2, y2] = pts[i + 1];
    const dx = x2 - x1, dy = y2 - y1;
    const len = Math.hypot(dx, dy) || 1;
    const n = Math.max(2, Math.round(len / 26));
    const px = -dy / len, py = dx / len;
    for (let k = 0; k < n; k++) {
      const f = k / n;
      const endF = Math.min(f, 1 - f); // pin endpoints harder
      const a = amp * Math.min(1, endF * 6 + 0.25);
      out.push([x1 + dx * f + px * rng() * a, y1 + dy * f + py * rng() * a]);
    }
  }
  out.push(pts[pts.length - 1].slice());
  return out;
}
function smoothPath(pts) {
  if (pts.length < 3) return `M${pts[0][0]},${pts[0][1]} L${pts[pts.length - 1][0]},${pts[pts.length - 1][1]}`;
  let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const mx = (pts[i][0] + pts[i + 1][0]) / 2, my = (pts[i][1] + pts[i + 1][1]) / 2;
    d += ` Q${pts[i][0].toFixed(1)},${pts[i][1].toFixed(1)} ${mx.toFixed(1)},${my.toFixed(1)}`;
  }
  const last = pts[pts.length - 1];
  d += ` L${last[0].toFixed(1)},${last[1].toFixed(1)}`;
  return d;
}
const wLine = (pts, rng, amp) => smoothPath(wobble(pts, rng, amp));

// Points along a quadratic bezier (for curved arrows).
function bezPts(x1, y1, x2, y2, bend) {
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const cx = mx + (-dy / len) * bend, cy = my + (dx / len) * bend;
  const pts = [];
  const n = Math.max(8, Math.round(len / 30));
  for (let i = 0; i <= n; i++) {
    const t = i / n, u = 1 - t;
    pts.push([u * u * x1 + 2 * u * t * cx + t * t * x2, u * u * y1 + 2 * u * t * cy + t * t * y2]);
  }
  return pts;
}
function ellipsePts(cx, cy, rx, ry, rng) {
  const pts = [];
  const start = rng() * Math.PI;
  for (let a = 0; a <= 372; a += 12) {
    const th = start + (a * Math.PI) / 180;
    const j = 1 + rng() * 0.025;
    pts.push([cx + Math.cos(th) * rx * j, cy + Math.sin(th) * ry * j]);
  }
  return pts;
}

// ── text measurement ────────────────────────────────────────────────────────
const mctx = document.createElement("canvas").getContext("2d");
function measure(ch, font, size) {
  mctx.font = `${WEIGHT[font]} ${size}px ${FONTS[font]}`;
  return mctx.measureText(ch).width;
}
// Wrap text into lines within width w (if given). "\n" forces a break.
function layoutText(text, font, size, w) {
  const lines = [];
  for (const para of text.split("\n")) {
    if (!w) { lines.push(para); continue; }
    let cur = "";
    for (const word of para.split(" ")) {
      const cand = cur ? cur + " " + word : word;
      if (cur && measure(cand, font, size) > w) { lines.push(cur); cur = word; }
      else cur = cand;
    }
    lines.push(cur);
  }
  return lines;
}

// ── element factory: each op → {strokes:[], glyphs:[]} in local time [0,1] ──
// stroke: {pts|d, color, sw, t0, t1}  (t normalized within the element)
// glyph:  {ch, x, y, rot, size, font, color, t}  (t normalized)
function compileOp(op, seed) {
  const rng = mkRng(seed);
  const color = COLORS[op.color || "chalk"];
  const sw = op.sw || 5;
  const strokes = [], glyphs = [];
  const add = (pts, t0, t1, o = {}) =>
    strokes.push({ d: wLine(pts, rng, o.amp), color: o.color || color, sw: o.sw || sw, t0, t1, dashed: o.dashed });

  // Sequenced hand-dashes: many short strokes drawn one after another.
  const addDashed = (pts, t0, t1) => {
    const wob = wobble(pts, rng, 2);
    // walk the polyline, emitting 16px dashes with 11px gaps
    let segs = [], acc = [], dist = 0, drawing = true, target = 16;
    for (let i = 0; i < wob.length - 1; i++) {
      let [x1, y1] = wob[i]; const [x2, y2] = wob[i + 1];
      let rem = Math.hypot(x2 - x1, y2 - y1);
      let dirx = (x2 - x1) / (rem || 1), diry = (y2 - y1) / (rem || 1);
      while (rem > 0) {
        const step = Math.min(rem, target - dist);
        const nx = x1 + dirx * step, ny = y1 + diry * step;
        if (drawing) acc.push([x1, y1]);
        x1 = nx; y1 = ny; dist += step; rem -= step;
        if (dist >= target - 1e-6) {
          if (drawing) { acc.push([x1, y1]); if (acc.length > 1) segs.push(acc); }
          acc = []; drawing = !drawing; dist = 0; target = drawing ? 16 : 11;
        }
      }
    }
    if (drawing && acc.length) { acc.push(wob[wob.length - 1]); segs.push(acc); }
    segs.forEach((s, i) => {
      const a = t0 + ((t1 - t0) * i) / segs.length;
      const b = t0 + ((t1 - t0) * (i + 1)) / segs.length;
      strokes.push({ d: smoothPath(s), color, sw, t0: a, t1: b });
    });
  };

  const arrowHead = (x1, y1, x2, y2, t0, t1) => {
    const ang = Math.atan2(y2 - y1, x2 - x1);
    const L = 16;
    for (const off of [Math.PI * 0.82, -Math.PI * 0.82]) {
      add([[x2, y2], [x2 + Math.cos(ang + off) * L, y2 + Math.sin(ang + off) * L]], t0, t1, { amp: 1 });
    }
  };

  const text = (tx, x, y, size, font, align, wrapW, t0 = 0, t1 = 1, tcolor = color) => {
    const lines = layoutText(tx, font, size, wrapW);
    const lh = size * 1.22;
    // total char count for time slicing
    const total = lines.reduce((n, l) => n + l.length, 0) || 1;
    let done = 0;
    lines.forEach((line, li) => {
      const wsum = measure(line, font, size);
      let cx = align === "center" ? x - wsum / 2 : x;
      const cy = y + li * lh;
      for (const ch of line) {
        const cw = measure(ch, font, size);
        if (ch !== " ") {
          glyphs.push({
            ch, x: cx + rng() * 0.8, y: cy + rng() * 1.6, rot: rng() * 2.2,
            size, font, color: tcolor, t: t0 + ((t1 - t0) * done) / total,
          });
        }
        cx += cw;
        done++;
      }
    });
  };

  switch (op.op) {
    case "text":
      text(op.text, op.x, op.y, op.size || 34, op.font || "hand", op.align || "left", op.w);
      break;

    case "underline": {
      const y = op.y + rng() * 2;
      add([[op.x1, y], [op.x2, y + rng() * 3]], 0, 1, { sw: op.sw || 5 });
      break;
    }
    case "line": {
      const pts = op.bend ? bezPts(op.x1, op.y1, op.x2, op.y2, op.bend) : [[op.x1, op.y1], [op.x2, op.y2]];
      op.dashed ? addDashed(pts, 0, 1) : add(pts, 0, 1);
      break;
    }
    case "arrow": {
      const pts = op.bend ? bezPts(op.x1, op.y1, op.x2, op.y2, op.bend) : [[op.x1, op.y1], [op.x2, op.y2]];
      op.dashed ? addDashed(pts, 0, 0.8) : add(pts, 0, 0.8);
      const [px, py] = pts[pts.length - 2];
      arrowHead(px, py, op.x2, op.y2, 0.8, 1);
      break;
    }
    case "box": {
      const { x, y, w, h } = op;
      const o = 4; // corner overshoot
      // draw as two half-strokes (top+right, then left+bottom) like a real hand
      add([[x - o, y], [x + w, y], [x + w, y + h]], 0, op.double ? 0.4 : 0.55);
      add([[x, y - o + 2], [x, y + h], [x + w + o, y + h]], op.double ? 0.4 : 0.55, op.double ? 0.7 : 1);
      if (op.double) {
        const i = 9;
        add([[x + i, y + i], [x + w - i, y + i], [x + w - i, y + h - i]], 0.7, 0.85);
        add([[x + i, y + i], [x + i, y + h - i], [x + w - i, y + h - i]], 0.85, 1);
      }
      if (op.label) {
        const ly = op.labelPos === "top" ? y + (op.labelSize || 28) * 0.9 + 8 : y + h / 2 + (op.labelSize || 28) * 0.35;
        text(op.label, x + w / 2, ly, op.labelSize || 28, op.labelFont || "hand", "center", null, 0.3, 1, COLORS[op.labelColor || op.color || "chalk"]);
      }
      break;
    }
    case "ellipse":
      add(ellipsePts(op.cx, op.cy, op.rx, op.ry, rng), 0, 1, { amp: 1.4 });
      break;
    case "cross": {
      const s = op.s / 2;
      add([[op.cx - s, op.cy - s], [op.cx + s, op.cy + s]], 0, 0.5, { sw: op.sw || 6 });
      add([[op.cx + s, op.cy - s], [op.cx - s, op.cy + s]], 0.5, 1, { sw: op.sw || 6 });
      break;
    }
    case "check": {
      const s = op.s;
      add([[op.x, op.y], [op.x + s * 0.35, op.y + s * 0.32], [op.x + s, op.y - s * 0.45]], 0, 1, { sw: op.sw || 7 });
      break;
    }
    case "icon":
      compileIcon(op, rng, add, addDashed, text, color);
      break;
  }
  return { strokes, glyphs };
}

function compileIcon(op, rng, add, addDashed, text, color) {
  const k = op.kind, s = op.s || 1;
  if (k === "browser") {
    const { x, y, w, h } = op;
    add([[x, y], [x + w, y], [x + w, y + h]], 0, 0.35);
    add([[x, y], [x, y + h], [x + w, y + h]], 0.35, 0.6);
    add([[x, y + 34], [x + w, y + 34]], 0.6, 0.75);
    add(ellipsePts(x + 20, y + 17, 5, 5, rng), 0.78, 0.88, { amp: 0.6 });
    add(ellipsePts(x + 40, y + 17, 5, 5, rng), 0.9, 1, { amp: 0.6 });
  } else if (k === "play") {
    const { x, y } = op, r = 58 * s;
    add(ellipsePts(x, y, r, r, rng), 0, 0.65, { amp: 1.6 });
    add([[x - r * 0.32, y - r * 0.42], [x + r * 0.5, y], [x - r * 0.32, y + r * 0.42], [x - r * 0.32, y - r * 0.42]], 0.65, 1);
  } else if (k === "doc") {
    const { x, y } = op, w = 110 * s, h = 138 * s, f = 30 * s;
    add([[x, y], [x + w - f, y], [x + w, y + f], [x + w, y + h], [x, y + h], [x, y]], 0, 0.7);
    add([[x + w - f, y], [x + w - f, y + f], [x + w, y + f]], 0.7, 0.82);
    add([[x + 18, y + h * 0.4], [x + w - 18, y + h * 0.4]], 0.84, 0.9);
    add([[x + 18, y + h * 0.58], [x + w - 18, y + h * 0.58]], 0.9, 0.95);
    add([[x + 18, y + h * 0.76], [x + w - 30, y + h * 0.76]], 0.95, 1);
  } else if (k === "key") {
    const { x, y } = op, r = 20 * s, L = 92 * s;
    add(ellipsePts(x, y, r, r, rng), 0, 0.5, { amp: 1 });
    add([[x + r, y], [x + r + L, y]], 0.5, 0.8);
    add([[x + r + L - 8, y], [x + r + L - 8, y + 15 * s]], 0.8, 0.9);
    add([[x + r + L - 26, y], [x + r + L - 26, y + 12 * s]], 0.9, 1);
  } else if (k === "person") {
    const { x, y } = op, r = 20 * s;
    add(ellipsePts(x, y, r, r, rng), 0, 0.55, { amp: 1 });
    add(bezPts(x - 34 * s, y + 62 * s, x + 34 * s, y + 62 * s, -34 * s), 0.55, 1);
  } else if (k === "wave") {
    const { x, y } = op;
    const hs = [16, 32, 50, 38, 62, 40, 52, 30, 18];
    hs.forEach((h, i) => {
      const bx = x + i * 16 * s;
      add([[bx, y - (h / 2) * s], [bx, y + (h / 2) * s]], i / hs.length, (i + 1) / hs.length, { sw: 6 });
    });
  } else if (k === "film") {
    const { x, y, w, h } = op;
    add([[x, y], [x + w, y], [x + w, y + h], [x, y + h], [x, y]], 0, 0.55);
    add([[x + w / 3, y], [x + w / 3, y + h]], 0.55, 0.68);
    add([[x + (2 * w) / 3, y], [x + (2 * w) / 3, y + h]], 0.68, 0.8);
    for (let i = 0; i < 6; i++) {
      const tx = x + 10 + (i * (w - 20)) / 5;
      add([[tx, y - 8], [tx, y - 16]], 0.8 + i * 0.03, 0.83 + i * 0.03, { sw: 4 });
      add([[tx, y + h + 8], [tx, y + h + 16]], 0.86 + i * 0.02, 0.89 + i * 0.02, { sw: 4 });
    }
  } else if (k === "clock") {
    const { x, y } = op, r = 40 * s;
    add(ellipsePts(x, y, r, r, rng), 0, 0.7, { amp: 1.2 });
    add([[x, y], [x, y - r * 0.62]], 0.7, 0.85);
    add([[x, y], [x + r * 0.45, y + r * 0.18]], 0.85, 1);
  } else if (k === "bucket") {
    const { x, y } = op, w = 96 * s, h = 84 * s;
    add(ellipsePts(x + w / 2, y, w / 2, 14 * s, rng), 0, 0.45, { amp: 1 });
    add([[x, y], [x + w * 0.14, y + h]], 0.45, 0.65);
    add([[x + w, y], [x + w * 0.86, y + h]], 0.65, 0.85);
    add(bezPts(x + w * 0.14, y + h, x + w * 0.86, y + h, 10 * s), 0.85, 1);
  } else if (k === "laptop") {
    const { x, y } = op, w = 120 * s, h = 78 * s;
    add([[x, y], [x + w, y], [x + w, y + h], [x, y + h], [x, y]], 0, 0.7);
    add([[x - 16, y + h + 16], [x + w + 16, y + h + 16]], 0.7, 0.85);
    add([[x, y + h], [x - 16, y + h + 16]], 0.85, 0.92);
    add([[x + w, y + h], [x + w + 16, y + h + 16]], 0.92, 1);
  } else if (k === "cursor") {
    const { x, y } = op;
    const p = [[x, y], [x, y + 30 * s], [x + 8 * s, y + 23 * s], [x + 14 * s, y + 34 * s], [x + 19 * s, y + 31 * s], [x + 13 * s, y + 21 * s], [x + 22 * s, y + 20 * s], [x, y]];
    add(p, 0, 1, { amp: 0.8 });
  } else if (k === "spark") {
    const { x, y } = op;
    const R = 26 * s, r0 = 10 * s;
    [0.9, 2.2, 3.7, 5.1].forEach((a, i) => {
      add([[x + Math.cos(a) * r0, y + Math.sin(a) * r0], [x + Math.cos(a) * R, y + Math.sin(a) * R]], i * 0.25, i * 0.25 + 0.25, { sw: 5 });
    });
  } else if (k === "trash") {
    const { x, y } = op, w = 66 * s, h = 84 * s;
    add([[x - 8, y], [x + w + 8, y]], 0, 0.2);
    add(bezPts(x + w * 0.32, y - 10 * s, x + w * 0.68, y - 10 * s, -6), 0.2, 0.32);
    add([[x + 2, y], [x + 8, y + h], [x + w - 8, y + h], [x + w - 2, y]], 0.32, 0.75);
    add([[x + w * 0.35, y + 16], [x + w * 0.38, y + h - 14]], 0.75, 0.86);
    add([[x + w * 0.65, y + 16], [x + w * 0.62, y + h - 14]], 0.86, 1);
  } else if (k === "flame") {
    const { x, y } = op;
    add(bezPts(x, y + 40 * s, x, y - 40 * s, 34 * s), 0, 0.5, { amp: 3 });
    add(bezPts(x, y - 40 * s, x, y + 40 * s, 26 * s), 0.5, 1, { amp: 3 });
  } else if (k === "db") {
    const { x, y } = op, w = 140 * s, h = 104 * s, ry = 20 * s;
    add(ellipsePts(x + w / 2, y + ry, w / 2, ry, rng), 0, 0.45, { amp: 1.2 });
    add([[x, y + ry], [x, y + h - ry * 0.4]], 0.45, 0.62);
    add([[x + w, y + ry], [x + w, y + h - ry * 0.4]], 0.62, 0.8);
    add(bezPts(x, y + h - ry * 0.4, x + w, y + h - ry * 0.4, -ry * 1.1), 0.8, 1);
  } else if (k === "cloud") {
    const { x, y } = op, w = 200 * s;
    // normalized cloud outline (bumpy top, flat-ish bottom)
    const N = [[0.1, 0.75], [0.03, 0.55], [0.12, 0.32], [0.3, 0.28], [0.4, 0.1], [0.62, 0.08], [0.74, 0.24], [0.9, 0.3], [0.98, 0.52], [0.9, 0.74], [0.7, 0.82], [0.4, 0.84], [0.1, 0.78]];
    add(N.map(([nx, ny]) => [x + nx * w, y + ny * w * 0.45]), 0, 1, { amp: 1.6 });
  }
}

// ── scene compilation + seeking ─────────────────────────────────────────────
let compiled = null; // {duration, els:[{at,dur,strokes,glyphs,nodes}]}

const DUR_BY_OP = (op) => {
  switch (op.op) {
    case "text": {
      const n = (op.text || "").length;
      return Math.min(1.9, Math.max(0.5, n * 0.042));
    }
    case "box": return op.double ? 1.15 : 0.85;
    case "arrow": return 0.55;
    case "line": return 0.4;
    case "ellipse": return 0.7;
    case "underline": return 0.45;
    case "cross": return 0.45;
    case "check": return 0.35;
    case "icon": return op.kind === "browser" || op.kind === "film" ? 1.0 : 0.8;
    default: return 0.6;
  }
};

export function loadScene(index, timing) {
  const scene = SCENES[index];
  const segs = scene.segs;
  // timing: {audioDur, segStarts[], lead, tail, fadeIn, fadeOut}
  const lead = timing.lead ?? 0.35;
  const duration = lead + timing.audioDur + (timing.tail ?? 1.15);
  stage.innerHTML = "";
  const els = [];

  segs.forEach((seg, si) => {
    const segStart = lead + (timing.segStarts[si] ?? si * 4.5);
    const segEnd = lead + (si + 1 < segs.length ? timing.segStarts[si + 1] ?? (si + 1) * 4.5 : timing.audioDur);
    const ops = seg.draw || [];
    const span = Math.max(1.2, segEnd - segStart);
    const stagger = Math.min(0.6, Math.max(0.3, (span * 0.8) / Math.max(1, ops.length)));
    ops.forEach((op, oi) => {
      const at = op.dt != null ? segStart + op.dt : segStart + 0.12 + oi * stagger;
      const dur = op.dur || DUR_BY_OP(op);
      const { strokes, glyphs } = compileOp(op, index * 1000 + si * 64 + oi);
      els.push({ at: Math.min(at, duration - 0.4), dur, strokes, glyphs });
    });
  });

  // Build DOM nodes.
  for (const el of els) {
    el.nodes = [];
    for (const st of el.strokes) {
      const p = document.createElementNS(SVGNS, "path");
      p.setAttribute("d", st.d);
      p.setAttribute("fill", "none");
      p.setAttribute("stroke", st.color);
      p.setAttribute("stroke-width", st.sw);
      p.setAttribute("stroke-linecap", "round");
      p.setAttribute("stroke-linejoin", "round");
      p.setAttribute("visibility", "hidden");
      stage.appendChild(p);
      st.node = p;
    }
    for (const g of el.glyphs) {
      const t = document.createElementNS(SVGNS, "text");
      t.setAttribute("x", g.x.toFixed(1));
      t.setAttribute("y", g.y.toFixed(1));
      t.setAttribute("fill", g.color);
      t.setAttribute("font-family", FONTS[g.font]);
      t.setAttribute("font-weight", WEIGHT[g.font]);
      t.setAttribute("font-size", g.size);
      t.setAttribute("transform", `rotate(${g.rot.toFixed(2)} ${g.x.toFixed(1)} ${g.y.toFixed(1)})`);
      t.setAttribute("opacity", "0");
      t.textContent = g.ch;
      stage.appendChild(t);
      g.node = t;
    }
  }
  // Cache path lengths (must be in DOM).
  for (const el of els) for (const st of el.strokes) {
    st.len = st.node.getTotalLength();
    st.node.setAttribute("stroke-dasharray", st.len);
    st.node.setAttribute("stroke-dashoffset", st.len);
  }
  compiled = { duration, els, fadeIn: timing.fadeIn || 0, fadeOut: timing.fadeOut || 0 };
  return { duration };
}

export function seekTime(t) {
  if (!compiled) return;
  for (const el of compiled.els) {
    const p = Math.max(0, Math.min(1, (t - el.at) / el.dur));
    for (const st of el.strokes) {
      const q = Math.max(0, Math.min(1, (p - st.t0) / (st.t1 - st.t0 || 1e-6)));
      if (q <= 0.001) st.node.setAttribute("visibility", "hidden");
      else {
        st.node.setAttribute("visibility", "visible");
        st.node.setAttribute("stroke-dashoffset", (st.len * (1 - q)).toFixed(1));
      }
    }
    for (const g of el.glyphs) {
      const gt = el.at + g.t * el.dur;
      const o = Math.max(0, Math.min(1, (t - gt) / 0.09));
      g.node.setAttribute("opacity", o.toFixed(2));
    }
  }
  // scene-level fades (first/last scene of the film)
  let fade = 0;
  if (compiled.fadeIn > 0 && t < compiled.fadeIn) fade = 1 - t / compiled.fadeIn;
  if (compiled.fadeOut > 0 && t > compiled.duration - compiled.fadeOut)
    fade = Math.max(fade, (t - (compiled.duration - compiled.fadeOut)) / compiled.fadeOut);
  fader.setAttribute("opacity", fade.toFixed(2));
}

// ── boot ────────────────────────────────────────────────────────────────────
const ready = (async () => {
  await document.fonts.load('700 60px "Caveat"');
  await document.fonts.load('400 34px "Patrick Hand"');
  await document.fonts.ready;
})();

window.boardReady = ready;
window.loadScene = loadScene;
window.seekTime = seekTime;
window.sceneCount = SCENES.length;
window.sceneSegs = SCENES.map((s) => s.segs.map((g) => g.say));

// Debug mode: board.html?scene=2&t=999 renders that scene's state directly
// (uniform fake timing) so layouts can be eyeballed without audio.
const q = new URLSearchParams(location.search);
if (q.has("scene")) {
  ready.then(() => {
    const i = Number(q.get("scene"));
    const segs = SCENES[i].segs.length;
    const fake = { audioDur: segs * 4.5, segStarts: SCENES[i].segs.map((_, k) => k * 4.5), lead: 0.3, tail: 1 };
    loadScene(i, fake);
    seekTime(Number(q.get("t") ?? 9999));
  });
}
