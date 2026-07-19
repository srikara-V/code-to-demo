// Khan-Academy-style walkthrough of THIS repository (code-to-demo).
// Single source of truth: 10 scenes. Each scene = narration segments; each
// segment carries the draw-ops that appear while that sentence is spoken.
// The narration string is what ElevenLabs reads; board text is separate, so
// audio can spell things phonetically ("Veet") while the board shows "Vite".
//
// Draw-op coordinate space: 1920 x 1080.
// Colors: chalk yellow teal blue green pink orange purple muted red

export const VOICE = {
  id: "iP95p4xoKVk53GoZ742B", // "Chris" - charming, down-to-earth, conversational
  model: "eleven_multilingual_v2",
  settings: { stability: 0.5, similarity_boost: 0.8, style: 0.2, use_speaker_boost: true },
};

export const SCENES = [
  // ───────────────────────────── Scene 1: What is this? ─────────────────────
  {
    id: "intro",
    segs: [
      {
        say:
          "Let's look at a small but genuinely clever codebase. It's called code to demo, " +
          "and its job is to take any GitHub repository and turn it into a narrated demo video, automatically.",
        draw: [
          { op: "text", x: 960, y: 250, text: "code-to-demo", size: 118, font: "head", color: "yellow", align: "center" },
          { op: "text", x: 960, y: 352, text: "a repo that turns repos into demo videos", size: 42, color: "muted", align: "center" },
          { op: "icon", kind: "doc", x: 240, y: 480, s: 1.25, color: "blue" },
          { op: "text", x: 300, y: 700, text: "any GitHub repo", size: 34, color: "blue", align: "center" },
        ],
      },
      {
        say:
          "You connect GitHub, you pick a repo, and a few minutes later you get an M P 4. " +
          "A voice walks a first time user through the running app while a cursor clicks around. " +
          "Nobody records a screen, nobody writes a script. An A I agent does all of it.",
        draw: [
          { op: "box", x: 795, y: 460, w: 330, h: 170, color: "teal", label: "AI agent", labelSize: 48 },
          { op: "icon", kind: "spark", x: 1140, y: 460, s: 0.8, color: "teal" },
          { op: "icon", kind: "spark", x: 780, y: 640, s: 0.6, color: "teal" },
          { op: "arrow", x1: 400, y1: 545, x2: 770, y2: 545, color: "chalk" },
          { op: "icon", kind: "play", x: 1620, y: 530, s: 1.3, color: "green" },
          { op: "arrow", x1: 1150, y1: 545, x2: 1520, y2: 545, color: "chalk" },
          { op: "text", x: 1620, y: 700, text: "walkthrough.mp4", size: 34, color: "green", align: "center" },
        ],
      },
      {
        say:
          "And yes, this very video was made with the same core ingredients this repo uses. " +
          "A headless browser, a text to speech A P I, and F F em peg. " +
          "So this is a video about a repo whose whole point is making videos about repos.",
        draw: [
          { op: "arrow", x1: 1620, y1: 620, x2: 1105, y2: 782, color: "pink", bend: -90, dashed: true },
          { op: "text", x: 800, y: 815, text: "this video: same ingredients (meta!)", size: 32, color: "pink", align: "center" },
        ],
      },
      {
        say:
          "In this walkthrough we'll map the entire stack. But more importantly, we'll keep asking why. " +
          "Why this framework, why no database, why the risky looking parts are actually the safe ones, " +
          "and what the authors chose to prioritize.",
        draw: [
          { op: "text", x: 560, y: 950, text: "the stack", size: 46, font: "head", color: "blue", align: "center" },
          { op: "underline", x1: 452, x2: 668, y: 972, color: "blue" },
          { op: "text", x: 960, y: 950, text: "the tradeoffs", size: 46, font: "head", color: "orange", align: "center" },
          { op: "underline", x1: 822, x2: 1098, y: 972, color: "orange" },
          { op: "text", x: 1370, y: 950, text: "the priorities", size: 46, font: "head", color: "green", align: "center" },
          { op: "underline", x1: 1232, x2: 1508, y: 972, color: "green" },
        ],
      },
    ],
  },

  // ──────────────────────── Scene 2: The user's journey ─────────────────────
  {
    id: "journey",
    segs: [
      {
        say:
          "Before the architecture, the experience. Every piece of the stack exists to serve one of these four moments.",
        draw: [{ op: "text", x: 90, y: 130, text: "The user's journey", size: 66, font: "head", color: "yellow" }],
      },
      {
        say:
          "Moment one. A nearly blank page with a single button, connect to GitHub. " +
          "Click it, approve on GitHub's own screen, and you're back.",
        draw: [
          { op: "icon", kind: "browser", x: 140, y: 300, w: 380, h: 300, color: "chalk" },
          { op: "box", x: 220, y: 420, w: 220, h: 62, color: "blue", label: "Connect to GitHub", labelSize: 22 },
          { op: "text", x: 330, y: 700, text: "1 - connect", size: 34, color: "blue", align: "center" },
        ],
      },
      {
        say: "Moment two. A dropdown of your repositories. Pick one, press the up arrow, and generation starts.",
        draw: [
          { op: "arrow", x1: 528, y1: 450, x2: 566, y2: 450, color: "muted" },
          { op: "icon", kind: "browser", x: 570, y: 300, w: 380, h: 300, color: "chalk" },
          { op: "box", x: 630, y: 400, w: 230, h: 54, color: "teal", label: "owner / repo", labelSize: 22 },
          { op: "line", x1: 630, y1: 492, x2: 860, y2: 492, color: "muted" },
          { op: "line", x1: 630, y1: 526, x2: 860, y2: 526, color: "muted" },
          { op: "ellipse", cx: 900, cy: 428, rx: 26, ry: 26, color: "teal" },
          { op: "text", x: 760, y: 700, text: "2 - pick a repo", size: 34, color: "teal", align: "center" },
        ],
      },
      {
        say:
          "Moment three. The screen splits. On the left, a mini code editor showing the repo's files. " +
          "On the right, and this is the fun part, a live transcript of an A I agent thinking out loud. " +
          "Reading your read me, installing dependencies, starting your app.",
        draw: [
          { op: "arrow", x1: 958, y1: 450, x2: 996, y2: 450, color: "muted" },
          { op: "icon", kind: "browser", x: 1000, y: 300, w: 380, h: 300, color: "chalk" },
          { op: "line", x1: 1140, y1: 345, x2: 1140, y2: 595, color: "muted" },
          { op: "line", x1: 1030, y1: 390, x2: 1110, y2: 390, color: "blue" },
          { op: "line", x1: 1045, y1: 425, x2: 1110, y2: 425, color: "blue" },
          { op: "line", x1: 1045, y1: 460, x2: 1100, y2: 460, color: "blue" },
          { op: "line", x1: 1170, y1: 390, x2: 1340, y2: 390, color: "green" },
          { op: "line", x1: 1170, y1: 430, x2: 1310, y2: 430, color: "green" },
          { op: "line", x1: 1170, y1: 470, x2: 1345, y2: 470, color: "green" },
          { op: "line", x1: 1170, y1: 510, x2: 1290, y2: 510, color: "green" },
          { op: "text", x: 1190, y: 700, text: "3 - watch the agent, live", size: 34, color: "green", align: "center" },
        ],
      },
      {
        say:
          "Moment four. The transcript is replaced by a video player with the finished walkthrough. " +
          "There's also an instant demo mode with a pre cached video, so first time visitors see the payoff " +
          "in seconds, not minutes.",
        draw: [
          { op: "arrow", x1: 1388, y1: 450, x2: 1426, y2: 450, color: "muted" },
          { op: "icon", kind: "browser", x: 1430, y: 300, w: 380, h: 300, color: "chalk" },
          { op: "icon", kind: "play", x: 1620, y: 460, s: 1.0, color: "green" },
          { op: "text", x: 1620, y: 700, text: "4 - the walkthrough", size: 34, color: "green", align: "center" },
          { op: "icon", kind: "clock", x: 660, y: 850, s: 0.8, color: "yellow" },
          { op: "text", x: 1000, y: 862, text: "demo mode: cached video, instant payoff", size: 36, color: "yellow", align: "center" },
          { op: "underline", x1: 700, x2: 1300, y: 892, color: "yellow" },
        ],
      },
    ],
  },

  // ───────────────────────────── Scene 3: The map ───────────────────────────
  {
    id: "map",
    segs: [
      {
        say: "Here's the whole system on one board. Three zones, and remarkably little in each of them.",
        draw: [{ op: "text", x: 90, y: 130, text: "The map", size: 66, font: "head", color: "yellow" }],
      },
      {
        say:
          "Zone one, the browser. A React eighteen single page app, built with Veet and TypeScript. " +
          "No Next J S, no server side rendering. This is a tool that lives behind a login button, " +
          "nobody needs to search index it. A plain single page app is the simplest thing that works.",
        draw: [
          { op: "box", x: 110, y: 240, w: 440, h: 520, color: "blue", label: "BROWSER", labelSize: 34, labelPos: "top" },
          { op: "text", x: 330, y: 342, text: "React 18 + Vite + TS", size: 30, color: "blue", align: "center" },
          { op: "box", x: 160, y: 400, w: 340, h: 70, color: "muted", label: "code explorer", labelSize: 24 },
          { op: "box", x: 160, y: 495, w: 340, h: 70, color: "muted", label: "live agent log", labelSize: 24 },
          { op: "box", x: 160, y: 590, w: 340, h: 70, color: "muted", label: "video player", labelSize: 24 },
        ],
      },
      {
        say:
          "Zone two, a Node backend using Express. Two files, roughly eight hundred lines total. " +
          "It does O auth, proxies the GitHub A P I, runs a tiny job queue, and streams progress. " +
          "And notice what's missing. There is no database anywhere. We'll come back to that.",
        draw: [
          { op: "box", x: 705, y: 240, w: 440, h: 520, color: "teal", label: "SERVER", labelSize: 34, labelPos: "top" },
          { op: "text", x: 925, y: 342, text: "Node + Express - 2 files", size: 30, color: "teal", align: "center" },
          { op: "box", x: 755, y: 400, w: 340, h: 70, color: "muted", label: "OAuth proxy", labelSize: 24 },
          { op: "box", x: 755, y: 495, w: 340, h: 70, color: "muted", label: "job queue", labelSize: 24 },
          { op: "box", x: 755, y: 590, w: 340, h: 70, color: "muted", label: "event stream", labelSize: 24 },
          { op: "icon", kind: "db", x: 800, y: 810, s: 0.9, color: "muted" },
          { op: "cross", cx: 845, cy: 880, s: 70, color: "red" },
          { op: "text", x: 1010, y: 895, text: "no database!", size: 36, color: "red", align: "center" },
        ],
      },
      {
        say:
          "Zone three, the interesting one. A disposable Docker container, created fresh for each job, " +
          "where an A I coding agent gets a copy of your repo and a full toolchain, and comes back with a video.",
        draw: [
          { op: "box", x: 1300, y: 240, w: 520, h: 520, color: "orange", label: "DISPOSABLE CONTAINER", labelSize: 30, labelPos: "top", double: true },
          { op: "text", x: 1560, y: 342, text: "one per job - deleted after", size: 28, color: "orange", align: "center" },
          { op: "box", x: 1350, y: 400, w: 420, h: 70, color: "muted", label: "Codex agent (gpt-5.5)", labelSize: 24 },
          { op: "box", x: 1350, y: 495, w: 420, h: 70, color: "muted", label: "Chrome - Node - Python - ffmpeg", labelSize: 22 },
          { op: "box", x: 1350, y: 590, w: 420, h: 70, color: "muted", label: "renders walkthrough.mp4", labelSize: 24 },
        ],
      },
      {
        say:
          "Around them, GitHub for identity and source code, Eleven Labs for the voice, and in cloud mode, " +
          "Google Cloud for compute and storage. The arrows between these zones are where all the design " +
          "decisions live, so let's walk them one by one.",
        draw: [
          { op: "icon", kind: "cloud", x: 555, y: 95, s: 1.0, color: "purple" },
          { op: "text", x: 650, y: 155, text: "GitHub", size: 30, color: "purple", align: "center" },
          { op: "arrow", x1: 880, y1: 240, x2: 700, y2: 175, color: "purple" },
          { op: "icon", kind: "wave", x: 1130, y: 135, s: 0.9, color: "pink" },
          { op: "text", x: 1195, y: 62, text: "ElevenLabs", size: 28, color: "pink", align: "center" },
          { op: "arrow", x1: 1490, y1: 240, x2: 1280, y2: 175, color: "pink" },
          { op: "arrow", x1: 552, y1: 430, x2: 703, y2: 430, color: "chalk" },
          { op: "text", x: 628, y: 405, text: "HTTP", size: 24, color: "chalk", align: "center" },
          { op: "arrow", x1: 703, y1: 560, x2: 552, y2: 560, color: "green" },
          { op: "text", x: 628, y: 615, text: "live events", size: 24, color: "green", align: "center" },
          { op: "arrow", x1: 1147, y1: 470, x2: 1298, y2: 470, color: "orange" },
          { op: "text", x: 1222, y: 445, text: "run job", size: 24, color: "orange", align: "center" },
          { op: "icon", kind: "cloud", x: 1560, y: 820, s: 1.0, color: "muted" },
          { op: "text", x: 1660, y: 975, text: "Google Cloud (optional)", size: 26, color: "muted", align: "center" },
          { op: "arrow", x1: 1560, y1: 762, x2: 1620, y2: 820, color: "muted" },
        ],
      },
    ],
  },

  // ──────────────────────── Scene 4: OAuth and the cookie ───────────────────
  {
    id: "oauth",
    segs: [
      {
        say: "First question. This could almost be a static page, so why is there a server at all? The answer is O auth.",
        draw: [{ op: "text", x: 90, y: 130, text: "Why a server at all?  OAuth.", size: 62, font: "head", color: "yellow" }],
      },
      {
        say:
          "To list your repositories, the app needs a GitHub access token, and getting one takes a secret handshake. " +
          "GitHub sends the browser back with a temporary code, and someone must exchange that code, plus a client " +
          "secret, for the real token. That exchange physically cannot happen in the browser. The secret would be " +
          "visible to anyone who opens dev tools, and GitHub's token endpoint doesn't even allow cross origin calls.",
        draw: [
          { op: "icon", kind: "person", x: 150, y: 280, s: 1.0, color: "chalk" },
          { op: "icon", kind: "browser", x: 260, y: 250, w: 300, h: 200, color: "blue" },
          { op: "text", x: 410, y: 500, text: "browser", size: 30, color: "blue", align: "center" },
          { op: "box", x: 1470, y: 250, w: 310, h: 200, color: "purple", label: "GitHub", labelSize: 36 },
          { op: "arrow", x1: 570, y1: 300, x2: 1460, y2: 300, color: "chalk" },
          { op: "text", x: 1010, y: 275, text: "1 - authorize", size: 26, color: "chalk", align: "center" },
          { op: "arrow", x1: 1460, y1: 400, x2: 570, y2: 400, color: "chalk" },
          { op: "text", x: 1010, y: 448, text: "2 - redirect back + code", size: 26, color: "chalk", align: "center" },
          { op: "box", x: 810, y: 620, w: 340, h: 180, color: "teal", label: "server", labelSize: 36 },
          { op: "arrow", x1: 450, y1: 460, x2: 800, y2: 690, color: "chalk", bend: 40 },
          { op: "text", x: 560, y: 640, text: "3 - code", size: 26, color: "chalk", align: "center" },
          { op: "arrow", x1: 1160, y1: 690, x2: 1540, y2: 460, color: "yellow", bend: 40 },
          { op: "text", x: 1430, y: 645, text: "4 - code + client secret", size: 26, color: "yellow", align: "center" },
          { op: "arrow", x1: 1470, y1: 430, x2: 1170, y2: 640, color: "green", bend: -40, dashed: true },
          { op: "text", x: 1265, y: 520, text: "5 - token", size: 26, color: "green", align: "center" },
          { op: "icon", kind: "key", x: 750, y: 850, s: 0.9, color: "yellow" },
          { op: "text", x: 1010, y: 878, text: "client secret: server-only", size: 30, color: "yellow", align: "center" },
        ],
      },
      {
        say:
          "So the server does the exchange, then stores the token in an H T T P only cookie. That's a cookie " +
          "JavaScript can't read, which takes a whole class of token stealing attacks off the table. " +
          "And there's no sessions table, no user table. The cookie is the session.",
        draw: [
          { op: "ellipse", cx: 320, cy: 760, rx: 120, ry: 74, color: "green" },
          { op: "text", x: 320, y: 748, text: "httpOnly cookie", size: 28, color: "green", align: "center" },
          { op: "text", x: 320, y: 786, text: "= the session", size: 26, color: "green", align: "center" },
          { op: "text", x: 320, y: 935, text: "localStorage", size: 30, color: "muted", align: "center" },
          { op: "cross", cx: 320, cy: 925, s: 90, color: "red" },
        ],
      },
      {
        say:
          "There's a tradeoff hiding here too. This is an O auth app, so you grant access to all your repos at once. " +
          "A GitHub app would let you tick specific repositories, more granular, but more moving parts. " +
          "The authors chose the simple one and wrote down the upgrade path in the read me. " +
          "Remember that pattern, pick simple, document the exit.",
        draw: [
          { op: "box", x: 1210, y: 800, w: 310, h: 150, color: "green", label: "OAuth App", labelSize: 28, labelPos: "top" },
          { op: "text", x: 1390, y: 905, text: "all repos - simple", size: 24, color: "green", align: "center" },
          { op: "check", x: 1236, y: 908, s: 36, color: "green" },
          { op: "box", x: 1560, y: 800, w: 310, h: 150, color: "muted", label: "GitHub App", labelSize: 28, labelPos: "top" },
          { op: "text", x: 1715, y: 905, text: "per-repo - more setup", size: 24, color: "muted", align: "center" },
        ],
      },
    ],
  },

  // ─────────────────────── Scene 5: The no-database bet ─────────────────────
  {
    id: "nodb",
    segs: [
      {
        say: "Now the choice that defines this backend. There is no database. So where does state actually live?",
        draw: [
          { op: "text", x: 90, y: 130, text: "State, without a database", size: 62, font: "head", color: "yellow" },
          { op: "icon", kind: "db", x: 1650, y: 80, s: 0.8, color: "muted" },
          { op: "cross", cx: 1690, cy: 140, s: 70, color: "red" },
        ],
      },
      {
        say:
          "Job state lives in a JavaScript map, in the server's memory. The auth token lives in the cookie. " +
          "The browser remembers which job it was watching in local storage, so a reload can reconnect. " +
          "And the videos themselves live on disk, or in a storage bucket in cloud mode. " +
          "Every piece of state found a cheaper home than a database row.",
        draw: [
          { op: "box", x: 140, y: 230, w: 560, h: 160, color: "teal", label: "jobs + event logs", labelSize: 30, labelPos: "top" },
          { op: "text", x: 420, y: 348, text: "a Map() in server RAM", size: 28, color: "teal", align: "center" },
          { op: "box", x: 140, y: 440, w: 560, h: 160, color: "green", label: "identity", labelSize: 30, labelPos: "top" },
          { op: "text", x: 420, y: 558, text: "httpOnly cookie (7 days)", size: 28, color: "green", align: "center" },
          { op: "box", x: 140, y: 650, w: 560, h: 160, color: "blue", label: "which job was I watching?", labelSize: 30, labelPos: "top" },
          { op: "text", x: 420, y: 768, text: "browser localStorage", size: 28, color: "blue", align: "center" },
          { op: "box", x: 140, y: 860, w: 560, h: 160, color: "orange", label: "the videos", labelSize: 30, labelPos: "top" },
          { op: "text", x: 420, y: 978, text: "disk locally - GCS bucket in cloud", size: 28, color: "orange", align: "center" },
        ],
      },
      {
        say:
          "What does that cost? If the server restarts, running jobs are simply gone. There's no job history. " +
          "And you can't load balance across two servers, because each one has its own private memory.",
        draw: [
          { op: "text", x: 1000, y: 300, text: "the cost", size: 44, font: "head", color: "red" },
          { op: "cross", cx: 1030, cy: 375, s: 34, color: "red" },
          { op: "text", x: 1075, y: 388, text: "restart = running jobs vanish", size: 32, color: "chalk" },
          { op: "cross", cx: 1030, cy: 445, s: 34, color: "red" },
          { op: "text", x: 1075, y: 458, text: "no history of past runs", size: 32, color: "chalk" },
          { op: "cross", cx: 1030, cy: 515, s: 34, color: "red" },
          { op: "text", x: 1075, y: 528, text: "one server only - state is trapped in RAM", size: 32, color: "chalk" },
        ],
      },
      {
        say:
          "And what does it buy? No migrations, no connection strings, nothing to provision, and a backend you can " +
          "read in one sitting. For a prototype whose entire value is proving the agent pipeline works, that's the " +
          "right trade. Persistence is a feature you add when someone actually needs it.",
        draw: [
          { op: "text", x: 1000, y: 660, text: "the win", size: 44, font: "head", color: "green" },
          { op: "check", x: 1010, y: 720, s: 40, color: "green" },
          { op: "text", x: 1075, y: 748, text: "zero ops - nothing to provision", size: 32, color: "chalk" },
          { op: "check", x: 1010, y: 790, s: 40, color: "green" },
          { op: "text", x: 1075, y: 818, text: "readable in one sitting", size: 32, color: "chalk" },
          { op: "check", x: 1010, y: 860, s: 40, color: "green" },
          { op: "text", x: 1075, y: 888, text: "ship the interesting part today", size: 32, color: "chalk" },
          { op: "underline", x1: 1000, x2: 1700, y: 960, color: "yellow" },
          { op: "text", x: 1350, y: 1005, text: "prototype priorities: prove it, then persist it", size: 32, color: "yellow", align: "center" },
        ],
      },
    ],
  },

  // ──────────────────── Scene 6: Job queue + SSE streaming ──────────────────
  {
    id: "sse",
    segs: [
      {
        say:
          "Generating a video takes minutes, so the server runs a tiny job system. A queue, a cap of two jobs at " +
          "once so the machine never drowns, and a little state machine for each job.",
        draw: [
          { op: "text", x: 90, y: 130, text: "Jobs + live progress", size: 66, font: "head", color: "yellow" },
          { op: "box", x: 140, y: 240, w: 100, h: 100, color: "teal", label: "run", labelSize: 26 },
          { op: "box", x: 260, y: 240, w: 100, h: 100, color: "teal", label: "run", labelSize: 26 },
          { op: "box", x: 400, y: 240, w: 100, h: 100, color: "muted", label: "wait", labelSize: 26 },
          { op: "box", x: 520, y: 240, w: 100, h: 100, color: "muted", label: "wait", labelSize: 26 },
          { op: "text", x: 390, y: 400, text: "max 2 at once (per-job CPU + RAM caps)", size: 28, color: "muted", align: "center" },
          { op: "ellipse", cx: 240, cy: 560, rx: 105, ry: 56, color: "chalk" },
          { op: "text", x: 240, y: 572, text: "queued", size: 30, color: "chalk", align: "center" },
          { op: "arrow", x1: 350, y1: 560, x2: 480, y2: 560, color: "chalk" },
          { op: "ellipse", cx: 590, cy: 560, rx: 105, ry: 56, color: "yellow" },
          { op: "text", x: 590, y: 572, text: "running", size: 30, color: "yellow", align: "center" },
          { op: "arrow", x1: 680, y1: 515, x2: 790, y2: 460, color: "green" },
          { op: "ellipse", cx: 890, cy: 445, rx: 95, ry: 52, color: "green" },
          { op: "text", x: 890, y: 457, text: "done", size: 30, color: "green", align: "center" },
          { op: "arrow", x1: 680, y1: 605, x2: 790, y2: 660, color: "red" },
          { op: "ellipse", cx: 890, cy: 675, rx: 95, ry: 52, color: "red" },
          { op: "text", x: 890, y: 687, text: "error", size: 30, color: "red", align: "center" },
          { op: "arrow", x1: 590, y1: 620, x2: 590, y2: 720, color: "muted" },
          { op: "text", x: 590, y: 775, text: "canceled", size: 30, color: "muted", align: "center" },
        ],
      },
      {
        say:
          "The browser watches progress over server sent events, S S E. If you haven't met it, it's a one way " +
          "stream from the server over plain H T T P. The obvious alternative was web sockets, which are two way. " +
          "But look at the traffic. Everything flows server to browser. The only upstream message is cancel, " +
          "and that's just a button doing a plain post request. Choosing S S E means no new protocol, free " +
          "auto reconnect in the browser, and the same cookies as every other request.",
        draw: [
          { op: "box", x: 1130, y: 250, w: 240, h: 130, color: "teal", label: "server", labelSize: 30 },
          { op: "box", x: 1640, y: 250, w: 200, h: 130, color: "blue", label: "browser", labelSize: 30 },
          { op: "arrow", x1: 1380, y1: 285, x2: 1630, y2: 285, color: "green" },
          { op: "arrow", x1: 1380, y1: 320, x2: 1630, y2: 320, color: "green" },
          { op: "arrow", x1: 1380, y1: 355, x2: 1630, y2: 355, color: "green" },
          { op: "text", x: 1505, y: 260, text: "events, one way", size: 24, color: "green", align: "center" },
          { op: "arrow", x1: 1630, y1: 420, x2: 1380, y2: 420, color: "muted", dashed: true },
          { op: "text", x: 1505, y: 465, text: "cancel = plain POST", size: 24, color: "muted", align: "center" },
          { op: "text", x: 1520, y: 560, text: "WebSockets: two-way", size: 28, color: "muted", align: "center" },
          { op: "cross", cx: 1352, cy: 552, s: 44, color: "red" },
          { op: "text", x: 1505, y: 598, text: "(we don't need two-way)", size: 24, color: "muted", align: "center" },
        ],
      },
      {
        say:
          "The clever part is replay. Every event is buffered in the job's memory. Reconnect, even reload the whole " +
          "page, and the server replays the transcript from the start, then keeps tailing. The refresh button becomes " +
          "harmless. That one design choice, replay then tail, is why the U I feels indestructible.",
        draw: [
          { op: "box", x: 140, y: 850, w: 700, h: 80, color: "green", label: "", labelSize: 24 },
          { op: "line", x1: 200, y1: 858, x2: 200, y2: 922, color: "green" },
          { op: "line", x1: 260, y1: 858, x2: 260, y2: 922, color: "green" },
          { op: "line", x1: 320, y1: 858, x2: 320, y2: 922, color: "green" },
          { op: "line", x1: 380, y1: 858, x2: 380, y2: 922, color: "green" },
          { op: "line", x1: 440, y1: 858, x2: 440, y2: 922, color: "green" },
          { op: "line", x1: 500, y1: 858, x2: 500, y2: 922, color: "green" },
          { op: "text", x: 490, y: 815, text: "every event, buffered", size: 28, color: "green", align: "center" },
          { op: "arrow", x1: 850, y1: 890, x2: 1030, y2: 890, color: "green" },
          { op: "text", x: 1180, y: 878, text: "reconnect: replay all,", size: 30, color: "chalk" },
          { op: "text", x: 1180, y: 918, text: "then tail. reload-proof.", size: 30, color: "chalk" },
          { op: "check", x: 1530, y: 880, s: 44, color: "green" },
        ],
      },
      {
        say:
          "The cost is memory per job, and it only works because a job's audience is one browser tab. " +
          "Notice the theme. Solutions sized to the actual problem, not the general one.",
        draw: [
          { op: "underline", x1: 1130, x2: 1840, y: 1000, color: "yellow" },
          { op: "text", x: 1485, y: 1040, text: "sized to the real problem, not the general one", size: 30, color: "yellow", align: "center" },
        ],
      },
    ],
  },

  // ───────────────────────── Scene 7: The agent in a box ────────────────────
  {
    id: "agent",
    segs: [
      {
        say:
          "Now the headline act. When a job starts, the server spins up a fresh Docker container, and hands an A I " +
          "agent exactly one task. Make me a walkthrough video of this app.",
        draw: [
          { op: "text", x: 90, y: 130, text: "An agent in a box", size: 66, font: "head", color: "yellow" },
          { op: "box", x: 480, y: 230, w: 960, h: 560, color: "orange", double: true, label: "", labelSize: 30 },
          { op: "text", x: 960, y: 275, text: "fresh container, every job", size: 30, color: "orange", align: "center" },
        ],
      },
      {
        say:
          "Why an agent, instead of a normal, deterministic recorder script? Because the input is any repository. " +
          "Node, Python, Rails, Go, a static site. The task prompt literally forbids assuming a language, a port, " +
          "or a selector. The agent reads the read me and the manifests, installs dependencies, starts the app, and " +
          "discovers the U R L from the app's own startup output. Generality is the product, and only an agent gives " +
          "you that. The price is nondeterminism. Minutes of runtime, tokens, and no two runs identical.",
        draw: [
          { op: "box", x: 720, y: 320, w: 480, h: 110, color: "teal", label: "Codex CLI - gpt-5.5", labelSize: 34 },
          { op: "arrow", x1: 210, y1: 430, x2: 470, y2: 430, color: "blue" },
          { op: "text", x: 300, y: 395, text: "a copy of", size: 28, color: "blue", align: "center" },
          { op: "text", x: 300, y: 480, text: "your repo", size: 28, color: "blue", align: "center" },
          { op: "text", x: 250, y: 590, text: "Node? Python?", size: 28, color: "muted", align: "center" },
          { op: "text", x: 250, y: 630, text: "Go? Rails?", size: 28, color: "muted", align: "center" },
          { op: "text", x: 250, y: 683, text: "assume nothing", size: 28, color: "yellow", align: "center" },
          { op: "underline", x1: 150, x2: 355, y: 700, color: "yellow" },
          { op: "box", x: 560, y: 480, w: 150, h: 62, color: "muted", label: "Chrome", labelSize: 22 },
          { op: "box", x: 730, y: 480, w: 150, h: 62, color: "muted", label: "Node", labelSize: 22 },
          { op: "box", x: 900, y: 480, w: 150, h: 62, color: "muted", label: "Python", labelSize: 22 },
          { op: "box", x: 1070, y: 480, w: 150, h: 62, color: "muted", label: "ffmpeg", labelSize: 22 },
          { op: "box", x: 1240, y: 480, w: 150, h: 62, color: "muted", label: "Remotion", labelSize: 22 },
          { op: "text", x: 960, y: 620, text: "reads manifests - installs - starts the app -", size: 28, color: "chalk", align: "center" },
          { op: "text", x: 960, y: 660, text: "finds the URL in the app's own output", size: 28, color: "chalk", align: "center" },
        ],
      },
      {
        say:
          "Here's the configuration that should make you flinch. Sandbox mode, danger, full access. Approvals, never. " +
          "The agent can run anything, without asking. And that's fine, because the security boundary is not the " +
          "agent's permission model. It's the container wall. Inside, a throwaway copy of the repo and a toolchain. " +
          "Your GitHub token never enters. The server downloads the tarball itself, and mounts only source code.",
        draw: [
          { op: "text", x: 1660, y: 300, text: "sandbox:", size: 30, color: "pink", align: "center" },
          { op: "text", x: 1660, y: 340, text: "danger-full-access", size: 30, color: "pink", align: "center" },
          { op: "text", x: 1660, y: 385, text: "approvals: never", size: 30, color: "pink", align: "center" },
          { op: "icon", kind: "flame", x: 1822, y: 330, s: 0.7, color: "red" },
          { op: "arrow", x1: 1570, y1: 350, x2: 1450, y2: 370, color: "pink" },
          { op: "line", x1: 480, y1: 230, x2: 480, y2: 790, color: "yellow", sw: 10 },
          { op: "text", x: 330, y: 790, text: "the real boundary", size: 30, color: "yellow", align: "center" },
          { op: "icon", kind: "key", x: 170, y: 870, s: 0.9, color: "purple" },
          { op: "text", x: 350, y: 905, text: "GitHub token:", size: 28, color: "purple", align: "center" },
          { op: "text", x: 350, y: 943, text: "never enters", size: 28, color: "purple", align: "center" },
          { op: "cross", cx: 480, cy: 900, s: 56, color: "red" },
        ],
      },
      {
        say:
          "Even the agent's home directory is separate for every job, so parallel runs can't see each other's " +
          "sessions. And when the job ends, the whole container is deleted. The blast radius of a rogue agent is " +
          "one disposable box.",
        draw: [
          { op: "box", x: 1500, y: 620, w: 150, h: 100, color: "muted", label: "job A home", labelSize: 20 },
          { op: "box", x: 1680, y: 620, w: 150, h: 100, color: "muted", label: "job B home", labelSize: 20 },
          { op: "icon", kind: "trash", x: 1580, y: 790, s: 0.9, color: "muted" },
          { op: "text", x: 1720, y: 850, text: "deleted after", size: 26, color: "muted", align: "center" },
        ],
      },
      {
        say:
          "Notice the inversion. The scary looking setting is safe because of where it runs. " +
          "Permissions were traded for isolation.",
        draw: [
          { op: "underline", x1: 560, x2: 1360, y: 1000, color: "yellow" },
          { op: "text", x: 960, y: 1042, text: "permissions were traded for isolation", size: 38, font: "head", color: "yellow", align: "center" },
        ],
      },
    ],
  },

  // ─────────────────────── Scene 8: Inside the pipeline ─────────────────────
  {
    id: "pipeline",
    segs: [
      {
        say: "So what actually happens inside that box? An assembly line, with four specialized tools.",
        draw: [
          { op: "text", x: 90, y: 130, text: "Inside the box: an assembly line", size: 62, font: "head", color: "yellow" },
          { op: "line", x1: 120, y1: 560, x2: 1820, y2: 560, color: "muted" },
          { op: "arrow", x1: 120, y1: 300, x2: 240, y2: 380, color: "chalk" },
          { op: "text", x: 160, y: 265, text: "the running app", size: 28, color: "chalk" },
        ],
      },
      {
        say:
          "Playwright, a library that drives a real Chrome browser, starts the tour the agent wrote. Move the cursor " +
          "here, click this, scroll there. The agent picks its selectors by reading the live page, not by guessing.",
        draw: [
          { op: "icon", kind: "browser", x: 240, y: 380, w: 220, h: 150, color: "blue" },
          { op: "icon", kind: "cursor", x: 420, y: 470, s: 1.0, color: "yellow" },
          { op: "text", x: 350, y: 625, text: "1 - Playwright", size: 32, color: "blue", align: "center" },
          { op: "text", x: 350, y: 668, text: "drives real Chrome", size: 26, color: "muted", align: "center" },
          { op: "text", x: 350, y: 703, text: "selectors read from the live page", size: 22, color: "muted", align: "center" },
        ],
      },
      {
        say:
          "Eleven Labs turns the agent's narration script into a warm human voice. The same A P I that is narrating " +
          "what you're hearing right now.",
        draw: [
          { op: "arrow", x1: 480, y1: 560, x2: 600, y2: 560, color: "muted" },
          { op: "icon", kind: "wave", x: 700, y: 430, s: 1.4, color: "pink" },
          { op: "text", x: 800, y: 625, text: "2 - ElevenLabs", size: 32, color: "pink", align: "center" },
          { op: "text", x: 800, y: 668, text: "narration from text", size: 26, color: "muted", align: "center" },
          { op: "text", x: 800, y: 703, text: "(this voice, right now)", size: 22, color: "pink", align: "center" },
        ],
      },
      {
        say:
          "Remotion composites the result, and Remotion is a curious choice. You describe video frames as React " +
          "components, and it renders them with a headless browser. Heavyweight, yes. But it means the animated " +
          "cursor and the numbered step rail are code. Deterministic, reviewable, versioned. No video editor involved. " +
          "Then F F em peg muxes the final M P 4.",
        draw: [
          { op: "arrow", x1: 940, y1: 560, x2: 1060, y2: 560, color: "muted" },
          { op: "icon", kind: "film", x: 1100, y: 400, w: 240, h: 140, color: "purple" },
          { op: "text", x: 1240, y: 625, text: "3 - Remotion", size: 32, color: "purple", align: "center" },
          { op: "text", x: 1240, y: 668, text: "video described as React code", size: 26, color: "muted", align: "center" },
          { op: "text", x: 1240, y: 703, text: "overlays are code, not edits", size: 22, color: "muted", align: "center" },
          { op: "arrow", x1: 1400, y1: 560, x2: 1520, y2: 560, color: "muted" },
          { op: "icon", kind: "play", x: 1660, y: 450, s: 1.1, color: "green" },
          { op: "text", x: 1660, y: 625, text: "4 - ffmpeg", size: 32, color: "green", align: "center" },
          { op: "text", x: 1660, y: 668, text: "walkthrough.mp4", size: 26, color: "muted", align: "center" },
        ],
      },
      {
        say:
          "One production detail worth stealing. The whole pipeline, the N P M packages, even Remotion's browser " +
          "download, is pre baked into the Docker image at build time. So jobs pay nothing for setup. " +
          "Image size was traded for job latency, and job latency is the thing the user actually feels.",
        draw: [
          { op: "box", x: 300, y: 800, w: 640, h: 150, color: "orange", label: "Docker image", labelSize: 30, labelPos: "top" },
          { op: "text", x: 620, y: 905, text: "deps + browser pre-baked at build time", size: 28, color: "orange", align: "center" },
          { op: "icon", kind: "clock", x: 1030, y: 850, s: 1.0, color: "yellow" },
          { op: "text", x: 1400, y: 870, text: "bigger image, faster jobs -", size: 34, color: "yellow", align: "center" },
          { op: "text", x: 1400, y: 915, text: "users feel latency, not megabytes", size: 34, color: "yellow", align: "center" },
          { op: "underline", x1: 1130, x2: 1670, y: 940, color: "yellow" },
        ],
      },
    ],
  },

  // ────────────────── Scene 9: One engine, two rooms (runners) ──────────────
  {
    id: "runners",
    segs: [
      {
        say:
          "Where does that container actually run? Here's the most deliberate piece of engineering in the repo. " +
          "The job engine doesn't know, and doesn't care. Execution hides behind a tiny interface called a runner, " +
          "with two implementations.",
        draw: [
          { op: "text", x: 90, y: 130, text: "One engine, two rooms", size: 66, font: "head", color: "yellow" },
          { op: "box", x: 760, y: 200, w: 400, h: 120, color: "teal", label: "job engine", labelSize: 34 },
          { op: "text", x: 960, y: 355, text: "run - cancel - videoReady - serve", size: 26, color: "muted", align: "center" },
          { op: "arrow", x1: 850, y1: 380, x2: 500, y2: 450, color: "chalk" },
          { op: "arrow", x1: 1070, y1: 380, x2: 1420, y2: 450, color: "chalk" },
        ],
      },
      {
        say:
          "Runner one, local Docker. The server just shells out to docker run on the same machine. Instant, free, " +
          "perfect for development. But the machine has to be yours, always on, with Docker installed.",
        draw: [
          { op: "box", x: 140, y: 460, w: 760, h: 280, color: "blue", label: "LOCAL", labelSize: 30, labelPos: "top" },
          { op: "icon", kind: "laptop", x: 230, y: 560, s: 1.1, color: "blue" },
          { op: "text", x: 640, y: 575, text: "docker run --rm", size: 32, color: "chalk", align: "center" },
          { op: "text", x: 640, y: 640, text: "instant - free - yours", size: 28, color: "green", align: "center" },
          { op: "text", x: 640, y: 690, text: "but: your host, always on", size: 28, color: "pink", align: "center" },
        ],
      },
      {
        say:
          "Runner two, Google Cloud Run Jobs. Each job becomes a pay per use cloud execution that scales to zero. " +
          "Idle costs nothing, which fits a bursty workload that runs minutes per day. It's also unavoidable. " +
          "A Cloud Run service can't spawn sibling Docker containers, so the platform's job primitive is the answer.",
        draw: [
          { op: "box", x: 1020, y: 460, w: 800, h: 280, color: "purple", label: "CLOUD", labelSize: 30, labelPos: "top" },
          { op: "icon", kind: "cloud", x: 1100, y: 545, s: 0.9, color: "purple" },
          { op: "text", x: 1490, y: 575, text: "Cloud Run Job per generation", size: 30, color: "chalk", align: "center" },
          { op: "text", x: 1490, y: 640, text: "scales to zero - pay per second", size: 28, color: "green", align: "center" },
          { op: "text", x: 1490, y: 690, text: "but: every hop becomes explicit", size: 28, color: "pink", align: "center" },
        ],
      },
      {
        say:
          "Clouds don't have bind mounts, so look what happens to the data path. The repo is staged as a tarball in " +
          "cloud storage. Secrets arrive through a secret manager. The finished video is uploaded back to the bucket " +
          "and served with signed U R Ls. And logs are polled out of cloud logging every two and a half seconds, " +
          "then re emitted as the exact same S S E events. Polling instead of push. Fewer moving parts, fewer quotas, " +
          "at the price of a tiny delay.",
        draw: [
          { op: "icon", kind: "doc", x: 180, y: 800, s: 0.65, color: "chalk" },
          { op: "text", x: 210, y: 935, text: "tarball", size: 24, color: "chalk", align: "center" },
          { op: "arrow", x1: 285, y1: 855, x2: 375, y2: 855, color: "muted" },
          { op: "icon", kind: "bucket", x: 390, y: 810, s: 0.8, color: "orange" },
          { op: "text", x: 435, y: 935, text: "GCS", size: 24, color: "orange", align: "center" },
          { op: "arrow", x1: 500, y1: 855, x2: 590, y2: 855, color: "muted" },
          { op: "box", x: 600, y: 805, w: 170, h: 90, color: "purple", label: "job", labelSize: 26 },
          { op: "arrow", x1: 780, y1: 855, x2: 870, y2: 855, color: "muted" },
          { op: "icon", kind: "bucket", x: 885, y: 810, s: 0.8, color: "orange" },
          { op: "text", x: 930, y: 935, text: "mp4", size: 24, color: "orange", align: "center" },
          { op: "arrow", x1: 995, y1: 855, x2: 1085, y2: 855, color: "muted" },
          { op: "icon", kind: "browser", x: 1100, y: 805, w: 150, h: 100, color: "blue" },
          { op: "text", x: 1175, y: 935, text: "signed URL", size: 24, color: "blue", align: "center" },
          { op: "text", x: 1560, y: 830, text: "logs: polled every 2.5s,", size: 28, color: "muted", align: "center" },
          { op: "text", x: 1560, y: 868, text: "re-emitted as the same SSE", size: 28, color: "muted", align: "center" },
        ],
      },
      {
        say:
          "One war story from the commit log. The frontend used to double check the video U R L with a head request. " +
          "In cloud mode that U R L answers with a redirect to the bucket, the probe tripped over cross origin rules " +
          "and reported no video, even though the video tag played the same U R L just fine. The fix was to trust " +
          "the server's own ready flag. Test the path your users actually take.",
        draw: [
          { op: "text", x: 1560, y: 950, text: "war story: a HEAD probe hit CORS -", size: 24, color: "pink", align: "center" },
          { op: "text", x: 1560, y: 984, text: "the <video> tag was fine. trust the server.", size: 24, color: "pink", align: "center" },
        ],
      },
      {
        say:
          "And the browser can never tell which room did the work. Same endpoints, same events. Even the cloud " +
          "libraries are imported lazily, so local development never installs them. This abstraction earns its keep.",
        draw: [
          { op: "underline", x1: 560, x2: 1360, y: 1030, color: "yellow" },
          { op: "text", x: 960, y: 1064, text: "the browser cannot tell the two rooms apart", size: 30, color: "yellow", align: "center" },
        ],
      },
    ],
  },

  // ───────────────────────── Scene 10: The ledger ───────────────────────────
  {
    id: "ledger",
    segs: [
      {
        say: "Let's close the way architects should, with an honest ledger. What this design bought, and what it deferred.",
        draw: [
          { op: "text", x: 90, y: 130, text: "The ledger", size: 66, font: "head", color: "yellow" },
          { op: "line", x1: 960, y1: 200, x2: 960, y2: 740, color: "muted" },
          { op: "text", x: 480, y: 250, text: "prioritized", size: 50, font: "head", color: "green", align: "center" },
          { op: "text", x: 1440, y: 250, text: "deferred", size: 50, font: "head", color: "pink", align: "center" },
        ],
      },
      {
        say:
          "Prioritized. Shipping speed, no database, no framework ceremony. Generality, any stack, thanks to the " +
          "agent. Security exactly where it counts, the token never leaves the server and the agent stays in its box. " +
          "First impressions, a cached demo so visitors see value in seconds. And idle cost, everything scales to zero.",
        draw: [
          { op: "check", x: 130, y: 320, s: 36, color: "green" },
          { op: "text", x: 190, y: 345, text: "shipping speed - no DB, no ceremony", size: 32, color: "chalk" },
          { op: "check", x: 130, y: 400, s: 36, color: "green" },
          { op: "text", x: 190, y: 425, text: "generality - any stack (the agent)", size: 32, color: "chalk" },
          { op: "check", x: 130, y: 480, s: 36, color: "green" },
          { op: "text", x: 190, y: 505, text: "security where it counts -", size: 32, color: "chalk" },
          { op: "text", x: 190, y: 545, text: "token contained, agent boxed", size: 28, color: "muted" },
          { op: "check", x: 130, y: 600, s: 36, color: "green" },
          { op: "text", x: 190, y: 625, text: "first impressions - cached demo", size: 32, color: "chalk" },
          { op: "check", x: 130, y: 680, s: 36, color: "green" },
          { op: "text", x: 190, y: 705, text: "idle cost - scales to zero", size: 32, color: "chalk" },
        ],
      },
      {
        say:
          "Deferred. Persistence and job history. Horizontal scale, this is one box of RAM. Fine grained repo " +
          "permissions. Deterministic run times. And, worth saying out loud, automated tests. There are none. " +
          "In a prototype whose riskiest component is a nondeterministic agent already fenced by a container, " +
          "that's a defensible bet. But it is a bet, and it's written nowhere except in what's absent.",
        draw: [
          { op: "cross", cx: 1052, cy: 335, s: 30, color: "red" },
          { op: "text", x: 1105, y: 345, text: "persistence + job history", size: 32, color: "chalk" },
          { op: "cross", cx: 1052, cy: 415, s: 30, color: "red" },
          { op: "text", x: 1105, y: 425, text: "horizontal scale (one box of RAM)", size: 32, color: "chalk" },
          { op: "cross", cx: 1052, cy: 495, s: 30, color: "red" },
          { op: "text", x: 1105, y: 505, text: "per-repo permissions (GitHub App)", size: 32, color: "chalk" },
          { op: "cross", cx: 1052, cy: 575, s: 30, color: "red" },
          { op: "text", x: 1105, y: 585, text: "deterministic runtimes", size: 32, color: "chalk" },
          { op: "cross", cx: 1052, cy: 655, s: 30, color: "red" },
          { op: "text", x: 1105, y: 665, text: "tests - none (a bet, unwritten)", size: 32, color: "chalk" },
        ],
      },
      {
        say:
          "Two lessons to take with you. First, when your worker is an A I, the prompt is code. The task text in " +
          "this repo pins down inputs, outputs, verification steps, even don't assume the port. It deserves code review " +
          "like everything else that can break production.",
        draw: [
          { op: "icon", kind: "doc", x: 150, y: 800, s: 0.8, color: "teal" },
          { op: "text", x: 250, y: 830, text: "agent-task.txt", size: 32, color: "teal" },
          { op: "text", x: 250, y: 880, text: "the prompt IS code -", size: 34, color: "chalk" },
          { op: "text", x: 250, y: 925, text: "inputs, outputs, verification. review it.", size: 30, color: "muted" },
          { op: "underline", x1: 250, x2: 610, y: 895, color: "teal" },
        ],
      },
      {
        say:
          "Second, architecture is just priorities made visible. Read any repo this way. Find what the authors " +
          "protected, what they postponed, and why, and codebases start explaining themselves. Thanks for watching.",
        draw: [
          { op: "text", x: 1360, y: 880, text: "architecture =", size: 54, font: "head", color: "yellow", align: "center" },
          { op: "text", x: 1360, y: 950, text: "priorities made visible", size: 54, font: "head", color: "yellow", align: "center" },
          { op: "underline", x1: 1090, x2: 1630, y: 985, color: "yellow" },
          { op: "text", x: 1360, y: 1045, text: "thanks for watching", size: 30, color: "muted", align: "center" },
        ],
      },
    ],
  },
];
