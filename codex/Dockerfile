# Full toolchain so the Codex agent can generate the walkthrough end-to-end IN
# the container: Codex CLI + Node + Python (runs the app) + Playwright/Chromium
# (records the UI) + Remotion (renders) + ffmpeg.
#
# Base = Playwright image: Node + Chromium + all the system libs already present.
FROM mcr.microsoft.com/playwright:v1.49.1-noble

ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 python3-pip python3-venv ffmpeg git jq ca-certificates curl \
    && rm -rf /var/lib/apt/lists/*

# Python deps for the demo app (server.py talks to Postgres via psycopg2).
RUN pip3 install --break-system-packages --no-cache-dir "psycopg2-binary>=2.9,<3"

# Codex CLI.
RUN npm install -g @openai/codex@latest

# Pre-bake the video pipeline (npm deps + Remotion's headless browser) at
# /opt/video-project so the agent doesn't pay install / browser-download at run
# time. The agent copies this to a writable workdir, rewrites the tour, and runs it.
COPY instructions/video-project/ /opt/video-project/
RUN cd /opt/video-project \
    && npm install --no-audit --no-fund \
    && (npx --yes remotion browser ensure || true)

ENV CODEX_HOME=/codex-home
ENV VIDEO_PROJECT=/opt/video-project
WORKDIR /workspace
CMD ["sleep", "infinity"]
